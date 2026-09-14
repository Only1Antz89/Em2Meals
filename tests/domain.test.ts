import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  recipeCost,
  fuelCost,
  recap,
  available,
  emptyState,
  enquirySchema,
  today,
} from "../lib/domain";
import { sampleState } from "../lib/sample";
const act = (s: any, type: string, payload: any, id = crypto.randomUUID()) =>
  applyCommand(s, { id, type, payload }, "test-owner");
test("sample scenario includes a completed lunch, assigned allergy, shortage and waste", () => {
  const s = sampleState();
  assert.equal(s.orders[0].status, "delivered");
  assert.equal(s.orders[0].details.requirements[0].meal, "burger-plain");
  assert.equal(s.orders[1].status, "ingredients needed");
  assert.equal(s.waste[0].quantity, 2);
});
test("recipe variant cost includes gross ingredient yield", () => {
  const s = sampleState();
  const seeded = s.recipes.find((r) => r.id === "burger-seeded")!,
    plain = s.recipes.find((r) => r.id === "burger-plain")!;
  assert.ok(recipeCost(s, seeded) > recipeCost(s, plain));
  const expected =
    (150 * 950) / 1000 +
    ((20 / 0.85) * 280) / 1000 +
    (15 * 350) / 1000 +
    (25 * 780) / 1000 +
    540 / 12;
  assert.ok(Math.abs(recipeCost(s, plain) - expected) < 0.001);
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
test("dated stock resolves shortage, preparation consumes it once, and cancelled prepared food stays consumed", () => {
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
  s = act(s, "stage", { orderId: "sample-upcoming", status: "cancelled" });
  assert.deepEqual(
    s.batches.map((b) => b.quantity),
    quantities,
  );
});
