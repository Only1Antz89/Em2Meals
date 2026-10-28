import test from "node:test";
import assert from "node:assert/strict";
import { applyCommand, emptyState, today, alerts, type State } from "../lib/domain";
import { proposals, sourceFor } from "../lib/operations";
import { supplierOrderView } from "../lib/supplier-link";
import {
  deliveries,
  planningLead,
  supplierPerformance,
  awaitingFeedback,
} from "../lib/supplier-tracking";
import { assertStateIntegrity } from "../lib/state-integrity";

const act = (s: State, type: string, payload: unknown) =>
  applyCommand(s, { id: crypto.randomUUID(), type, payload }, "test-owner");
const shift = (days: number) =>
  new Date(Date.parse(today()) + days * 86400000).toISOString().slice(0, 10);

function supplier(s: State, id: string, leadDays: number) {
  return act(s, "supplier", {
    id,
    name: id === "sup" ? "Produce" : "Fast Foods",
    email: `${id}@example.com`,
    phone: "",
    deliveryCharge: 0,
    minimumOrder: 0,
    leadDays,
    notes: "",
  });
}

// One preferred supplier ("sup") and an order needing 500 g of rice in
// `eventIn` days.
function kitchen(eventIn = 3, leadDays = 1) {
  let s = emptyState();
  s.settings.businessName = "Test Kitchen";
  s = supplier(s, "sup", leadDays);
  s = act(s, "ingredient", {
    id: "rice",
    name: "Rice",
    category: "carbohydrates",
    unit: "g",
    packQuantity: 250,
    packCost: 100,
    yield: 1,
    allergens: "None",
    supplierId: "sup",
    threshold: 0,
  });
  s = act(s, "recipe", {
    id: "dish",
    name: "Rice bowl",
    variant: "Standard",
    lines: [{ ingredientId: "rice", quantity: 100 }],
    collections: [{ year: 2026, season: "Summer" }],
  });
  s = act(s, "order", {
    orderId: "a",
    details: {
      service: "corporate",
      eventType: "Lunch",
      attendees: 5,
      date: shift(eventIn),
      eventTime: "12:00",
      arrivalTime: "11:00",
      requests: "",
      dietary: "",
      requirements: [],
      name: "Client",
      company: "Client Co",
      email: "client@example.com",
      phone: "012345",
      venue: "Office",
      address: "1 Test Road",
      postcode: "",
      access: "",
      unknownDetails: "",
    },
    items: [{ recipeId: "dish", quantity: 5 }],
  });
  s = act(s, "quote", { orderId: "a", net: 10000, notes: "" });
  s = act(s, "allergy-review", { orderId: "a", requirements: [] });
  s = act(s, "stage", { orderId: "a", status: "confirmed" });
  return s;
}

function request(s: State) {
  const p = proposals(s)[0];
  s = act(s, "procurement-draft", {
    supplierId: p.supplierId,
    to: "sup@example.com",
    subject: "Order",
    body: "Rice please",
    fingerprint: p.fingerprint,
  });
  const d = s.drafts.at(-1)!;
  d.sentAt = new Date().toISOString();
  return { s, token: d.supplierLink! };
}

const answer = (token: string, extra: Record<string, unknown> = {}) => ({
  token,
  deliveryDate: shift(1),
  deliveryWindow: "Morning (before 12pm)",
  contactName: "Sam",
  note: "",
  lines: [
    { ingredientId: "rice", available: true, quantity: 500, cost: 240, note: "" },
  ],
  ...extra,
});

function receive(s: State, purchaseId: string, intake: string) {
  const p = s.purchases.find((x) => x.id === purchaseId)!;
  return act(s, "stock-receive", {
    purchaseId,
    ingredientId: p.ingredientId,
    quantity: p.quantity,
    location: "ambient",
    intake,
    expiry: shift(30),
    dateType: "best-before",
    opened: "",
    frozen: "",
    thawed: "",
    notes: "",
  });
}

test("each supplier request gets a private link that shows only the order", () => {
  const { s, token } = request(kitchen());
  assert.match(token, /^[A-Za-z0-9_-]{30,}$/);
  const view = supplierOrderView(s, token)!;
  assert.equal(view.status, "open");
  assert.equal(view.kitchen, "Test Kitchen");
  assert.equal(view.lines[0].name, "Rice");
  assert.equal(view.lines[0].quantity, 500);
  assert.equal(view.lines[0].packs, 2);
  assert.equal(view.lines[0].packSize, 250);
  assert.ok(!JSON.stringify(view).includes("Client Co"));
  assert.equal(supplierOrderView(s, "x".repeat(32)), null);
});

test("supplier confirmation creates incoming deliveries with the promised date", () => {
  const requested = request(kitchen());
  const token = requested.token;
  const s = act(requested.s, "supplier-response", answer(token));
  assertStateIntegrity(s);
  const d = s.drafts[0];
  assert.equal(d.purchaseConfirmed, true);
  assert.equal(d.supplierResponse!.lines[0].status, "confirmed");
  assert.equal(s.purchases.length, 1);
  const p = s.purchases[0];
  assert.equal(p.quantity, 500);
  assert.equal(p.cost, 240);
  assert.equal(p.eta, shift(1));
  assert.equal(p.promisedEta, shift(1));
  assert.equal(p.deliveryWindow, "Morning (before 12pm)");
  assert.equal(p.confirmedVia, "supplier-link");
  assert.deepEqual(p.orderIds, ["a"]);
  assert.equal(proposals(s).length, 0, "Confirmed stock covers the order");
  assert.equal(supplierOrderView(s, token)!.status, "confirmed");
  assert.match(s.suppliers[0].comms.at(-1)!.message, /Confirmed order online/);
});

test("suppliers can change quantities, move the date, or say an item is unavailable", () => {
  const requested = request(kitchen());
  const token = requested.token;
  let s = act(requested.s, "supplier-response", answer(token));
  s = act(
    s,
    "supplier-response",
    answer(token, {
      deliveryDate: shift(2),
      lines: [
        { ingredientId: "rice", available: true, quantity: 250, cost: 120, note: "Only one bag left" },
      ],
    }),
  );
  let p = s.purchases[0];
  assert.equal(s.purchases.length, 1, "Updates change the same delivery");
  assert.equal(p.quantity, 250);
  assert.equal(p.eta, shift(2));
  assert.equal(p.promisedEta, shift(1), "The first promise is kept for tracking");
  assert.equal(s.drafts[0].supplierResponse!.lines[0].status, "changed");
  assert.equal(s.drafts[0].supplierResponse!.updates, 1);
  assert.equal(proposals(s)[0].lines[0].required, 250, "The shortfall reappears");
  assert.ok(alerts(s).some((a) => /changed your order/.test(a.title)));
  s = act(
    s,
    "supplier-response",
    answer(token, {
      lines: [{ ingredientId: "rice", available: false, quantity: 0, cost: 0, note: "Out of stock" }],
    }),
  );
  assert.equal(s.purchases.length, 0);
  assert.equal(s.drafts[0].supplierResponse!.lines[0].status, "unavailable");
  s = act(s, "supplier-response", answer(token));
  p = s.purchases[0];
  assert.equal(p.quantity, 500);
});

test("supplier answers are checked", () => {
  const requested = request(kitchen());
  const token = requested.token;
  let s = requested.s;
  assert.throws(() => act(s, "supplier-response", answer("y".repeat(32))), /not valid/);
  assert.throws(
    () => act(s, "supplier-response", answer(token, { deliveryDate: shift(-1) })),
    /from today/,
  );
  assert.throws(
    () => act(s, "supplier-response", answer(token, { lines: [] })),
  );
  assert.throws(
    () =>
      act(
        s,
        "supplier-response",
        answer(token, {
          lines: [{ ingredientId: "rice", available: true, quantity: 0, cost: 0, note: "" }],
        }),
      ),
    /quantity/,
  );
  s = act(s, "supplier-response", answer(token));
  s = receive(s, s.purchases[0].id, today());
  assert.throws(() => act(s, "supplier-response", answer(token)), /already been received/);
  assert.equal(supplierOrderView(s, token)!.status, "received");
});

test("closed and kitchen-recorded requests cannot be changed from the link", () => {
  let { s, token } = request(kitchen());
  s = act(s, "draft-close", { draftId: s.drafts[0].id });
  assert.equal(supplierOrderView(s, token)!.status, "cancelled");
  assert.throws(() => act(s, "supplier-response", answer(token)), /cancelled/);
  ({ s, token } = request(s));
  s = act(s, "purchase-confirm", {
    draftId: s.drafts.at(-1)!.id,
    eta: shift(1),
    lines: [{ ingredientId: "rice", quantity: 500, cost: 200 }],
  });
  assert.equal(supplierOrderView(s, token)!.status, "recorded");
  assert.throws(() => act(s, "supplier-response", answer(token)), /already recorded/);
});

test("received deliveries teach Em2 the supplier's real lead time", () => {
  let s = kitchen(20, 1);
  assert.equal(planningLead(s, "sup").source, "supplier");
  for (const received of [3, 4]) {
    s = act(s, "purchase", {
      supplierId: "sup",
      ingredientId: "rice",
      quantity: 250,
      cost: 100,
      eta: shift(1),
      notes: "",
    });
    const p = s.purchases.at(-1)!;
    p.orderedOn = shift(-10);
    p.promisedEta = shift(-9);
    s = receive(s, p.id, shift(-10 + received));
  }
  const history = deliveries(s, "sup");
  assert.equal(history.length, 2);
  assert.deepEqual(history.map((d) => d.leadDays).sort(), [3, 4]);
  assert.equal(history.every((d) => !d.onTime), true);
  const perf = supplierPerformance(s, "sup");
  assert.equal(perf.onTimeRate, 0);
  const lead = planningLead(s, "sup");
  assert.equal(lead.source, "learned");
  // Median 3.5 days, rounded up, plus 2.5 days typical lateness rounded up.
  assert.equal(lead.days, 4 + 3);
  assert.equal(awaitingFeedback(s).length, 2, "Recent deliveries ask for feedback");
});

test("delivery feedback can overrule the dates and pushes order-by dates earlier", () => {
  let s = kitchen(20, 1);
  for (let i = 0; i < 2; i++) {
    s = act(s, "purchase", {
      supplierId: "sup",
      ingredientId: "rice",
      quantity: 100,
      cost: 40,
      eta: shift(0),
      notes: "",
    });
    const p = s.purchases.at(-1)!;
    p.orderedOn = shift(-2);
    s = receive(s, p.id, shift(0));
  }
  assert.equal(awaitingFeedback(s).length, 2);
  assert.ok(alerts(s).some((a) => a.title === "Rate recent deliveries"));
  assert.throws(
    () =>
      act(s, "delivery-feedback", {
        purchaseIds: ["missing"],
        arrival: "late",
        orderedInTime: "yes",
      }),
    /received/,
  );
  const deadlineBefore = proposals(s)[0].lines[0].deadline;
  s = act(s, "delivery-feedback", {
    purchaseIds: [s.purchases[0].id],
    arrival: "late",
    orderedInTime: "tight",
    note: "Came after lunch service",
  });
  assert.equal(s.purchases[0].deliveryFeedback?.arrival, "late");
  assert.equal(awaitingFeedback(s).length, 1);
  const perf = supplierPerformance(s, "sup");
  assert.equal(perf.onTimeRate, 0.5);
  assert.equal(perf.tightOrders, 1);
  const lead = planningLead(s, "sup");
  assert.equal(lead.orderBuffer, 1);
  assert.ok(proposals(s)[0].lines[0].deadline < deadlineBefore);
});

test("purchasing keeps the preferred supplier unless it can't deliver in time", () => {
  let s = kitchen(3, 1);
  s = supplier(s, "fast", 0);
  s = act(s, "offering", {
    ingredientId: "rice",
    supplierId: "fast",
    packQuantity: 500,
    packCost: 300,
    vatRate: 0,
    priceMode: "exclusive",
    preferred: false,
  });
  assert.equal(proposals(s)[0].supplierId, "sup", "Preferred and in time");
  s.suppliers.find((x) => x.id === "sup")!.leadDays = 5;
  const [p] = proposals(s);
  assert.equal(p.supplierId, "fast");
  assert.equal(p.lines[0].switchedFrom, "sup");
  assert.equal(p.lines[0].packs, 1, "Uses the faster supplier's pack size");
  s.suppliers.find((x) => x.id === "fast")!.leadDays = 9;
  const late = sourceFor(s, "rice", shift(3));
  assert.equal(late.supplierId, "sup", "Nobody can make it: stay with preferred");
  assert.equal(late.switchedFrom, undefined);
});

test("order-by reminders appear once the deadline arrives", () => {
  const s = kitchen(1, 1);
  assert.ok(alerts(s).some((a) => a.title === "Order from Produce now"));
  const { s: requested } = request(s);
  assert.ok(!alerts(requested).some((a) => a.title === "Order from Produce now"));
});
