import test from "node:test";
import assert from "node:assert/strict";
import { applyCommand, type State, today } from "../lib/domain";
import { sampleState } from "../lib/sample";
import {
  businessReport,
  customerExport,
  defaultFilter,
  expenseCost,
  filtersFromURL,
  jobPerformance,
  monthlyTrends,
  previousPeriod,
  reportingCommand,
  wasteReport,
} from "../lib/reporting";
const filter = () => ({
  ...defaultFilter(),
  from: today().slice(0, 7) + "-01",
  to: today(),
});
const command = (s: State, type: string, payload: unknown) =>
  applyCommand(s, { id: crypto.randomUUID(), type, payload }, "test");
function fixture() {
  const s = sampleState();
  s.finance = [];
  s.purchases = [];
  const first = s.orders[0];
  const customer = {
    ...s.customers[0],
    id: "private-customer",
    name: "Private person",
    company: "",
    email: "private@example.com",
  };
  s.customers.push(customer);
  const second = structuredClone(first);
  second.id = "private-order";
  second.customerId = customer.id;
  second.details.service = "private";
  second.details.postcode = "";
  second.details.locality = "";
  second.details.place = undefined;
  s.orders.push(second);
  s.invoices = [];
  return s;
}
const expense = (s: State, patch: Record<string, unknown> = {}) =>
  reportingCommand(s, "expense", {
    orderId: "",
    service: "shared",
    costType: "overhead",
    description: "Recorded cost",
    amount: 1000,
    vatRate: 0,
    priceMode: "exclusive",
    vatRecoverable: false,
    incurredDate: today(),
    paymentDate: "",
    status: "actual",
    ...patch,
  });
test("report defaults, URL filters and preceding period respect calendar boundaries", () => {
  assert.equal(defaultFilter().customerId, "");
  assert.equal(defaultFilter().service, "all");
  assert.deepEqual(
    previousPeriod({
      from: "2024-03-01",
      to: "2024-03-31",
      customerId: "c",
      service: "private",
    }),
    {
      from: "2024-01-30",
      to: "2024-02-29",
      customerId: "c",
      service: "private",
    },
  );
  assert.equal(
    filtersFromURL(
      new URLSearchParams(
        "customer=abc&service=corporate&from=2026-01-01&to=2026-01-31",
      ),
    ).customerId,
    "abc",
  );
  assert.equal(
    filtersFromURL(new URLSearchParams("from=invalid")).from,
    defaultFilter().from,
  );
});
test("waste filters isolate customers, exclude unassigned stock loss, and export only public facts", () => {
  const s = fixture(),
    f = filter();
  s.waste.push({
    ...s.waste[0],
    id: "business-loss",
    orderId: "",
    category: "spoilage",
    weightGrams: 1000,
    cost: 9900,
  });
  s.waste.push({
    ...s.waste[0],
    id: "missing",
    orderId: "private-order",
    weightGrams: 0,
  });
  s.waste.push({
    ...s.waste[0],
    id: "zero",
    orderId: "private-order",
    weightGrams: 0,
    weightMeasured: true,
  });
  assert.equal(wasteReport(s, f).weight, 1500);
  const privateFilter = { ...f, customerId: "private-customer" };
  assert.equal(wasteReport(s, privateFilter).weight, 0);
  assert.equal(wasteReport(s, privateFilter).unmeasured, 1);
  const exported = customerExport(s, privateFilter);
  assert.equal(exported.customer, "Private person");
  assert.ok(!JSON.stringify(exported).includes("9900"));
  assert.ok(!("cost" in exported));
  assert.equal(wasteReport(s, { ...f, service: "private" }).waste.length, 2);
  assert.equal(
    wasteReport(s, { ...f, customerId: "missing-customer" }).waste.length,
    0,
  );
});
test("unserved cohort follows completed event dates even when waste registered later", () => {
  const s = fixture(),
    f = filter();
  s.waste[0].date = "2099-01-01";
  const r = wasteReport(s, { ...f, customerId: s.orders[0].customerId });
  assert.equal(r.waste.length, 0);
  assert.equal(r.unserved, 2);
  assert.equal(r.portions, 30);
});
test("private, corporate and shared expenses affect only their appropriate scope", () => {
  const s = fixture(),
    f = filter();
  expense(s, { amount: 1000 });
  expense(s, { service: "private", amount: 2000 });
  expense(s, { service: "corporate", amount: 3000 });
  expense(s, {
    orderId: s.orders[0].id,
    service: "private",
    costType: "labour",
    amount: 4000,
  });
  const b = businessReport(s, f),
    c = businessReport(s, { ...f, customerId: s.orders[0].customerId });
  assert.equal(b.shared, 1000);
  assert.equal(b.operating, 6000);
  assert.equal(c.operating, 0);
  assert.equal(c.labour, 4000);
  assert.equal(
    b.segments.find((x) => x.service === "private")!.operating,
    2000,
  );
  assert.equal(
    b.segments.find((x) => x.service === "corporate")!.operating,
    3000,
  );
  assert.equal(b.netProfit, b.grossProfit - 6000);
  assert.equal(businessReport(s, { ...f, service: "private" }).shared, 0);
});
test("unpaid expenses affect profit but not cash; supplier payment is not ingredient consumption", () => {
  const s = fixture(),
    f = filter();
  expense(s, {
    amount: 1200,
    priceMode: "inclusive",
    vatRate: 20,
    vatRecoverable: true,
  });
  assert.equal(expenseCost(s.finance[0]), 1000);
  assert.equal(businessReport(s, f).cashOut, 0);
  const before = businessReport(s, f).netProfit;
  expense(s, { costType: "ingredients", amount: 8000, paymentDate: today() });
  assert.equal(businessReport(s, f).cashOut, 8000);
  assert.equal(businessReport(s, f).netProfit, before);
});
test("journey updates preserve one cash entry and actual journey replaces route estimate", () => {
  const s = fixture(),
    o = s.orders[0];
  o.route = {
    ...o.route!,
    miles: 20,
    minutes: 30,
    fuelCost: 900,
    extraCost: 100,
  };
  const p = {
    orderId: o.id,
    service: "private",
    date: today(),
    miles: 10,
    minutes: 20,
    fuelCost: 400,
    extraCost: 50,
    status: "actual",
    notes: "Trip",
    paymentDate: today(),
  };
  const id = reportingCommand(s, "journey", p)!;
  reportingCommand(s, "journey", { ...p, id, fuelCost: 500 });
  assert.equal(s.journeys.length, 1);
  assert.equal(s.finance.filter((x) => x.journeyId === id).length, 1);
  assert.equal(jobPerformance(s, o).travel, 550);
  assert.equal(businessReport(s, filter()).cashOut, 550);
  assert.equal(jobPerformance(s, o).missingLabour, true);
  expense(s, { orderId: o.id, costType: "labour", amount: 0 });
  assert.equal(jobPerformance(s, o).missingLabour, false);
});
test("historical ingredient movement cost stays fixed and spoilage is recognised once", () => {
  const s = fixture(),
    o = s.orders[0],
    before = jobPerformance(s, o).ingredients;
  for (const b of s.batches) b.unitCost *= 10;
  assert.equal(jobPerformance(s, o).ingredients, before);
  s.movements.push({
    id: "loss",
    batchId: s.batches[0].id,
    quantity: -1,
    reason: "Spoilage",
    cost: 200,
    at: new Date().toISOString(),
  });
  s.waste.push({
    ...s.waste[0],
    id: "loss-waste",
    movementId: "loss",
    orderId: "",
    cost: 200,
  });
  const b = businessReport(s, filter());
  assert.equal(b.losses, 200);
  assert.equal(b.netProfit, b.grossProfit - 200);
});
test("combined supplier request counts once, and mixed-customer purchases are not arbitrarily allocated", () => {
  const s = fixture();
  const base = {
    id: "p1",
    ingredientId: s.ingredients[0].id,
    supplierId: s.suppliers[0].id,
    quantity: 100,
    cost: 200,
    status: "ordered" as const,
    eta: today(),
    at: new Date().toISOString(),
    receivedQuantity: 0,
    requestId: "request",
    notes: "Test",
    orderIds: [s.orders[0].id, "private-order"],
  };
  s.purchases.push(base, {
    ...base,
    id: "p2",
    ingredientId: s.ingredients[1].id,
  });
  const b = businessReport(s, filter());
  assert.equal(b.suppliers[0].orders, 1);
  assert.equal(b.suppliers[0].spend, 400);
  assert.equal(
    businessReport(s, { ...filter(), customerId: "private-customer" }).suppliers
      .length,
    0,
  );
  assert.ok(b.places.some((x) => x.name === "Unclassified"));
});
test("monthly chart data agree with report totals and empty periods avoid invalid ratios", () => {
  const s = fixture(),
    f = filter(),
    b = businessReport(s, f),
    t = monthlyTrends(s, f);
  assert.equal(
    t.reduce((n, x) => n + x.profit, 0),
    b.netProfit / 100,
  );
  const empty = businessReport(s, {
    ...f,
    from: "2000-01-01",
    to: "2000-01-31",
  });
  assert.equal(empty.grossMargin, null);
  assert.equal(empty.netProfit, 0);
  assert.equal(
    wasteReport(s, { ...f, from: "2000-01-01", to: "2000-01-31" }).unservedRate,
    null,
  );
});
test("invoice credits and partial payments use document and payment dates without duplicate income", () => {
  let s = sampleState();
  const o = s.orders[0];
  // Existing invoice commands provide immutable issue/payment snapshots.
  const draft = s.invoices.find((x) => x.orderId === o.id)!;
  s = command(s, "invoice-edit", {
    ...draft,
    invoiceId: draft.id,
    businessAddress: "1 Kitchen Road",
    billingAddress: "2 Customer Road",
    vatNumber: "GB123456789",
  });
  s = command(s, "invoice-issue", { invoiceId: draft.id });
  s = command(s, "invoice-payment", {
    invoiceId: draft.id,
    amount: 1000,
    date: today(),
    reference: "partial",
  });
  const b = businessReport(s, filter());
  assert.equal(b.salesNet, s.invoices.find((x) => x.id === draft.id)!.net);
  assert.equal(
    b.unpaid,
    s.invoices.find((x) => x.id === draft.id)!.total - 1000,
  );
  s = command(s, "invoice-credit", { invoiceId: draft.id });
  s = command(s, "invoice-issue", { invoiceId: s.invoices.at(-1)!.id });
  assert.equal(businessReport(s, filter()).salesNet, 0);
  assert.equal(businessReport(s, filter()).unpaid, 0);
  assert.equal(businessReport(s, filter()).cashIn, b.cashIn);
});

test("purchase receipts use recorded purchasing cost and manual stock losses retain that cost", () => {
  let s = sampleState();
  const i = s.ingredients[0];
  s = command(s, "purchase", {
    supplierId: i.supplierId,
    ingredientId: i.id,
    quantity: 100,
    cost: 900,
    eta: today(),
    notes: "Actual receipt",
  });
  const purchase = s.purchases.at(-1)!;
  s = command(s, "stock-receive", {
    purchaseId: purchase.id,
    ingredientId: i.id,
    quantity: 100,
    location: "fridge",
    intake: today(),
    expiry: today(),
    dateType: "use-by",
    opened: "",
    frozen: "",
    thawed: "",
    notes: "",
  });
  const b = s.batches.at(-1)!;
  assert.equal(b.unitCost, 9);
  const prior = businessReport(s, filter()).losses;
  s = command(s, "stock-adjust", {
    batchId: b.id,
    quantity: 90,
    reason: "Dropped stock",
    location: b.location,
    expiry: b.expiry,
    opened: "",
    frozen: "",
    thawed: "",
  });
  assert.equal(s.movements.at(-1)!.cost, 90);
  assert.equal(businessReport(s, filter()).losses, prior + 90);
});

test("actual fuel payment does not turn estimated route mileage into actual mileage", () => {
  const s = fixture(),
    o = s.orders[0];
  o.route = {
    ...o.route!,
    miles: 20,
    minutes: 30,
    fuelCost: 400,
    extraCost: 0,
  };
  expense(s, {
    orderId: o.id,
    costType: "travel",
    amount: 500,
    paymentDate: today(),
  });
  const j = jobPerformance(s, o);
  assert.equal(j.travel, 500);
  assert.equal(j.estimatedTravel, false);
  assert.equal(j.estimatedMileage, true);
  const b = businessReport(s, filter());
  assert.equal(b.actualMiles, 0);
  assert.equal(b.estimatedMiles, 20);
});
test("order-linked stock losses affect only that service contribution", () => {
  const s = fixture(),
    f = filter(),
    before = businessReport(s, f);
  s.movements.push({
    id: "service-loss",
    batchId: s.batches[0].id,
    orderId: "private-order",
    quantity: -1,
    reason: "Spoilage",
    cost: 300,
    at: new Date().toISOString(),
  });
  const after = businessReport(s, f);
  assert.equal(
    after.segments.find((x) => x.service === "private")!.contribution,
    before.segments.find((x) => x.service === "private")!.contribution - 300,
  );
  assert.equal(
    after.segments.find((x) => x.service === "corporate")!.contribution,
    before.segments.find((x) => x.service === "corporate")!.contribution,
  );
  assert.equal(after.netProfit, before.netProfit - 300);
});
