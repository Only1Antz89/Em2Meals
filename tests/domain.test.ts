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
  type State,
} from "../lib/domain";
import { sampleState } from "../lib/sample";
import { customerCrm, customerActivities } from "../lib/crm";
const act = (s: State, type: string, payload: unknown, id = crypto.randomUUID()) =>
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
  filterInventoryBatches,
  filterStockMovements,
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
test("inventory selectors filter active stock and sort dated batches with blanks last", () => {
  const s = emptyState();
  s.ingredients.push(
    {
      id: "meat",
      name: "Beef",
      category: "meat",
      unit: "g",
      packQuantity: 100,
      packCost: 100,
      yield: 1,
      allergens: "",
      supplierId: "",
      threshold: 0,
    },
    {
      id: "veg",
      name: "Carrots",
      category: "vegetables",
      unit: "g",
      packQuantity: 100,
      packCost: 100,
      yield: 1,
      allergens: "",
      supplierId: "",
      threshold: 0,
    },
  );
  const batch = (
    id: string,
    ingredientId: string,
    quantity: number,
    location: string,
    expiry: string,
  ) => ({
    id,
    ingredientId,
    quantity,
    location,
    intake: "2026-09-01",
    expiry,
    dateType: "use-by",
    opened: "",
    frozen: "",
    thawed: "",
    notes: "",
    unitCost: 1,
  });
  s.batches.push(
    batch("later", "meat", 10, "freezer", "2026-09-20"),
    batch("earlier", "veg", 5, "fridge", "2026-09-10"),
    batch("undated", "veg", 5, "ambient", ""),
    batch("empty", "veg", 0, "freezer", "2026-09-01"),
  );

  assert.deepEqual(
    filterInventoryBatches(s, { activeOnly: true }).map((item) => item.id),
    ["later", "earlier", "undated"],
  );
  assert.deepEqual(
    filterInventoryBatches(s, {
      activeOnly: true,
      category: "vegetables",
      location: "fridge",
    }).map((item) => item.id),
    ["earlier"],
  );
  assert.deepEqual(
    filterInventoryBatches(s, {
      activeOnly: true,
      expirySort: "asc",
    }).map((item) => item.id),
    ["earlier", "later", "undated"],
  );
  assert.deepEqual(
    filterInventoryBatches(s, {
      activeOnly: true,
      expirySort: "desc",
    }).map((item) => item.id),
    ["later", "earlier", "undated"],
  );
});
test("movement selectors use inclusive London dates and exact reasons", () => {
  const s = emptyState();
  s.movements.push(
    {
      id: "included",
      batchId: "batch",
      quantity: -1,
      reason: "Packaged",
      at: "2026-09-15T23:30:00.000Z",
    },
    {
      id: "wrong-reason",
      batchId: "batch",
      quantity: 1,
      reason: "Stock intake",
      at: "2026-09-16T12:00:00.000Z",
    },
    {
      id: "next-day",
      batchId: "batch",
      quantity: -2,
      reason: "Packaged",
      at: "2026-09-16T23:30:00.000Z",
    },
  );

  assert.deepEqual(
    filterStockMovements(s, {
      from: "2026-09-16",
      to: "2026-09-16",
      reason: "Packaged",
    }).map((item) => item.id),
    ["included"],
  );
  assert.equal(filterStockMovements(s, { reason: "packaged" }).length, 0);
});
test("migration is repeatable and preserves legacy consumed orders and totals", () => {
  const s = fixture();
  const legacy = JSON.parse(JSON.stringify(s));
  delete legacy.schemaVersion;
  delete legacy.offerings;
  delete legacy.invoices;
  delete legacy.sequences;
  legacy.settings.businessName = "EM² Meals";
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
  assert.equal(upgraded.settings.businessName, "Fork Goodness Baked");
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

import { liveMenu, publicMenu, generateMenu, type Menu } from "../lib/menu";
import { assertStateIntegrity } from "../lib/state-integrity";
import { normaliseState as normaliseMenus } from "../lib/operations";
const dishNames = (menu: Menu) => menu.sections.flatMap((x) => x.items.map((i) => i.name));
const menuYear = Number(today().slice(0, 4));
test("menu generation uses only active recipes in the chosen season and year", () => {
  let s: State = sampleState();
  s.menus = [];
  s = act(s, "recipe", { ...s.recipes[0], id: undefined, name: "Draft special", status: "draft" });
  s = act(s, "recipe", {
    ...s.recipes[0],
    id: undefined,
    name: "Winter stew",
    status: "active",
    collections: [{ year: menuYear, season: "Winter" }],
  });
  s = act(s, "menu-generate", { year: menuYear, season: "Summer" });
  const menu = s.menus[0];
  const names = dishNames(menu);
  assert.ok(names.includes("House beef burger"));
  assert.ok(!names.includes("Draft special"));
  assert.ok(!names.includes("Winter stew"));
  assert.deepEqual(
    menu.sections.map((x) => x.title),
    ["Starters & sides", "Mains", "Desserts"].filter((t) =>
      menu.sections.some((x) => x.title === t),
    ),
  );
  assert.throws(() => act(s, "menu-generate", { year: menuYear, season: "Summer" }), /already exists/);
  assert.throws(() => act(s, "menu-generate", { year: menuYear, season: "Spring" }), /No active recipes/);
  assertStateIntegrity(s);
});
test("published menus are frozen public projections without costs or recipe ids", () => {
  let s: State = sampleState();
  const published = liveMenu(s)!;
  assert.ok(published, "sample workspace publishes a Summer menu");
  const html = JSON.stringify(published);
  assert.ok(!/recipeId|packCost|cost/i.test(html));
  assert.ok(published.showPrices);
  const menu = s.menus[0];
  const unused = s.recipes.find(
    (r) => !s.orders.some((o) => o.items.some((i) => i.recipeId === r.id)),
  );
  s = act(s, "recipe", { ...unused, name: "Renamed dish" });
  assert.ok(!JSON.stringify(liveMenu(s)).includes("Renamed dish"));
  s = act(s, "menu-save", { ...s.menus[0], title: "Draft title" });
  assert.equal(liveMenu(s)!.title, published.title, "edits do not change the live menu");
  s = act(s, "menu-publish", { id: menu.id });
  assert.equal(liveMenu(s)!.title, "Draft title");
  const hidden = publicMenu({ ...s.menus[0], showPrices: false });
  assert.ok(hidden.sections.every((x) => x.items.every((i) => i.price === null)));
  s = act(s, "menu-unpublish", { id: menu.id });
  assert.equal(liveMenu(s), null);
});
test("only one menu is live and sync keeps owner edits", () => {
  let s: State = sampleState();
  const summer = s.menus[0];
  s = act(s, "recipe", {
    ...s.recipes[0],
    id: undefined,
    name: "Autumn soup",
    collections: [{ year: menuYear, season: "Autumn" }],
  });
  s = act(s, "menu-generate", { year: menuYear, season: "Autumn" });
  const autumn = s.menus.find((m) => m.season === "Autumn")!;
  s = act(s, "menu-publish", { id: autumn.id });
  assert.equal(s.menus.filter((m) => m.published).length, 1);
  assert.equal(liveMenu(s)!.season, "Autumn");
  const edited = structuredClone(s.menus.find((m) => m.id === summer.id)!);
  edited.sections[0].items[0].name = "Owner's name";
  s = act(s, "menu-save", edited);
  s = act(s, "recipe", {
    ...s.recipes[0],
    id: undefined,
    name: "Summer tart",
    collections: [{ year: menuYear, season: "Summer" }],
  });
  s = act(s, "menu-sync", { id: summer.id });
  const synced = s.menus.find((m) => m.id === summer.id)!;
  const names = dishNames(synced);
  assert.ok(names.includes("Owner's name"));
  assert.ok(names.includes("Summer tart"));
  assert.throws(() => act(s, "menu-save", { ...edited, theme: { ...edited.theme, heroImageUrl: "javascript:alert(1)" } }), /Images must be uploaded/);
});
test("older workspaces without menus normalise and generation is pure", () => {
  const s = emptyState() as Partial<State>;
  delete s.menus;
  normaliseMenus(s as State);
  assert.deepEqual(s.menus, []);
  assert.equal(generateMenu(sampleState(), menuYear, "Summer").sections.length > 0, true);
});

import { validateMenuContent, syncMenu, menuLimits, itemFromRecipe } from "../lib/menu";
test("menu validation names the section and dish that needs fixing", () => {
  const menu = structuredClone(sampleState().menus[0]);
  const section = menu.sections[0];
  section.items[1].name = "   ";
  section.items[0].price = -100;
  menu.sections[1].title = "";
  menu.title = "";
  const result = validateMenuContent(menu);
  assert.equal(result.ok, false);
  const issues = result.ok ? [] : result.issues;
  assert.ok(issues.includes(`“${section.title}”, dish 2: Every dish needs a name`), issues.join("|"));
  assert.ok(issues.includes(`“${section.title}”, “${section.items[0].name}”: Prices cannot be negative`), issues.join("|"));
  assert.ok(issues.includes("Section 2: Every section needs a title"), issues.join("|"));
  assert.ok(issues.includes("Menu title: Add a menu title"), issues.join("|"));
  assert.ok(issues.every((x) => !/sections \d|items \d/.test(x)), "no raw schema paths");
  let s = sampleState();
  assert.throws(
    () => act(s, "menu-save", { ...menu, id: s.menus[0].id }),
    (e: Error) => e.message.includes("Every dish needs a name") && !e.message.includes("sections 0"),
  );
  // Duplicate tags are folded, oversized prices refused.
  const tagged = structuredClone(s.menus[0]);
  tagged.sections[0].items[0].tags = ["V", "V", "GF"];
  s = act(s, "menu-save", tagged);
  assert.deepEqual(s.menus[0].sections[0].items[0].tags, ["V", "GF"]);
  tagged.sections[0].items[0].price = menuLimits.maxPrice + 1;
  assert.throws(() => act(s, "menu-save", tagged), /£10,000 or less/);
});
test("menu saves from an out-of-date editor are refused instead of overwriting", () => {
  let s = sampleState();
  const base = structuredClone(s.menus[0]);
  s = act(s, "menu-save", { ...base, title: "First tab", baseUpdatedAt: base.updatedAt }, "first");
  // A second editor still holding the original copy.
  assert.throws(
    () => act(s, "menu-save", { ...base, title: "Second tab", baseUpdatedAt: base.updatedAt }),
    /changed in another window/,
  );
  assert.equal(s.menus[0].title, "First tab");
  // Saving again from the latest copy works.
  s = act(s, "menu-save", { ...s.menus[0], title: "Second tab", baseUpdatedAt: s.menus[0].updatedAt });
  assert.equal(s.menus[0].title, "Second tab");
});
test("generated and synced dishes always fit the menu rules", () => {
  let s = sampleState();
  const recipe = {
    ...s.recipes[0],
    name: "x".repeat(500),
    variant: undefined as unknown as string,
    imageUrl: "http://insecure.example/photo.jpg",
  };
  const item = itemFromRecipe(recipe);
  assert.equal(item.name.length, menuLimits.shortText);
  assert.equal(item.description, "");
  assert.equal(item.imageUrl, "");
  assert.equal(item.showImage, false);
  // A section already at its limit is not overfilled by sync.
  const menu = structuredClone(s.menus[0]);
  const target = menu.sections[0];
  while (target.items.length < menuLimits.dishesPerSection)
    target.items.push({ ...target.items[0], id: crypto.randomUUID(), recipeId: undefined });
  s = act(s, "recipe", {
    ...s.recipes.find((r) => menu.sections[0].items.some((i) => i.recipeId === r.id))!,
    id: undefined,
    name: "One too many",
    collections: [{ year: menu.year, season: menu.season }],
  });
  const added = syncMenu(s, menu);
  assert.ok(validateMenuContent(menu).ok, "menu stays valid after sync");
  assert.ok(target.items.length <= menuLimits.dishesPerSection);
  assert.ok(added <= 1);
});
test("publishing checks the whole menu and sync explains when nothing is added", () => {
  let s = sampleState();
  const id = s.menus[0].id;
  s.menus[0].sections[0].items[0].name = "";
  assert.throws(() => act(s, "menu-publish", { id }), /Fix these before publishing:[\s\S]*Every dish needs a name/);
  s = sampleState();
  assert.throws(() => act(s, "menu-sync", { id: s.menus[0].id }), /no new Summer/);
  assert.throws(() => act(s, "menu-publish", { id: "missing" }), /Menu not found/);
});

import { erasedName, erasedEmail } from "../lib/privacy";
test("customer erasure anonymises personal data but keeps issued invoices and blocks active orders", () => {
  let s: State = sampleState();
  const northbank = s.customers.find((c) => c.company.startsWith("Northbank"))!;
  assert.throws(() => act(s, "customer-erase", { customerId: northbank.id }), /Complete or cancel/);
  const enquiry = s.orders.find((o) => o.status === "enquiry")!;
  const customerId = enquiry.customerId;
  s = act(s, "crm-follow-up", { customerId, note: "Call back", dueDate: today(), status: "open" });
  s = act(s, "customer-erase", { customerId });
  const customer = s.customers.find((c) => c.id === customerId)!;
  assert.equal(customer.name, erasedName);
  assert.equal(customer.email, erasedEmail(customerId));
  assert.ok(customer.erasedAt);
  const orders = s.orders.filter((o) => o.customerId === customerId);
  assert.ok(orders.length > 0);
  for (const order of orders) {
    assert.equal(order.details.name, erasedName);
    assert.equal(order.details.phone, "");
    assert.equal(order.details.dietary, "");
    assert.deepEqual(order.details.requirements, []);
    assert.ok(["delivered", "cancelled", "declined"].includes(order.status));
  }
  assert.equal(s.followUps.filter((f) => f.customerId === customerId).length, 0);
  assert.equal(s.engagements.filter((f) => f.customerId === customerId).length, 0);
  assertStateIntegrity(s);
});
test("only unworked enquiries can be deleted, removing an otherwise empty customer", () => {
  let s: State = sampleState();
  s = act(s, "order", {
    details: { ...s.orders[0].details, name: "Spam Bot", email: "spam@example.com", company: "", date: "" },
    items: [],
  });
  const spam = s.orders.at(-1)!;
  s = act(s, "order-delete", { orderId: spam.id });
  assert.ok(!s.orders.some((o) => o.id === spam.id));
  assert.ok(!s.customers.some((c) => c.email === "spam@example.com"));
  const delivered = s.orders.find((o) => o.status === "delivered")!;
  assert.throws(() => act(s, "order-delete", { orderId: delivered.id }), /can't be deleted/);
  assertStateIntegrity(s);
});
test("owners can correct an order whose event date has passed without changing the date", () => {
  let s: State = sampleState();
  const order = s.orders.find((o) => o.status === "enquiry")!;
  s.orders.find((o) => o.id === order.id)!.details.date = "2020-01-01";
  s = act(s, "order", { orderId: order.id, details: { ...order.details, date: "2020-01-01", phone: "07000000000" }, items: order.items });
  assert.equal(s.orders.find((o) => o.id === order.id)!.details.phone, "07000000000");
  assert.throws(
    () => act(s, "order", { orderId: order.id, details: { ...order.details, date: "2020-02-01" }, items: order.items }),
    /must not be in the past/,
  );
});
test("vehicle economy: CO2-based MPG estimate, cost per mile and trip pricing", async () => {
  const { estimateMpg, costPerMile, vehicleFuelCost, fuelTypeFromDvla, hoursBetween } =
    await import("../lib/team-fleet");
  // 2018 petrol Tucson, 147 g/km on the older NEDC test: about 35 MPG real-world.
  assert.equal(estimateMpg(147, "petrol", "2018-03"), 35.5);
  // Same CO2 on WLTP is closer to real driving.
  assert.ok(estimateMpg(147, "petrol", "2021-06")! > 35.5);
  assert.equal(estimateMpg(0, "petrol"), null);
  assert.equal(estimateMpg(120, "electric"), null);
  assert.equal(fuelTypeFromDvla("PETROL"), "petrol");
  assert.equal(fuelTypeFromDvla("ELECTRICITY"), "electric");
  assert.equal(fuelTypeFromDvla("HYBRID ELECTRIC", 110), "hybrid-petrol");
  assert.equal(fuelTypeFromDvla("HYBRID ELECTRIC", 30), "plug-in-hybrid");
  assert.equal(fuelTypeFromDvla("ELECTRIC DIESEL", 120), "hybrid-diesel");
  const car = { fuelType: "petrol" as const, mpg: 40, milesPerKwh: 0, fuelPrice: 1.5 };
  assert.equal(vehicleFuelCost(car, 100), 1705);
  assert.equal(Math.round(costPerMile(car)! * 10) / 10, 17);
  const ev = { fuelType: "electric" as const, mpg: 0, milesPerKwh: 4, fuelPrice: 0.28 };
  assert.equal(vehicleFuelCost(ev, 100), 700);
  assert.equal(vehicleFuelCost({ ...car, mpg: 0 }, 10), null);
  assert.equal(hoursBetween("08:00", "13:30", 30), 5);
  assert.equal(hoursBetween("22:00", "02:00"), 4);
});
test("journeys without a receipt are priced from the chosen vehicle", () => {
  let s = emptyState();
  s = act(s, "vehicle", { registration: "ab12 cde", make: "Ford", model: "Transit", fuelType: "diesel", mpg: 30, fuelPrice: 1.6 });
  s = act(s, "vehicle", { registration: "", name: "Owner car", fuelType: "petrol", mpg: 45, fuelPrice: 1.5 });
  const [van, car] = s.vehicles;
  assert.equal(van.registration, "AB12CDE");
  assert.equal(van.name, "Ford Transit");
  assert.ok(van.isDefault, "first vehicle becomes the default");
  assert.ok(!car.isDefault);
  assert.throws(() => act(s, "vehicle", { registration: "AB12CDE", fuelType: "diesel", mpg: 30, fuelPrice: 1.6 }), /already listed/);
  const journey = { orderId: "", service: "shared", date: today(), miles: 30, minutes: 60, extraCost: 0, status: "actual", notes: "", paymentDate: "" };
  s = act(s, "journey", { ...journey, fuelCost: null, vehicleId: car.id });
  assert.equal(s.journeys[0].fuelCost, Math.round((30 / 45) * 4.54609 * 150));
  assert.equal(s.journeys[0].fuelEstimated, true);
  // A receipt amount wins over the estimate.
  s = act(s, "journey", { ...journey, id: s.journeys[0].id, fuelCost: 999, vehicleId: car.id });
  assert.equal(s.journeys[0].fuelCost, 999);
  assert.equal(s.journeys[0].fuelEstimated, false);
  // No vehicle chosen: the default vehicle is used.
  s = act(s, "journey", { ...journey, fuelCost: null, vehicleId: "" });
  assert.equal(s.journeys[1].fuelCost, Math.round((30 / 30) * 4.54609 * 160));
  // Making the car the default moves the flag.
  s = act(s, "vehicle", { ...car, isDefault: true });
  assert.deepEqual(s.vehicles.map((v) => v.isDefault), [false, true]);
});
test("staff assignments cost labour by the hour and flow into job profit", async () => {
  const { jobPerformance } = await import("../lib/reporting");
  let s = sampleState();
  const delivered = s.orders.find((o) => o.id === "sample-delivered")!;
  const job = jobPerformance(s, delivered);
  // Sample: owner 6h at £25 and assistant 5h at £12.21 + 18% on-costs.
  assert.equal(job.labour, 6 * 2500 + Math.round(5 * Math.round(1221 * 1.18)));
  assert.equal(job.labourHours, 11);
  assert.equal(job.missingLabour, false);
  assert.equal(job.estimatedLabour, false);
  const upcoming = jobPerformance(s, s.orders.find((o) => o.id === "sample-upcoming")!);
  assert.equal(upcoming.estimatedLabour, true, "assigned-only hours stay estimated");
  // Confirming hours with times and a break recalculates the linked cost.
  const assistant = s.staff.find((m) => m.role === "Kitchen assistant")!.id;
  const shift = s.shifts.find((x) => x.orderId === "sample-upcoming" && x.staffId === assistant)!;
  s = act(s, "shift", { ...shift, start: "09:00", end: "15:30", breakMinutes: 30, status: "worked", rateOverride: 0 });
  const updated = s.shifts.find((x) => x.id === shift.id)!;
  assert.equal(updated.hours, 6);
  const linked = s.finance.filter((f) => f.shiftId === shift.id);
  assert.equal(linked.length, 1);
  assert.equal(linked[0].amount, updated.cost);
  assert.equal(linked[0].status, "actual");
  assert.equal(linked[0].costType, "labour");
  // Linked labour can only be changed through the assignment.
  assert.throws(() => act(s, "expense", { id: linked[0].id, service: "shared", costType: "labour", description: "x", amount: 1, vatRate: 0, priceMode: "inclusive", vatRecoverable: false, incurredDate: today(), paymentDate: "", status: "actual" }), /editable expense/);
  assert.throws(() => act(s, "shift", { staffId: assistant, date: today(), status: "planned", start: "09:00" }), /start and finish/);
  assert.throws(() => act(s, "shift", { staffId: assistant, date: today(), status: "planned" }), /hours/);
  s = act(s, "shift-remove", { id: shift.id });
  assert.equal(s.finance.some((f) => f.shiftId === shift.id), false);
});
