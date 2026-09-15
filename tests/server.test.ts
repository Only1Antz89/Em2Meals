import test from "node:test";
import assert from "node:assert/strict";
import { resetDB, sqlite, env } from "./runtime-fixture";
import { emptyState, type State } from "../lib/domain";
import { loadState, commitState, importEnquiries } from "../lib/server";
import { POST as send } from "../app/api/admin/send/route";
import { POST as submit } from "../app/api/enquiries/route";
import { POST as resolve } from "../app/api/admin/delivery/route";
import { runDigest } from "../app/api/cron/crm-followups/route";
function req(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { Origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function save(s: State, revision = 0) {
  sqlite
    .prepare(
      "INSERT OR REPLACE INTO workspaces(id,data,revision,updated_at) VALUES('live',?,?,?)",
    )
    .run(JSON.stringify(s), revision, new Date().toISOString());
}
function draftState() {
  const s = emptyState();
  s.drafts.push({
    id: "draft",
    to: "supplier@example.com",
    subject: "Test only",
    body: "Test email — never sent",
    at: new Date().toISOString(),
  });
  save(s);
  return s;
}
const details = {
  service: "corporate",
  eventType: "Local test",
  attendees: 10,
  date: "",
  eventTime: "",
  arrivalTime: "",
  requests: "Test fixture",
  dietary: "",
  requirements: [],
  name: "Contact",
  company: "Company",
  email: "customer@example.com",
  phone: "1234567",
  venue: "",
  address: "",
  postcode: "",
  access: "",
  unknownDetails: "",
};
test("public enquiries automatically create CRM and orders; duplicate requests stay unique", async () => {
  resetDB();
  const body = { details, requestKey: crypto.randomUUID(), website: "" };
  const response = await submit(req(body));
  assert.equal(response.status, 201);
  const repeat = await submit(req(body));
  assert.equal(repeat.status, 200);
  let { state } = await loadState();
  assert.equal(state.customers.length, 1);
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0].status, "enquiry");
  assert.equal(state.orders[0].reservations.length, 0);
  state.customers[0].notes = "Owner notes";
  await commitState("live", state, (await loadState()).revision);
  await submit(
    req({
      ...body,
      requestKey: crypto.randomUUID(),
      details: {
        ...details,
        email: "CUSTOMER@example.com",
        name: "Different submitted name",
      },
    }),
  );
  state = (await loadState()).state;
  assert.equal(state.customers.length, 1);
  assert.equal(state.orders.length, 2);
  assert.equal(state.customers[0].name, "Contact");
  assert.equal(state.customers[0].notes, "Owner notes");
});
test("pending and historical enquiries backfill safely and never enter sample data", async () => {
  resetDB();
  sqlite
    .prepare(
      "INSERT INTO enquiries(id,request_key,payload_hash,payload,created_at) VALUES(?,?,?,?,?)",
    )
    .run(
      "old",
      "key",
      "hash",
      JSON.stringify({ ...details, date: "2020-01-01" }),
      "2020-01-01T00:00:00Z",
    );
  await importEnquiries();
  await importEnquiries();
  const live = await loadState();
  assert.equal(live.state.orders.length, 1);
  assert.equal(live.state.orders[0].details.date, "2020-01-01");
  assert.equal(
    (await loadState("sample")).state.orders.some((o) => o.enquiryId === "old"),
    false,
  );
  assert.equal(
    sqlite
      .prepare("SELECT status FROM enquiry_imports WHERE enquiry_id='old'")
      .get()!.status,
    "imported",
  );
});
test("migration retains a single original backup", async () => {
  resetDB();
  const s = emptyState();
  delete (s as Partial<State>).schemaVersion;
  save(s);
  await loadState();
  await loadState();
  const backups = sqlite.prepare("SELECT data FROM workspace_backups").all();
  assert.equal(backups.length, 1);
  assert.equal(JSON.parse(backups[0].data as string).schemaVersion, undefined);
});
test("workspace send lease excludes concurrent mutations and duplicate provider calls", async () => {
  resetDB();
  draftState();
  let called = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called++;
    const { state, revision } = await loadState();
    await assert.rejects(
      commitState("live", state, revision),
      /Another change/,
    );
    return Response.json({
      request_id: "request-1",
      data: { succeeded: 1, failed: 0, failures: [], email_id: "provider-1" },
    });
  };
  try {
    const r = await send(req({ draftId: "draft", confirm: true }));
    assert.equal(r.status, 200);
    const again = await send(req({ draftId: "draft", confirm: true }));
    assert.equal(again.status, 200);
    assert.equal(called, 1);
    assert.equal((await loadState()).state.drafts[0].deliveryStatus, "sent");
    assert.equal(
      sqlite.prepare("SELECT * FROM workspace_send_locks").all().length,
      0,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("uncertain email cannot resend until provider verification; no automatic retry", async () => {
  resetDB();
  draftState();
  let called = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called++;
    throw Error("Network interruption");
  };
  try {
    assert.equal(
      (await send(req({ draftId: "draft", confirm: true }))).status,
      400,
    );
    assert.equal(
      (await send(req({ draftId: "draft", confirm: true }))).status,
      400,
    );
    assert.equal(called, 1);
    assert.equal(
      (await loadState()).state.drafts[0].deliveryStatus,
      "uncertain",
    );
    const reconciled = await resolve(
      req({
        mode: "live",
        draftId: "draft",
        outcome: "sent",
        note: "Verified in provider dashboard",
      }),
    );
    assert.equal(reconciled.status, 200);
    assert.equal((await loadState()).state.drafts[0].deliveryStatus, "sent");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("SMTP2GO processing failures are not recorded as successful sends", async () => {
  resetDB();
  draftState();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      request_id: "request-failed",
      data: { succeeded: 0, failed: 1, failures: [{ error: "Rejected" }] },
    });
  try {
    const response = await send(req({ draftId: "draft", confirm: true }));
    assert.equal(response.status, 400);
    assert.equal(
      sqlite.prepare("SELECT status FROM email_deliveries WHERE id='draft'").get()?.status,
      "failed",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("email sending fails closed when SMTP2GO is not configured or returns HTTP failure", async () => {
  resetDB();
  draftState();
  const originalKey = env.SMTP2GO_API_KEY;
  env.SMTP2GO_API_KEY = "";
  assert.equal((await send(req({ draftId: "draft", confirm: true }))).status, 400);
  env.SMTP2GO_API_KEY = originalKey;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  try {
    assert.equal((await send(req({ draftId: "draft", confirm: true }))).status, 400);
    assert.equal(sqlite.prepare("SELECT status FROM email_deliveries WHERE id='draft'").get()?.status, "failed");
  } finally {
    globalThis.fetch = originalFetch;
    env.SMTP2GO_API_KEY = originalKey;
  }
});
test("CRM digest sends once per London day for relationships needing attention", async () => {
  resetDB();
  const state = emptyState();
  state.customers.push({ id: "client", name: "Client", company: "Client Co", email: "client@example.com", phone: "", notes: "" });
  state.orders.push({
    id: "order",
    reference: "EM-CRM-1",
    customerId: "client",
    createdAt: "2026-09-10T10:00:00.000Z",
    status: "enquiry",
    details: { ...details, name: "Client", company: "Client Co", email: "client@example.com" },
    items: [],
    quotes: [],
    allergyReviewed: false,
    consumed: false,
    reservations: [],
  });
  save(state);
  let called = 0;
  const originalFetch = globalThis.fetch;
  const originalOwners = env.OWNER_EMAILS;
  env.OWNER_EMAILS = "owner@example.com,second@example.com";
  globalThis.fetch = async () => {
    called++;
    return Response.json({ request_id: "digest-request", data: { succeeded: 1, failed: 0, failures: [], email_id: "digest-email" } });
  };
  const digestRequest = new Request("https://em2.example/api/cron/crm-followups", {
    method: "POST",
    headers: { Authorization: "Bearer test-cron-secret" },
  });
  try {
    const beforeLondonWindow = new Date("2026-09-15T06:59:00.000Z");
    assert.equal((await runDigest(digestRequest, beforeLondonWindow)).status, 200);
    assert.equal(called, 0);
    const now = new Date("2026-09-15T07:00:00.000Z");
    assert.equal((await runDigest(digestRequest, now)).status, 200);
    assert.equal((await runDigest(digestRequest, now)).status, 200);
    assert.equal(called, 2);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM crm_digest_deliveries WHERE status='sent'").get()?.count, 2);
  } finally {
    globalThis.fetch = originalFetch;
    env.OWNER_EMAILS = originalOwners;
  }
});
test("stale supplier requests fail before acquiring a send claim", async () => {
  resetDB();
  const s = draftState();
  s.drafts[0].supplierId = "missing";
  s.drafts[0].proposal = {
    supplierId: "missing",
    lines: [],
    delivery: 0,
    minimum: 0,
    total: null,
    fingerprint: "old",
  };
  save(s);
  const response = await send(req({ draftId: "draft", confirm: true }));
  assert.equal(response.status, 400);
  assert.match(
    ((await response.json()) as { error: string }).error,
    /updating/,
  );
  assert.equal(
    sqlite.prepare("SELECT * FROM email_deliveries").all().length,
    0,
  );
});
test("duplicate concurrent enquiry requests recover to one imported order", async () => {
  resetDB();
  const body = { details, requestKey: crypto.randomUUID(), website: "" };
  await Promise.all([submit(req(body)), submit(req(body))]);
  await importEnquiries();
  const { state } = await loadState();
  assert.equal(state.orders.length, 1);
  assert.equal(state.customers.length, 1);
});

import { POST as places } from "../app/api/places/route";
import { POST as research } from "../app/api/admin/research/route";
import { POST as route } from "../app/api/admin/route/route";
test("public venue lookup is bounded, cached and carries selection into CRM order", async () => {
  resetDB();
  env.GOOGLE_MAPS_API_KEY = "fake-maps-key";
  let called = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called++;
    return Response.json({
      places: [
        {
          id: "venue-1",
          displayName: { text: "Town Hall" },
          formattedAddress: "1 Town Square",
          location: { latitude: 51.5, longitude: -0.1 },
          googleMapsUri: "https://maps.google.com/?q=Town+Hall",
        },
      ],
    });
  };
  try {
    const response = await places(req({ query: "Town Hall" }));
    assert.equal(response.status, 200);
    const result = (await response.json()) as {
      places: { id: string; name: string; address: string }[];
    };
    assert.equal(result.places[0].id, "venue-1");
    await places(req({ query: "Town Hall" }));
    assert.equal(called, 1);
    await submit(
      req({
        details: {
          ...details,
          place: result.places[0],
          venue: result.places[0].name,
          address: result.places[0].address,
        },
        requestKey: crypto.randomUUID(),
        website: "",
      }),
    );
    assert.equal(
      (await loadState()).state.orders[0].details.place!.id,
      "venue-1",
    );
    for (let n = 0; n < 40; n++) await places(req({ query: "Town Hall" }));
    const blocked = await places(req({ query: "Town Hall" }));
    assert.equal(blocked.status, 400);
    assert.match(
      ((await blocked.json()) as { error: string }).error,
      /limit reached/,
    );
    assert.equal(called, 1);
  } finally {
    globalThis.fetch = originalFetch;
    delete env.GOOGLE_MAPS_API_KEY;
  }
});
test("grounded venue research preserves citations and customer access separately", async () => {
  resetDB();
  env.GEMINI_API_KEY = "fake-gemini-key";
  await submit(
    req({
      details: {
        ...details,
        venue: "Town Hall",
        address: "1 Town Square",
        access: "Customer: use side door",
      },
      requestKey: crypto.randomUUID(),
      website: "",
    }),
  );
  const { state } = await loadState();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      candidates: [
        {
          content: {
            parts: [{ text: "Parking opens 08:00. Loading access unknown." }],
          },
          groundingMetadata: {
            groundingChunks: [
              {
                web: {
                  uri: "https://example.com/parking",
                  title: "Venue parking",
                },
              },
            ],
          },
        },
      ],
    });
  try {
    const response = await research(
      req({ mode: "live", kind: "venue", id: state.orders[0].id }),
    );
    assert.equal(response.status, 200);
    const saved = (await loadState()).state.orders[0];
    assert.equal(saved.details.access, "Customer: use side door");
    assert.equal(
      saved.venueResearch!.sources[0].url,
      "https://example.com/parking",
    );
    assert.match(saved.venueResearch!.text, /Loading access unknown/);
  } finally {
    globalThis.fetch = originalFetch;
    delete env.GEMINI_API_KEY;
  }
});

test("route planning calculates outbound and return legs around the venue stay", async () => {
  resetDB();
  env.GOOGLE_MAPS_API_KEY = "fake-maps-key";
  await submit(
    req({
      details: {
        ...details,
        venue: "Town Hall",
        address: "1 Town Square",
        postcode: "AB1 2CD",
      },
      requestKey: crypto.randomUUID(),
      website: "",
    }),
  );
  const loaded = await loadState();
  loaded.state.settings.kitchen = "10 Kitchen Road";
  await commitState("live", loaded.state, loaded.revision);
  const calls: { origin: { address: string }; destination: { address: string }; departureTime: string }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    calls.push(JSON.parse(String(init?.body)));
    const outbound = calls.length === 1;
    return Response.json({
      routes: [
        {
          distanceMeters: outbound ? 16093.44 : 19312.128,
          duration: outbound ? "1800s" : "2400s",
        },
      ],
    });
  };
  try {
    const departure = new Date(Date.now() + 86400000).toISOString();
    const response = await route(
      req({
        mode: "live",
        orderId: loaded.state.orders[0].id,
        departure,
        returnTrip: true,
        venueDurationMinutes: 120,
        parkingCost: 900,
        otherCost: 250,
      }),
    );
    assert.equal(response.status, 200);
    const saved = (await loadState()).state.orders[0].route!;
    assert.equal(calls.length, 2);
    assert.equal(calls[0].origin.address, "10 Kitchen Road");
    assert.equal(calls[1].origin.address, "1 Town Square AB1 2CD");
    assert.equal(calls[1].destination.address, "10 Kitchen Road");
    assert.equal(
      calls[1].departureTime,
      new Date(Date.parse(departure) + 150 * 60000).toISOString(),
    );
    assert.equal(saved.miles, 22);
    assert.equal(saved.minutes, 70);
    assert.equal(saved.parkingCost, 900);
    assert.equal(saved.otherCost, 250);
    assert.equal(saved.extraCost, 1150);
  } finally {
    globalThis.fetch = originalFetch;
    delete env.GOOGLE_MAPS_API_KEY;
  }
});

test("isolated enquiry-to-invoice, purchasing and packaging walkthrough through revision-checked API", async () => {
  resetDB();
  const { POST: action } = await import("../app/api/admin/action/route");
  const { today } = await import("../lib/domain");
  const { proposals } = await import("../lib/operations");
  async function run(type: string, payload: unknown) {
    const { revision } = await loadState();
    const response = await action(
      req({
        mode: "live",
        revision,
        command: { id: crypto.randomUUID(), type, payload },
      }),
    );
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    return (await loadState()).state;
  }
  await run("supplier", {
    id: "sup",
    name: "Test supplier",
    email: "supplier@example.com",
    phone: "",
    deliveryCharge: 0,
    minimumOrder: 0,
    leadDays: 1,
    notes: "",
  });
  await run("ingredient", {
    id: "rice",
    name: "Rice",
    category: "rice",
    unit: "g",
    packQuantity: 500,
    packCost: 200,
    yield: 1,
    allergens: "None",
    supplierId: "sup",
    threshold: 0,
  });
  await run("recipe", {
    id: "dish",
    name: "Rice bowl",
    variant: "Standard",
    lines: [{ ingredientId: "rice", quantity: 100 }],
    collections: [{ year: 2026, season: "Autumn" }],
  });
  const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  assert.equal(
    (
      await submit(
        req({
          details: {
            ...details,
            date,
            address: "1 Test Road",
            venue: "Test office",
          },
          requestKey: crypto.randomUUID(),
          website: "",
        }),
      )
    ).status,
    201,
  );
  let state = (await loadState()).state;
  const order = state.orders[0];
  assert.match(order.reference, /^EM-\d{4}-\d{6}$/);
  await run("order", {
    orderId: order.id,
    details: order.details,
    items: [{ recipeId: "dish", quantity: 5 }],
  });
  await run("quote", {
    orderId: order.id,
    net: 10000,
    priceMode: "inclusive",
    notes: "Test quote",
  });
  await run("allergy-review", { orderId: order.id, requirements: [] });
  state = await run("stage", { orderId: order.id, status: "confirmed" });
  assert.equal(state.invoices.length, 1);
  assert.equal(state.batches.length, 0);
  const proposal = proposals(state)[0];
  state = await run("procurement-draft", {
    supplierId: "sup",
    to: "supplier@example.com",
    subject: "Test request",
    body: "500g rice",
    fingerprint: proposal.fingerprint,
  });
  const draft = state.drafts[0];
  assert.equal(
    state.purchases.length,
    0,
    "Drafts do not count as incoming stock",
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      request_id: "test-request",
      data: {
        succeeded: 1,
        failed: 0,
        failures: [],
        email_id: "test-provider-only",
      },
    });
  try {
    assert.equal(
      (await send(req({ draftId: draft.id, confirm: true }))).status,
      200,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  state = await run("purchase-confirm", {
    draftId: draft.id,
    eta: today(),
    lines: [{ ingredientId: "rice", quantity: 500, cost: 200 }],
  });
  assert.equal(proposals(state).length, 0);
  state = await run("stock-receive", {
    purchaseId: state.purchases[0].id,
    ingredientId: "rice",
    quantity: 500,
    location: "ambient",
    intake: today(),
    expiry: date,
    dateType: "best-before",
    opened: "",
    frozen: "",
    thawed: "",
    notes: "",
  });
  for (const status of ["ingredients ready", "prepared", "cooked"])
    state = await run("stage", { orderId: order.id, status });
  assert.equal(
    state.batches[0].quantity,
    500,
    "Preparation keeps recorded on-hand stock",
  );
  state = await run("stage", { orderId: order.id, status: "packaged" });
  assert.equal(state.batches[0].quantity, 0);
  const movementCount = state.movements.length;
  state = await run("stage", { orderId: order.id, status: "packaged" });
  assert.equal(state.movements.length, movementCount);
  const invoice = state.invoices[0];
  await run("invoice-edit", {
    ...invoice,
    invoiceId: invoice.id,
    businessAddress: "Test kitchen",
    billingAddress: "Test customer",
    vatNumber: "GB123456789",
  });
  state = await run("invoice-issue", { invoiceId: invoice.id });
  assert.match(state.invoices[0].number, /^INV-/);
  await run("invoice-payment", {
    invoiceId: invoice.id,
    amount: 10000,
    date: today(),
    reference: "walkthrough-payment",
  });
  for (const status of ["ready for delivery", "delivered"])
    state = await run("stage", { orderId: order.id, status });
  assert.equal(
    state.finance.filter((x) => x.invoiceId === invoice.id).length,
    1,
  );
  assert.equal(state.orders[0].status, "delivered");
});

test("concurrent invoice issue cannot reuse numbering or overwrite another issue", async () => {
  resetDB();
  const { sampleState } = await import("../lib/sample");
  const { command } = await import("../lib/server");
  const s = sampleState();
  for (const i of s.invoices) {
    i.businessAddress = "Kitchen";
    i.billingAddress = "Customer";
    i.vatNumber = "GB123456789";
  }
  assert.ok(s.invoices.length >= 2);
  save(s);
  const revision = (await loadState()).revision;
  const commands = s.invoices
    .slice(0, 2)
    .map((i) => ({
      id: crypto.randomUUID(),
      type: "invoice-issue",
      payload: { invoiceId: i.id },
    }));
  const outcomes = await Promise.allSettled(
    commands.map((c) => command("live", c, "test", revision)),
  );
  assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
  const retry = outcomes.findIndex((x) => x.status === "rejected");
  await command("live", commands[retry], "test", (await loadState()).revision);
  const issued = (await loadState()).state.invoices.filter(
    (i) => i.status === "issued",
  );
  assert.equal(issued.length, 2);
  assert.equal(new Set(issued.map((i) => i.number)).size, 2);
});
