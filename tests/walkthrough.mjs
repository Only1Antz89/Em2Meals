import assert from "node:assert/strict";
const base = process.env.EM2_TEST_URL || "http://localhost:5173";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))
  throw Error("Local sample workspace only");
const headers = {
  Cookie: "__sites_local_auth=1",
  Origin: base,
  "Content-Type": "application/json",
};
async function state() {
  const r = await fetch(base + "/api/admin/state?mode=sample", { headers });
  assert.equal(r.status, 200);
  return r.json();
}
async function run(type, payload) {
  const { revision } = await state();
  const r = await fetch(base + "/api/admin/action", {
    method: "POST",
    headers,
    body: JSON.stringify({
      mode: "sample",
      revision,
      command: { id: crypto.randomUUID(), type, payload },
    }),
  });
  const body = await r.json();
  assert.equal(r.status, 200, JSON.stringify(body));
  return (await state()).state;
}
const id = crypto.randomUUID(),
  supplier = "walk-supplier-" + id,
  ingredient = "walk-rice-" + id,
  recipe = "walk-dish-" + id,
  orderId = "walk-order-" + id;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
}).format(new Date());
const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
await run("supplier", {
  id: supplier,
  name: "Walkthrough supplier · sample",
  email: "sample@example.com",
  phone: "",
  deliveryCharge: 0,
  minimumOrder: 0,
  leadDays: 1,
  notes: "Local verification fixture",
});
await run("ingredient", {
  id: ingredient,
  name: "Walkthrough rice · sample",
  category: "rice",
  unit: "g",
  packQuantity: 500,
  packCost: 200,
  yield: 1,
  allergens: "None",
  supplierId: supplier,
  threshold: 0,
});
await run("recipe", {
  id: recipe,
  name: "Walkthrough bowl · sample",
  variant: "Standard",
  lines: [{ ingredientId: ingredient, quantity: 100 }],
  collections: [{ year: Number(today.slice(0, 4)), season: "Autumn" }],
});
await run("order", {
  orderId,
  details: {
    service: "private",
    eventType: "Local sample walkthrough",
    attendees: 5,
    date: today,
    eventTime: "12:00",
    arrivalTime: "11:00",
    requests: "5 rice bowls",
    dietary: "",
    requirements: [],
    name: "Walkthrough customer",
    company: "",
    email: "walkthrough@example.com",
    phone: "01234567",
    venue: "Sample office",
    address: "1 Sample Road",
    postcode: "SE1 1AA",
    access: "Manual example",
    unknownDetails: "",
  },
  items: [{ recipeId: recipe, quantity: 5 }],
});
await run("quote", {
  orderId,
  net: 12000,
  priceMode: "inclusive",
  notes: "Sample only",
});
await run("allergy-review", { orderId, requirements: [] });
let s = await run("stage", { orderId, status: "confirmed" });
assert.equal(s.orders.find((o) => o.id === orderId).reservations.length, 0);
// Sample mode never sends email. Record a supplier confirmation manually.
s = await run("purchase", {
  supplierId: supplier,
  ingredientId: ingredient,
  quantity: 500,
  cost: 200,
  eta: today,
  notes: "Manual confirmation · local walkthrough",
});
const purchase = s.purchases.at(-1);
s = await run("stock-receive", {
  purchaseId: purchase.id,
  ingredientId: ingredient,
  quantity: 500,
  location: "ambient",
  intake: today,
  expiry: future,
  dateType: "best-before",
  opened: "",
  frozen: "",
  thawed: "",
  notes: "Local sample receipt",
});
const batch = s.batches.find((b) => b.ingredientId === ingredient);
for (const status of ["ingredients ready", "prepared", "cooked"])
  s = await run("stage", { orderId, status });
assert.equal(s.batches.find((b) => b.id === batch.id).quantity, 500);
s = await run("stage", { orderId, status: "packaged" });
assert.equal(s.batches.find((b) => b.id === batch.id).quantity, 0);
const count = s.movements.length;
s = await run("stage", { orderId, status: "packaged" });
assert.equal(s.movements.length, count);
const invoice = s.invoices.find((i) => i.orderId === orderId);
await run("invoice-edit", {
  ...invoice,
  invoiceId: invoice.id,
  businessAddress: "1 Sample Kitchen",
  billingAddress: "1 Sample Road",
  vatNumber: "GB123456789",
});
s = await run("invoice-issue", { invoiceId: invoice.id });
await run("invoice-payment", {
  invoiceId: invoice.id,
  amount: invoice.total,
  date: today,
  reference: "WALK-" + id,
});
await run("expense", {
  orderId,
  service: "shared",
  costType: "labour",
  description: "Sample actual labour",
  amount: 1000,
  vatRate: 0,
  priceMode: "inclusive",
  vatRecoverable: false,
  incurredDate: today,
  paymentDate: today,
  status: "actual",
  hours: 1,
});
await run("journey", {
  orderId,
  service: "shared",
  date: today,
  miles: 5,
  minutes: 20,
  fuelCost: 150,
  extraCost: 0,
  status: "actual",
  notes: "Sample delivery",
  paymentDate: today,
});
for (const status of ["ready for delivery", "delivered"])
  s = await run("stage", { orderId, status });
assert.equal(s.finance.filter((f) => f.invoiceId === invoice.id).length, 1);
console.log(
  "PASS: local sample enquiry, acceptance, manual purchasing, receipt, preparation, idempotent packaging, issued invoice, payment, actual labour/journey, delivery",
);
console.log(
  "Sample order:",
  s.orders.find((o) => o.id === orderId).reference,
  "Invoice:",
  s.invoices.find((i) => i.id === invoice.id).number,
);
