import test from "node:test";
import assert from "node:assert/strict";
import { resetDB, sqlite, env } from "./runtime-fixture";
import { emptyState, type State } from "../lib/domain";
import { loadState, commitState, importEnquiries } from "../lib/server";
import { POST as send } from "../app/api/admin/send/route";
import { POST as submit } from "../app/api/enquiries/route";
import { POST as resolve } from "../app/api/admin/delivery/route";
import { runDigest } from "../lib/crm-digest";
import { gemini } from "../lib/integrations";
import type { AutoSousReply } from "../lib/autosous";
import { POST as assistant } from "../app/api/admin/assistant/route";
import { POST as action } from "../app/api/admin/action/route";
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
test("workspace commits reject duplicate and orphaned business records", async () => {
  resetDB();
  const state = emptyState();
  state.customers.push({
    id: "customer",
    name: "Customer",
    company: "",
    email: "customer@example.com",
    phone: "",
    notes: "",
  });
  state.customers.push({ ...state.customers[0] });
  await assert.rejects(commitState("live", state, 0), /duplicate id customer/);
  state.customers.pop();
  state.recipes.push({
    id: "recipe",
    name: "Recipe",
    variant: "Standard",
    lines: [{ ingredientId: "missing", quantity: 1 }],
  });
  await assert.rejects(commitState("live", state, 0), /references missing id/);
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
test("Resend is used when its key is set and failures are not recorded as sent", async () => {
  resetDB();
  draftState();
  env.RESEND_API_KEY = "fake-resend-key";
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({ statusCode: 422, name: "validation_error", message: "Invalid from" }, { status: 422 });
  };
  try {
    const failed = await send(req({ draftId: "draft", confirm: true }));
    assert.equal(failed.status, 400);
    assert.match(((await failed.json()) as { error: string }).error, /Resend rejected the email \(422\): Invalid from/);
    assert.equal(sqlite.prepare("SELECT status FROM email_deliveries WHERE id='draft'").get()?.status, "failed");
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer fake-resend-key");
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.from, "test@example.com");
    assert.deepEqual(body.to, ["supplier@example.com"]);
    assert.equal(typeof body.text, "string");

    resetDB();
    draftState();
    globalThis.fetch = async (input) => {
      calls.push({ url: String(input) });
      return Response.json({ id: "resend-email-1" });
    };
    const sent = await send(req({ draftId: "draft", confirm: true }));
    assert.equal(sent.status, 200);
    assert.equal(((await sent.json()) as { id: string }).id, "resend-email-1");
    assert.equal((await loadState()).state.drafts[0].deliveryStatus, "sent");
  } finally {
    globalThis.fetch = originalFetch;
    delete env.RESEND_API_KEY;
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

test("Gemini sends the supported request shape and removes duplicate citations", async () => {
  env.GEMINI_API_KEY = "fake-gemini-key";
  env.GEMINI_MODEL = "gemini-3.8-flash";
  const originalFetch = globalThis.fetch;
  let request: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init };
    return Response.json({
      candidates: [
        {
          content: { parts: [{ text: "  Answer " }] },
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: "https://example.com/source", title: "Source" } },
              { web: { uri: "https://example.com/source", title: "Duplicate" } },
              { web: { uri: "http://unsafe.example.com", title: "Unsafe" } },
            ],
          },
        },
      ],
    });
  };
  try {
    const result = await gemini("Question", "System", undefined, true);
    assert.match(request!.url, /gemini-3\.8-flash:generateContent$/);
    assert.equal(
      new Headers(request!.init?.headers).get("x-goog-api-key"),
      "fake-gemini-key",
    );
    const body = JSON.parse(String(request!.init?.body));
    assert.equal(body.systemInstruction.parts[0].text, "System");
    assert.equal(body.tools[0].google_search instanceof Object, true);
    assert.equal(result.text, "Answer");
    assert.deepEqual(result.sources, [
      { title: "Source", url: "https://example.com/source" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    delete env.GEMINI_API_KEY;
    delete env.GEMINI_MODEL;
  }
});

test("Gemini retries transient failures and gives actionable setup errors", async () => {
  env.GEMINI_API_KEY = "fake-gemini-key";
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1)
      return new Response("busy", {
        status: 503,
        headers: { "retry-after": "0" },
      });
    return Response.json({
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    });
  };
  try {
    assert.equal((await gemini("Question", "System")).text, "ok");
    assert.equal(calls, 2);
    globalThis.fetch = async () => new Response("missing", { status: 404 });
    await assert.rejects(
      gemini("Question", "System"),
      /Check its model configuration in the deployment environment/,
    );
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

test("new enquiry owner notification carries triage details only", async () => {
  const { notifyOwnerOfEnquiry } = await import("../lib/enquiry-notification");
  const originalFetch = globalThis.fetch;
  const sent: { to: string[]; subject: string; text_body: string; html_body: string }[] = [];
  globalThis.fetch = async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)));
    return Response.json({ data: { succeeded: 1, failed: 0, email_id: "n1" } });
  };
  try {
    const result = await notifyOwnerOfEnquiry({
      reference: "ENQ-TEST",
      details: {
        ...details,
        name: "<b>Sam</b>",
        dietary: "Severe peanut allergy",
        requirements: [{ reference: "Guest A", requirements: "Coeliac", meal: "", reviewed: false }],
      },
      origin: "https://example.test",
    });
    assert.equal(result.status, "sent");
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ["owner@example.com"]);
    assert.match(sent[0].text_body, /https:\/\/example.test\/admin\/orders\?mode=live/);
    assert.ok(!/peanut|Coeliac|Guest A/i.test(JSON.stringify(sent[0])));
    assert.ok(sent[0].html_body.includes("&lt;b&gt;Sam&lt;/b&gt;"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AutoSous answers from records through tools and only proposes changes", async () => {
  resetDB();
  env.GEMINI_API_KEY = "fake-gemini-key";
  env.GEMINI_MODEL = "gemini-3.5-flash-lite";
  await submit(
    req({
      details: { ...details, name: "Dana Lee", company: "Acme Ltd" },
      requestKey: crypto.randomUUID(),
      website: "",
    }),
  );
  const before = await loadState();
  const order = before.state.orders[0];
  const originalFetch = globalThis.fetch;
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    if (bodies.length === 1)
      return Response.json({
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  functionCall: { id: "c1", name: "find_orders", args: { query: "Acme" } },
                  thoughtSignature: "sig-1",
                },
                {
                  functionCall: {
                    id: "c2",
                    name: "propose_follow_up",
                    args: { customer: "Acme", dueDate: "2099-01-05", note: "Check menu choices", order: order.reference },
                  },
                },
                {
                  functionCall: { id: "c3", name: "propose_order_status", args: { order: "EM-0000-404", status: "confirmed" } },
                },
              ],
            },
          },
        ],
      });
    return Response.json({
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: `${order.reference} is a new enquiry. I proposed a follow-up.` }],
          },
        },
      ],
    });
  };
  try {
    const response = await assistant(
      req({ mode: "live", messages: [{ role: "user", text: "What is happening with Acme?" }] }),
    );
    assert.equal(response.status, 200);
    const reply = (await response.json()) as AutoSousReply;
    assert.match(reply.text, /proposed a follow-up/);
    assert.equal(bodies.length, 2);
    // Gemini 3 request shape: function tools, thinking level, no temperature.
    const first = bodies[0] as {
      tools: { functionDeclarations: { name: string }[] }[];
      generationConfig: Record<string, unknown>;
    };
    assert.ok(first.tools[0].functionDeclarations.some((d) => d.name === "order_details"));
    assert.deepEqual(first.generationConfig.thinkingConfig, { thinkingLevel: "medium" });
    assert.equal("temperature" in first.generationConfig, false);
    // The model turn goes back unchanged (thought signatures) with results.
    const second = bodies[1] as { contents: { role: string; parts: Record<string, unknown>[] }[] };
    assert.equal(second.contents[1].role, "model");
    assert.equal(second.contents[1].parts[0].thoughtSignature, "sig-1");
    const results = second.contents[2].parts.map(
      (part) => (part.functionResponse as { id: string; response: { result: Record<string, unknown> } }),
    );
    assert.deepEqual(results.map((r) => r.id), ["c1", "c2", "c3"]);
    assert.equal((results[0].response.result.orders as { reference: string }[])[0].reference, order.reference);
    assert.match(String(results[2].response.result.error), /No order matches/);
    // One valid proposal, nothing saved yet.
    assert.equal(reply.proposals.length, 1);
    assert.equal(reply.proposals[0].type, "crm-follow-up");
    assert.equal(reply.proposals[0].payload.orderId, order.id);
    assert.ok(reply.links.some((l) => l.path === `orders/${order.id}`));
    const after = await loadState();
    assert.equal(after.revision, before.revision);
    assert.equal(after.state.followUps.length, 0);
    // Applying the proposal is the ordinary action API.
    const applied = await action(
      req({
        mode: "live",
        revision: after.revision,
        command: { id: crypto.randomUUID(), type: reply.proposals[0].type, payload: reply.proposals[0].payload },
      }),
    );
    assert.equal(applied.status, 200);
    assert.equal((await loadState()).state.followUps[0].note, "Check menu choices");
  } finally {
    globalThis.fetch = originalFetch;
    delete env.GEMINI_API_KEY;
    delete env.GEMINI_MODEL;
  }
});

test("AutoSous rejects proposals that would fail and reports setup errors", async () => {
  resetDB();
  await submit(
    req({ details, requestKey: crypto.randomUUID(), website: "" }),
  );
  const missing = await assistant(
    req({ mode: "live", messages: [{ role: "user", text: "Hello" }] }),
  );
  assert.equal(missing.status, 503);
  assert.match(((await missing.json()) as { error: string }).error, /setup required/);
  env.GEMINI_API_KEY = "fake-gemini-key";
  const { state } = await loadState();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let toolResult: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    if (calls === 1)
      return Response.json({
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  functionCall: {
                    name: "propose_quote",
                    args: { order: state.orders[0].reference, netPounds: 250 },
                  },
                },
              ],
            },
          },
        ],
      });
    toolResult = body.contents.at(-1).parts[0].functionResponse.response.result;
    return Response.json({
      candidates: [{ content: { parts: [{ text: "Add meals before quoting." }] } }],
    });
  };
  try {
    const response = await assistant(
      req({ mode: "live", messages: [{ role: "user", text: "Quote £250" }] }),
    );
    const reply = (await response.json()) as AutoSousReply;
    assert.equal(response.status, 200);
    assert.equal(reply.proposals.length, 0);
    assert.match(String(toolResult.error), /would be rejected: Add meal quantities first/);
  } finally {
    globalThis.fetch = originalFetch;
    delete env.GEMINI_API_KEY;
  }
});
import { POST as vehicleLookup } from "../app/api/admin/vehicle-lookup/route";
test("number plate lookup maps DVLA data and estimates MPG from CO2", async () => {
  resetDB();
  delete env.DVLA_API_KEY;
  const missing = await vehicleLookup(req({ registration: "AB12 CDE" }));
  assert.equal(missing.status, 400);
  assert.match(((await missing.json()) as { error: string }).error, /not set up/);
  env.DVLA_API_KEY = "fake-dvla-key";
  const originalFetch = globalThis.fetch;
  let sent: { key?: string | null; body?: string } = {};
  globalThis.fetch = async (_input, init) => {
    sent = {
      key: new Headers(init?.headers).get("x-api-key"),
      body: String(init?.body),
    };
    return Response.json({
      registrationNumber: "AB12CDE",
      make: "HYUNDAI",
      colour: "WHITE",
      fuelType: "PETROL",
      engineCapacity: 1591,
      co2Emissions: 147,
      yearOfManufacture: 2018,
      monthOfFirstRegistration: "2018-03",
      motStatus: "Valid",
      motExpiryDate: "2027-03-01",
      taxStatus: "Taxed",
      taxDueDate: "2027-04-01",
    });
  };
  try {
    const r = await vehicleLookup(req({ registration: "ab12 cde" }));
    assert.equal(r.status, 200);
    const { vehicle } = (await r.json()) as {
      vehicle: { registration: string; make: string; fuelType: string; estimatedMpg: number; dvla: { colour: string; motStatus: string } };
    };
    assert.equal(sent.key, "fake-dvla-key");
    assert.deepEqual(JSON.parse(sent.body!), { registrationNumber: "AB12CDE" });
    assert.equal(vehicle.registration, "AB12CDE");
    assert.equal(vehicle.make, "Hyundai");
    assert.equal(vehicle.fuelType, "petrol");
    assert.equal(vehicle.estimatedMpg, 35.5);
    assert.equal(vehicle.dvla.colour, "White");
    assert.equal(vehicle.dvla.motStatus, "Valid");
    globalThis.fetch = async () => Response.json({ errors: [] }, { status: 404 });
    const notFound = await vehicleLookup(req({ registration: "ZZ99 ZZZ" }));
    assert.match(((await notFound.json()) as { error: string }).error, /no vehicle/);
    const bad = await vehicleLookup(req({ registration: "!!" }));
    assert.equal(bad.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
    delete env.DVLA_API_KEY;
  }
});

import { overpass, researchVenue } from "../lib/venue-research";

test("venue map retries stop when the shared lookup budget is exhausted", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    controller.abort(new DOMException("Venue map deadline exceeded", "TimeoutError"));
    return new Response("Busy", { status: 503 });
  };
  try {
    await assert.rejects(overpass("query", "Parking", controller.signal), { name: "TimeoutError" });
    assert.equal(calls, 1, "must not start another server after the deadline");
  } finally { globalThis.fetch = originalFetch; }
});

test("venue context starts before the written report finishes", async () => {
  resetDB();
  env.GEMINI_API_KEY = "fake-gemini-key";
  const originalFetch = globalThis.fetch;
  let finishReport!: () => void;
  let contextStarted!: () => void;
  const report = new Promise<void>((resolve) => { finishReport = resolve; });
  const context = new Promise<void>((resolve) => { contextStarted = resolve; });
  let reportDone = false;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes(":generateContent")) {
      await report;
      reportDone = true;
      return Response.json({ candidates: [{ content: { parts: [{ text: "Venue report" }] } }] });
    }
    if (url.includes("/search?")) return Response.json([{ lat: "51.5", lon: "-0.1", name: "Town Hall", display_name: "1 Town Square" }]);
    if (url.includes("/route/v1/")) {
      assert.equal(reportDone, false);
      contextStarted();
      return Response.json({ routes: [] });
    }
    if (url.includes("/interpreter")) return Response.json({ elements: [] });
    throw Error(`Unexpected request: ${url}`);
  };
  const pending = researchVenue("Town Hall", false, "Kitchen Road");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([context, new Promise((_, reject) => { timer = setTimeout(() => reject(Error("Context waited for the report")), 1000); })]);
  } finally {
    clearTimeout(timer);
    finishReport();
    try { assert.equal((await pending).text, "Venue report"); }
    finally { globalThis.fetch = originalFetch; delete env.GEMINI_API_KEY; }
  }
});

test("venue AI deadline cancels retry backoff before another model is attempted", async () => {
  env.GEMINI_API_KEY = "fake-gemini-key";
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    controller.abort(new DOMException("Venue deadline exceeded", "TimeoutError"));
    return new Response("busy", { status: 503, headers: { "retry-after": "5" } });
  };
  try {
    await assert.rejects(gemini("Venue", "System", undefined, true, controller.signal), { name: "TimeoutError" });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; delete env.GEMINI_API_KEY; }
});
