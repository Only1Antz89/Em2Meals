import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  recipeCost,
  recipeCurrentCost,
  ingredientPrice,
  normaliseRecipeMeasurement,
  fuelCost,
  recap,
  available,
  needs,
  emptyState,
  enquirySchema,
  today,
} from "../lib/domain";
import { sampleState } from "../lib/sample";
import { customerCrm, customerActivities } from "../lib/crm";
const act = (s: any, type: string, payload: any, id = crypto.randomUUID()) =>
  applyCommand(s, { id, type, payload }, "test-owner");
test("sample scenario includes a completed lunch, assigned allergy, shortage and waste", () => {
  const s = sampleState();
  assert.equal(s.orders[0].status, "delivered");
  assert.equal(s.orders[0].details.requirements[0].meal, "burger-plain");
  assert.equal(s.orders[1].status, "ingredients needed");
  assert.equal(s.waste[0].quantity, 2);
  assert.equal(s.suppliers.length, 4);
  assert.ok(s.suppliers.every((supplier) => supplier.website?.startsWith("https://")));
});
test("CRM classifies repeat, stalled and quiet relationships at exact boundaries", () => {
  const s = emptyState();
  s.customers.push({
    id: "client",
    name: "Client",
    company: "Client Co",
    email: "client@example.com",
    phone: "",
    notes: "",
  });
  const base = {
    reference: "EM-CRM",
    customerId: "client",
    details: {
      service: "corporate",
      eventType: "Lunch",
      attendees: 10,
      date: "2026-10-01",
      eventTime: "",
      arrivalTime: "",
      requests: "",
      dietary: "",
      requirements: [],
      name: "Client",
      company: "Client Co",
      email: "client@example.com",
      phone: "",
      venue: "",
      address: "",
      postcode: "",
      access: "",
      unknownDetails: "",
    },
    items: [],
    quotes: [],
    allergyReviewed: false,
    consumed: false,
    reservations: [],
  };
  s.orders.push({
    ...structuredClone(base),
    id: "enquiry",
    createdAt: "2026-09-13T12:00:00.000Z",
    status: "enquiry",
  });
  assert.equal(customerCrm(s, "client", "2026-09-15")?.stage, "Active");
  s.orders[0].createdAt = "2026-09-12T12:00:00.000Z";
  assert.equal(customerCrm(s, "client", "2026-09-15")?.stage, "Enquiry stalled");
  s.orders[0].status = "quote";
  s.orders[0].quotes = [{ version: 1, net: 1000, vat: 200, vatRate: 20, total: 1200, notes: "", at: "2026-09-09T12:00:00.000Z" }];
  assert.equal(customerCrm(s, "client", "2026-09-15")?.stage, "Active");
  s.orders[0].quotes[0].at = "2026-09-08T12:00:00.000Z";
  assert.equal(customerCrm(s, "client", "2026-09-15")?.stage, "Quote stalled");
  s.orders = [
    { ...structuredClone(base), id: "done-1", status: "delivered", createdAt: "2026-01-01T12:00:00.000Z", statusHistory: [{ status: "delivered", at: "2026-06-18T12:00:00.000Z" }] },
    { ...structuredClone(base), id: "done-2", status: "delivered", createdAt: "2026-02-01T12:00:00.000Z", statusHistory: [{ status: "delivered", at: "2026-06-18T12:00:00.000Z" }] },
  ];
  assert.equal(customerCrm(s, "client", "2026-09-15")?.stage, "Past client");
  s.orders.forEach((order) => (order.statusHistory![0].at = "2026-06-17T12:00:00.000Z"));
  s.finance.push({ id: "paid", type: "income", amount: 43210, category: "Catering", description: "Paid event", date: "2026-06-17", orderId: "done-1" });
  const quiet = customerCrm(s, "client", "2026-09-15")!;
  assert.equal(quiet.stage, "Quiet");
  assert.equal(quiet.repeat, true);
  assert.equal(quiet.lifetimeValue, 43210);
});
test("CRM calendar boundaries use Europe/London rather than UTC dates", () => {
  const s = emptyState();
  s.customers.push({ id: "client", name: "Client", company: "", email: "client@example.com", phone: "", notes: "" });
  s.orders.push({
    id: "order",
    reference: "EM-TZ",
    customerId: "client",
    createdAt: "2026-09-12T23:30:00.000Z",
    status: "enquiry",
    details: { service: "corporate", eventType: "Lunch", attendees: 10, date: "", eventTime: "", arrivalTime: "", requests: "", dietary: "", requirements: [], name: "Client", company: "", email: "client@example.com", phone: "", venue: "", address: "", postcode: "", access: "", unknownDetails: "" },
    items: [], quotes: [], allergyReviewed: false, consumed: false, reservations: [],
  });
  assert.equal(customerCrm(s, "client", "2026-09-15")?.stage, "Active");
  assert.equal(customerCrm(s, "client", "2026-09-16")?.stage, "Enquiry stalled");
});
test("CRM follow-ups suppress lifecycle attention and activities sort newest first", () => {
  let s = emptyState();
  s.customers.push({ id: "a", name: "A", company: "", email: "a@example.com", phone: "", notes: "" });
  s = act(s, "crm-engagement", {
    customerId: "a",
    type: "call",
    direction: "outbound",
    summary: "First call",
    occurredAt: "2026-09-10T10:00:00.000Z",
  });
  s = act(s, "crm-engagement", {
    customerId: "a",
    type: "email",
    direction: "inbound",
    summary: "Latest reply",
    occurredAt: "2026-09-11T10:00:00.000Z",
  });
  s = act(s, "crm-follow-up", {
    customerId: "a",
    dueDate: "2026-09-20",
    note: "Call again",
    status: "open",
  });
  assert.equal(customerActivities(s, "a")[0].detail, "Latest reply");
  assert.equal(customerCrm(s, "a", "2026-09-15")?.nextFollowUp?.note, "Call again");
  const id = s.followUps[0].id;
  s = act(s, "crm-follow-up", { ...s.followUps[0], id, status: "completed" });
  assert.ok(s.followUps[0].completedAt);
  s = act(s, "crm-follow-up", { ...s.followUps[0], dueDate: "2026-09-25", status: "open" });
  assert.equal(s.followUps[0].dueDate, "2026-09-25");
  assert.equal(s.followUps[0].completedAt, undefined);
  s = act(s, "crm-follow-up", { ...s.followUps[0], status: "cancelled" });
  assert.equal(s.followUps[0].status, "cancelled");
});
test("CRM commands reject missing customers and cross-customer order links", () => {
  const s = emptyState();
  s.customers.push(
    { id: "a", name: "A", company: "", email: "a@example.com", phone: "", notes: "" },
    { id: "b", name: "B", company: "", email: "b@example.com", phone: "", notes: "" },
  );
  s.orders.push({
    id: "order-a", reference: "EM-A", customerId: "a", status: "enquiry",
    details: { service: "corporate", eventType: "Lunch", attendees: 10, date: "", eventTime: "", arrivalTime: "", requests: "", dietary: "", requirements: [], name: "A", company: "", email: "a@example.com", phone: "", venue: "", address: "", postcode: "", access: "", unknownDetails: "" },
    items: [], quotes: [], allergyReviewed: false, consumed: false, reservations: [],
  });
  assert.throws(() => act(s, "crm-engagement", { customerId: "missing", type: "call", direction: "outbound", summary: "Hello", occurredAt: "2026-09-15T12:00:00.000Z" }), /Customer not found/);
  assert.throws(() => act(s, "crm-follow-up", { customerId: "b", orderId: "order-a", dueDate: "2026-09-20", note: "Call", status: "open" }), /does not belong/);
});
test("recipe variant cost includes gross ingredient yield", () => {
  const s = sampleState();
  const seeded = s.recipes.find((r) => r.id === "burger-seeded")!,
    plain = s.recipes.find((r) => r.id === "burger-plain")!;
  assert.ok(recipeCost(s, seeded) > recipeCost(s, plain));
  const lettuce = s.ingredients.find((ingredient) => ingredient.id === "lettuce")!;
  const costWithYield = recipeCost(s, plain);
  lettuce.yield = 1;
  assert.ok(recipeCost(s, plain) < costWithYield);
});
test("recipe measurements normalize metric and flag ingredient-specific units", () => {
  assert.equal(normaliseRecipeMeasurement(1.2, "kg", "g"), 1200);
  assert.equal(normaliseRecipeMeasurement(2, "tbsp", "ml"), 30);
  assert.equal(normaliseRecipeMeasurement(1, "cup", "ml"), 250);
  assert.equal(normaliseRecipeMeasurement(2, "clove", "g"), null);
  assert.equal(normaliseRecipeMeasurement(2, "clove", "g", 4), 8);
  assert.equal(normaliseRecipeMeasurement(1, "kg", "ml"), null);
});
test("current recipe cost prefers confirmed purchase history", () => {
  const s = sampleState();
  const recipe = s.recipes.find((item) => item.id === "burger-seeded")!;
  assert.equal(ingredientPrice(s, "beef").source, "purchase");
  assert.ok(Math.abs(recipeCurrentCost(s, recipe) - 285) < 1);
});
test("atomic recipe saves create reviewed ingredients and drafts stay off orders", () => {
  let s = emptyState();
  s = act(s, "recipe-save", {
    ingredients: [{ id: "new-herb", name: "New herb", category: "herbs", unit: "g", packQuantity: 100, packCost: 200, yield: 1, allergens: "", supplierId: "", threshold: 0 }],
    recipe: { id: "draft-recipe", name: "Herb dish", variant: "Test", createdAt: today(), status: "draft", instructions: "1. Cook.", lines: [{ ingredientId: "new-herb", quantity: 5, displayQuantity: 1, displayUnit: "tsp", conversionConfirmed: true }] },
  });
  assert.equal(s.ingredients.length, 1);
  assert.equal(s.recipes[0].status, "draft");
  assert.throws(() => act(s, "order", { details: { service: "corporate", eventType: "Lunch", attendees: 1, date: today(), eventTime: "12:00", arrivalTime: "11:30", requests: "", dietary: "", requirements: [], name: "A", company: "", email: "a@example.com", phone: "12345", venue: "Kitchen", address: "London", postcode: "SE1", access: "", unknownDetails: "" }, items: [{ recipeId: "draft-recipe", quantity: 1 }] }), /draft/);
});
test("UK gallon fuel conversion and missing economy", () => {
  assert.equal(fuelCost(100, 40, 1.5), 1705);
  assert.equal(fuelCost(10, 0, 1.5), null);
  assert.equal(fuelCost(10, 40, 0), null);
});
test("cost snapshots survive supplier changes", () => {
  const s = sampleState();
  const original = s.orders[0].costSnapshot!.total;
  const changed = act(s, "ingredient", {
    ...s.ingredients[0],
    packCost: 50000,
  });
  assert.equal(changed.orders[0].costSnapshot!.total, original);
});
test("shortage prevents preparation and repeated consumption", () => {
  const s = sampleState();
  assert.throws(
    () =>
      act(s, "stage", {
        orderId: "sample-upcoming",
        status: "ingredients ready",
      }),
    /Insufficient/,
  );
  const closed = act(s, "stage", {
    orderId: "sample-upcoming",
    status: "cancelled",
  });
  assert.equal(closed.orders[1].reservations.length, 0);
  assert.throws(
    () =>
      act(closed, "stage", { orderId: "sample-upcoming", status: "enquiry" }),
    /closed/,
  );
  assert.equal(
    act(s, "stage", { orderId: "sample-delivered", status: "delivered" })
      .movements.length,
    s.movements.length,
  );
});
test("stock cancellation releases reservations but not consumed ingredients", () => {
  const s = sampleState(),
    before = s.batches.map((b) => b.quantity);
  const next = act(s, "stage", {
    orderId: "sample-upcoming",
    status: "cancelled",
  });
  assert.deepEqual(
    next.batches.map((b) => b.quantity),
    before,
  );
  assert.ok(next.batches.every((b) => available(next, b.id) >= 0));
});
test("command retries are idempotent", () => {
  let s = sampleState();
  const id = crypto.randomUUID();
  const p = {
    type: "expense",
    amount: 100,
    date: today(),
    category: "test",
    description: "test",
    orderId: "",
  };
  s = act(s, "finance", p, id);
  const n = s.finance.length;
  s = act(s, "finance", p, id);
  assert.equal(s.finance.length, n);
});
test("client recap excludes private costs and unrelated customers", () => {
  const s = sampleState();
  const report = recap(s, s.orders[0].customerId, "2000-01-01", "2099-12-31");
  assert.equal(report.portions, 30);
  assert.equal(report.wasteKg, 0.5);
  assert.equal(report.unservedPortions, 2);
  assert.ok(!JSON.stringify(report).includes("packCost"));
  assert.ok(!JSON.stringify(report).includes("costSnapshot"));
  s.customers.push({
    id: "unrelated",
    name: "Other",
    company: "Other",
    email: "other@example.com",
    phone: "",
    notes: "",
  });
  assert.equal(recap(s, "unrelated", "2000-01-01", "2099-12-31").portions, 0);
});
test("recording unserved portions does not consume stock again", () => {
  const s = sampleState();
  const before = s.batches.map((b) => b.quantity);
  const next = act(s, "waste", {
    orderId: "sample-delivered",
    ingredientId: "",
    recipeId: "burger-plain",
    batchId: "",
    category: "unserved portions",
    quantity: 1,
    unit: "portions",
    weightGrams: 250,
    reason: "Guest absent",
    date: today(),
  });
  assert.deepEqual(
    next.batches.map((b) => b.quantity),
    before,
  );
  assert.throws(
    () => act(s, "waste", { ...s.waste[0], quantity: 100 }),
    /exceeds/,
  );
});
test("allergy review and accepted quote required before confirmation", () => {
  let s = sampleState();
  const d = {
    ...s.orders[0].details,
    requirements: [
      {
        reference: "Guest B",
        requirements: "Nut allergy",
        meal: "",
        reviewed: false,
      },
    ],
  };
  s = act(s, "order", {
    orderId: "new",
    details: d,
    items: [{ recipeId: "burger-plain", quantity: 2 }],
  });
  s = act(s, "quote", { orderId: "new", net: 2000, notes: "" });
  assert.throws(
    () => act(s, "stage", { orderId: "new", status: "confirmed" }),
    /allergy review/,
  );
  assert.throws(
    () => act(s, "allergy-review", { orderId: "new", requirements: [] }),
    /every attendee/,
  );
});
test("enquiry validation rejects invalid counts, dates and email", () => {
  const d = sampleState().orders[0].details;
  assert.equal(enquirySchema.safeParse({ ...d, attendees: 0 }).success, false);
  assert.equal(
    enquirySchema.safeParse({ ...d, date: "2026-02-31" }).success,
    false,
  );
  assert.equal(
    enquirySchema.safeParse({ ...d, email: "no-email" }).success,
    false,
  );
});
test("active-order ingredient handling cannot change underneath its confirmed quantities", () => {
  const s = sampleState();
  assert.throws(
    () => act(s, "ingredient", { ...s.ingredients[0], yield: 0.5 }),
    /confirmed order/,
  );
  assert.throws(
    () => act(s, "ingredient", { ...s.ingredients[0], allergens: "Milk" }),
    /confirmed order/,
  );
});
test("dated stock resolves shortage; preparation reserves and packaging consumes once", () => {
  let s = sampleState();
  const future = new Date(Date.now() + 10 * 86400000)
    .toISOString()
    .slice(0, 10);
  s = act(s, "stock-receive", {
    ingredientId: "beef",
    quantity: 5000,
    location: "fridge",
    intake: today(),
    expiry: "",
    dateType: "use-by",
    opened: "",
    frozen: "",
    thawed: "",
    notes: "",
  });
  assert.throws(
    () =>
      act(s, "stage", {
        orderId: "sample-upcoming",
        status: "ingredients ready",
      }),
    /Insufficient/,
  );
  const batch = s.batches.at(-1)!;
  s = act(s, "stock-adjust", {
    batchId: batch.id,
    quantity: 5000,
    location: "fridge",
    expiry: future,
    opened: "",
    frozen: "",
    thawed: "",
    reason: "Verified label date",
  });
  s = act(s, "stage", {
    orderId: "sample-upcoming",
    status: "ingredients ready",
  });
  s = act(s, "stage", { orderId: "sample-upcoming", status: "prepared" });
  const quantities = s.batches.map((b) => b.quantity);
  s = act(s, "stage", { orderId: "sample-upcoming", status: "prepared" });
  assert.deepEqual(
    s.batches.map((b) => b.quantity),
    quantities,
  );
  assert.equal(
    s.orders.find((o) => o.id === "sample-upcoming")!.consumed,
    false,
  );
  assert.throws(
    () => act(s, "stage", { orderId: "sample-upcoming", status: "cancelled" }),
    /Reconcile/,
  );
  s = act(s, "stage", { orderId: "sample-upcoming", status: "cooked" });
  assert.deepEqual(
    s.batches.map((b) => b.quantity),
    quantities,
  );
  s = act(s, "stage", { orderId: "sample-upcoming", status: "packaged" });
  assert.equal(
    s.orders.find((o) => o.id === "sample-upcoming")!.consumed,
    true,
  );
  assert.ok(s.batches.some((b, index) => b.quantity < quantities[index]));
  const after = s.batches.map((b) => b.quantity);
  s = act(s, "stage", { orderId: "sample-upcoming", status: "packaged" });
  assert.deepEqual(
    s.batches.map((b) => b.quantity),
    after,
  );
});

import {
  normaliseState,
  tax,
  expiryStatus,
  proposals,
  draftCurrent,
  shortage,
  invoiceText,
} from "../lib/operations";
function fixture(stock = 1000) {
  let s = emptyState();
  s = act(s, "supplier", {
    id: "sup",
    name: "Produce",
    email: "sales@example.com",
    phone: "",
    deliveryCharge: 100,
    minimumOrder: 0,
    leadDays: 1,
    notes: "",
  });
  s = act(s, "ingredient", {
    id: "rice",
    name: "Rice",
    category: "rice",
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
  const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  if (stock)
    s = act(s, "stock-receive", {
      ingredientId: "rice",
      quantity: stock,
      location: "ambient",
      intake: today(),
      expiry: date,
      dateType: "best-before",
      opened: "",
      frozen: "",
      thawed: "",
      notes: "",
    });
  return s;
}
function addOrder(
  s: ReturnType<typeof fixture>,
  id: string,
  qty = 5,
  accept = true,
) {
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  s = act(s, "order", {
    orderId: id,
    details: {
      service: "corporate",
      eventType: "Lunch",
      attendees: qty,
      date,
      eventTime: "12:00",
      arrivalTime: "11:00",
      requests: "Rice",
      dietary: "",
      requirements: [],
      name: "Owner",
      company: "Team",
      email: "client@example.com",
      phone: "012345",
      venue: "Office",
      address: "1 Test Road",
      postcode: "",
      access: "",
      unknownDetails: "",
    },
    items: [{ recipeId: "dish", quantity: qty }],
  });
  if (accept) {
    s = act(s, "quote", { orderId: id, net: 10000, notes: "" });
    s = act(s, "allergy-review", { orderId: id, requirements: [] });
    s = act(s, "stage", { orderId: id, status: "confirmed" });
  }
  return s;
}
test("exclusive and inclusive VAT share integer totals, including rounding", () => {
  assert.deepEqual(tax(10000, 20, "exclusive"), {
    net: 10000,
    vat: 2000,
    total: 12000,
  });
  assert.deepEqual(tax(12000, 20, "inclusive"), {
    net: 10000,
    vat: 2000,
    total: 12000,
  });
  assert.deepEqual(tax(999, 20, "inclusive"), {
    net: 833,
    vat: 166,
    total: 999,
  });
  assert.deepEqual(tax(100, 0, "exclusive"), { net: 100, vat: 0, total: 100 });
});
test("expiry labels distinguish date types and month boundaries", () => {
  assert.equal(expiryStatus("2026-09-17", "use-by", "2026-09-14").tone, "red");
  assert.equal(
    expiryStatus("2026-09-17", "best-before", "2026-09-14").tone,
    "amber",
  );
  assert.equal(
    expiryStatus("2026-09-14", "use-by", "2026-09-14").label,
    "Due today",
  );
  assert.match(
    expiryStatus("2026-09-13", "best-before", "2026-09-14").label,
    /Best-before passed/,
  );
  assert.equal(
    expiryStatus("2026-11-16", "best-before", "2026-09-14").label,
    "2 months, 2 days remaining",
  );
  assert.equal(
    expiryStatus("2026-03-01", "best-before", "2026-01-31").label,
    "29 days remaining",
  );
  assert.equal(expiryStatus("", "use-by").tone, "amber");
});
test("migration is repeatable and preserves legacy consumed orders and totals", () => {
  const s = fixture();
  const legacy = JSON.parse(JSON.stringify(s));
  delete legacy.schemaVersion;
  delete legacy.offerings;
  delete legacy.invoices;
  delete legacy.sequences;
  legacy.orders = [
    {
      ...sampleState().orders[0],
      status: "cooked",
      consumed: true,
      reservations: [],
    },
  ];
  const upgraded = normaliseState(legacy);
  assert.equal(upgraded.offerings.length, 1);
  assert.equal(upgraded.orders[0].consumed, true);
  assert.deepEqual(normaliseState(structuredClone(upgraded)), upgraded);
  const packaged = act(upgraded, "stage", {
    orderId: upgraded.orders[0].id,
    status: "packaged",
  });
  assert.deepEqual(packaged.batches, upgraded.batches);
  assert.deepEqual(packaged.movements, upgraded.movements);
});
test("accepted quantities are frozen and tentative demand never reserves", () => {
  let s = addOrder(fixture(600), "a");
  s = addOrder(s, "b", 3, false);
  assert.equal(s.batches[0].quantity, 600);
  assert.equal(available(s, s.batches[0].id), 100);
  assert.equal(s.orders[1].reservations.length, 0);
  assert.equal(shortage(s, s.orders[1])[0].shortage, 200);
  s.recipes[0].lines[0].quantity = 999;
  assert.equal(needs(s, s.orders[0]).rice, 500);
  assert.equal(s.invoices.length, 1);
  assert.match(s.orders[0].reference, /^EM-\d{4}-000001$/);
  assert.match(s.orders[1].reference, /000002$/);
});
test("stock receipts allocate accepted deficits without advancing or reversing stages", () => {
  let s = addOrder(fixture(400), "a");
  s.orders[0].status = "cooked";
  s = act(s, "stock-receive", {
    ingredientId: "rice",
    quantity: 100,
    location: "ambient",
    intake: today(),
    expiry: s.orders[0].details.date,
    dateType: "best-before",
    opened: "",
    frozen: "",
    thawed: "",
    notes: "",
  });
  assert.equal(s.orders[0].status, "cooked");
  assert.equal(
    s.orders[0].reservations.reduce((n, r) => n + r.quantity, 0),
    500,
  );
  s = act(s, "stage", { orderId: "a", status: "packaged" });
  assert.equal(
    s.batches.reduce((n, b) => n + b.quantity, 0),
    0,
  );
});
test("actual extra usage reserves more stock and packaging deducts once", () => {
  let s = addOrder(fixture(1000), "a");
  s = act(s, "usage", {
    orderId: "a",
    ingredientId: "rice",
    quantity: 650,
    reason: "Extra rice after an accident",
  });
  assert.equal(s.batches[0].quantity, 1000);
  assert.equal(available(s, s.batches[0].id), 350);
  for (const status of ["ingredients ready", "prepared", "cooked", "packaged"])
    s = act(s, "stage", { orderId: "a", status });
  assert.equal(s.batches[0].quantity, 350);
  assert.equal(s.movements.filter((m) => m.orderId === "a").length, 1);
  assert.throws(
    () =>
      act(s, "usage", {
        orderId: "a",
        ingredientId: "rice",
        quantity: 700,
        reason: "Too late",
      }),
    /unpackaged/,
  );
});
test("prepared cancellation requires exact reconciliation and releases unused stock", () => {
  let s = addOrder(fixture(), "a");
  for (const status of ["ingredients ready", "prepared"])
    s = act(s, "stage", { orderId: "a", status });
  assert.throws(
    () => act(s, "stage", { orderId: "a", status: "cancelled" }),
    /Reconcile/,
  );
  assert.throws(
    () =>
      act(s, "cancel-reconcile", {
        orderId: "a",
        reason: "Cancelled event",
        used: [],
      }),
    /every ingredient/,
  );
  s = act(s, "cancel-reconcile", {
    orderId: "a",
    reason: "Cancelled after prep",
    used: [{ ingredientId: "rice", quantity: 200 }],
  });
  assert.equal(s.batches[0].quantity, 800);
  assert.equal(s.orders[0].reservations.length, 0);
  assert.equal(s.orders[0].status, "cancelled");
});
test("spoiled reservations expose shortage without rewinding cooked order", () => {
  let s = addOrder(fixture(500), "a");
  s.orders[0].status = "cooked";
  s = act(s, "waste", {
    orderId: "",
    ingredientId: "rice",
    recipeId: "",
    batchId: s.batches[0].id,
    category: "spoilage",
    quantity: 100,
    unit: "g",
    weightGrams: 100,
    reason: "Damaged stock",
    date: today(),
  });
  assert.equal(s.orders[0].status, "cooked");
  assert.equal(proposals(s)[0].lines[0].required, 100);
  assert.throws(
    () => act(s, "stage", { orderId: "a", status: "packaged" }),
    /Insufficient/,
  );
});
test("combined purchasing aggregates accepted orders and rounds packs", () => {
  let s = addOrder(fixture(100), "a", 3);
  s = addOrder(s, "b", 4);
  s = addOrder(s, "tentative", 9, false);
  const [p] = proposals(s);
  assert.equal(p.lines[0].required, 600);
  assert.equal(p.lines[0].packs, 3);
  assert.equal(p.lines[0].quantity, 750);
  assert.equal(p.lines[0].cost, 300);
  assert.equal(p.total, null);
  s = act(s, "offering", { ...s.offerings[0], vatRate: 20 });
  assert.equal(proposals(s)[0].total, 460);
});
test("incoming purchases are allocated once, partial receipts remain outstanding", () => {
  let s = addOrder(fixture(0), "a", 3);
  s = addOrder(s, "b", 3);
  s = act(s, "purchase", {
    supplierId: "sup",
    ingredientId: "rice",
    quantity: 400,
    cost: 160,
    eta: today(),
    notes: "Confirmed",
  });
  assert.equal(proposals(s)[0].lines[0].required, 200);
  const po = s.purchases[0];
  s = act(s, "stock-receive", {
    purchaseId: po.id,
    ingredientId: "rice",
    quantity: 150,
    location: "ambient",
    intake: today(),
    expiry: s.orders[0].details.date,
    dateType: "best-before",
    opened: "",
    frozen: "",
    thawed: "",
    notes: "Partial delivery",
  });
  assert.equal(s.purchases[0].receivedQuantity, 150);
  assert.equal(s.purchases[0].status, "ordered");
  assert.equal(proposals(s)[0].lines[0].required, 200);
  assert.throws(
    () =>
      act(s, "stock-receive", {
        purchaseId: po.id,
        ingredientId: "rice",
        quantity: 251,
        location: "ambient",
        intake: today(),
        expiry: s.orders[0].details.date,
        dateType: "best-before",
        opened: "",
        frozen: "",
        thawed: "",
        notes: "",
      }),
    /outstanding/,
  );
});
test("late and overdue purchases do not hide demand", () => {
  let s = addOrder(fixture(0), "a", 3);
  for (const eta of ["2000-01-01", "2099-01-01"])
    s = act(s, "purchase", {
      supplierId: "sup",
      ingredientId: "rice",
      quantity: 400,
      cost: 160,
      eta,
      notes: "Delivery estimate",
    });
  assert.equal(proposals(s)[0].lines[0].required, 300);
});
test("draft freshness changes on stock, prices and demand but not unrelated notes", () => {
  let s = addOrder(fixture(0), "a");
  const p = proposals(s)[0];
  s = act(s, "procurement-draft", {
    supplierId: "sup",
    to: "sales@example.com",
    subject: "Request",
    body: "Please supply rice",
    fingerprint: p.fingerprint,
  });
  const d = s.drafts[0];
  assert.equal(draftCurrent(s, d), true);
  s = act(s, "supplier-note", { supplierId: "sup", message: "Called contact" });
  assert.equal(draftCurrent(s, d), true);
  s = addOrder(s, "b");
  assert.equal(draftCurrent(s, d), false);
  assert.throws(
    () =>
      act(s, "procurement-draft", {
        supplierId: "sup",
        to: "sales@example.com",
        subject: "Request",
        body: "Please supply rice",
        fingerprint: p.fingerprint,
      }),
    /Demand changed/,
  );
  const next = proposals(s)[0];
  s = act(s, "draft-replace", {
    draftId: d.id,
    to: d.to,
    subject: d.subject,
    body: "Updated quantities",
    fingerprint: next.fingerprint,
  });
  assert.equal(s.drafts[0].superseded, true);
  assert.equal(draftCurrent(s, s.drafts[1]), true);
  s = act(s, "offering", { ...s.offerings[0], packCost: 200 });
  assert.equal(draftCurrent(s, s.drafts[1]), false);
});
test("sent requests do not count as stock; confirmed requests cannot duplicate purchases", () => {
  let s = addOrder(fixture(0), "a");
  const p = proposals(s)[0];
  s = act(s, "procurement-draft", {
    supplierId: "sup",
    to: "sales@example.com",
    subject: "Request",
    body: "Rice please",
    fingerprint: p.fingerprint,
  });
  s.drafts[0].sentAt = new Date().toISOString();
  assert.equal(proposals(s)[0].lines[0].required, 500);
  const payload = {
    draftId: s.drafts[0].id,
    eta: today(),
    lines: [{ ingredientId: "rice", quantity: 500, cost: 200 }],
  };
  s = act(s, "purchase-confirm", payload);
  assert.equal(proposals(s).length, 0);
  assert.throws(() => act(s, "purchase-confirm", payload), /resolved/);
});
test("inclusive invoice preserves accepted totals and issued records cannot edit", () => {
  let s = addOrder(fixture(), "a", 5, false);
  s.settings.vatRate = 20;
  s = act(s, "quote", {
    orderId: "a",
    net: 999,
    priceMode: "inclusive",
    notes: "",
  });
  s = act(s, "allergy-review", { orderId: "a", requirements: [] });
  s = act(s, "stage", { orderId: "a", status: "confirmed" });
  let i = s.invoices[0];
  assert.equal(i.total, 999);
  assert.equal(
    tax(i.lines[0].amount, i.lines[0].vatRate, i.lines[0].priceMode).total,
    999,
  );
  assert.throws(() => act(s, "invoice-issue", { invoiceId: i.id }), /Complete/);
  s = act(s, "invoice-edit", {
    ...i,
    invoiceId: i.id,
    businessAddress: "1 Kitchen Road",
    billingAddress: "2 Client Road",
    vatNumber: "GB123456789",
  });
  s = act(s, "invoice-issue", { invoiceId: i.id });
  i = s.invoices[0];
  assert.match(i.number, /^INV-/);
  assert.equal(i.total, 999);
  assert.match(invoiceText(s, i), /£9.99/);
  assert.throws(
    () => act(s, "invoice-edit", { ...i, invoiceId: i.id }),
    /Only draft/,
  );
  s = act(s, "invoice-payment", {
    invoiceId: i.id,
    amount: 500,
    date: today(),
    reference: "BANK-1",
  });
  assert.equal(s.invoices[0].paid, 500);
  assert.equal(s.finance.length, 1);
  assert.throws(
    () =>
      act(s, "invoice-payment", {
        invoiceId: i.id,
        amount: 500,
        date: today(),
        reference: "BANK-1",
      }),
    /already recorded/,
  );
  assert.throws(
    () =>
      act(s, "invoice-payment", {
        invoiceId: i.id,
        amount: 500,
        date: today(),
        reference: "BANK-2",
      }),
    /exceeds/,
  );
  s = act(s, "invoice-credit", { invoiceId: i.id });
  assert.equal(s.invoices[1].originalId, i.id);
  s = act(s, "invoice-issue", { invoiceId: s.invoices[1].id });
  assert.match(s.invoices[1].number, /^CN-/);
});

import "./reporting.test";
