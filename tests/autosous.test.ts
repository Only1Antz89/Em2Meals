import test from "node:test";
import assert from "node:assert/strict";
import { applyCommand, today, type State } from "../lib/domain";
import { sampleState } from "../lib/sample";
import { workspaceAlerts } from "../lib/autosous-alerts";
import { kitchenBriefing } from "../lib/autosous-briefing";
import { alertMatches, parseFeed } from "../lib/food-safety";

const act = (s: State, type: string, payload: unknown) =>
  applyCommand(s, { id: crypto.randomUUID(), type, payload }, "test-owner");
const addDays = (n: number) =>
  new Date(Date.parse(`${today()}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

test("received stock keeps its lot code and supplier", () => {
  let s = sampleState();
  const ingredient = s.ingredients[0];
  s = act(s, "stock-receive", {
    ingredientId: ingredient.id,
    quantity: 500,
    location: "fridge",
    intake: today(),
    expiry: addDays(5),
    dateType: "use-by",
    opened: "",
    frozen: "",
    thawed: "",
    notes: "",
    lot: "  L-2210 ",
  });
  const batch = s.batches.at(-1)!;
  assert.equal(batch.lot, "L-2210");
  assert.equal(batch.supplierId, ingredient.supplierId);
});

test("a recall holds matching stock, re-plans orders and records affected orders", () => {
  let s = sampleState();
  const order = s.orders.find((o) => o.reservations.length)!;
  const reserved = s.batches.find((b) => b.id === order.reservations[0].batchId)!;
  assert.ok(reserved.lot, "sample batches carry lot codes");
  s = act(s, "stock-recall", {
    lot: reserved.lot!.toLowerCase(),
    ingredientId: reserved.ingredientId,
    reason: "Avian influenza at supplying farm",
    reference: "FSA-123",
    source: "supplier",
  });
  const recall = s.recalls[0];
  assert.equal(recall.status, "open");
  assert.deepEqual(recall.batchIds, [reserved.id]);
  assert.ok(recall.orderIds.includes(order.id));
  const held = s.batches.find((b) => b.id === reserved.id)!;
  assert.equal(held.quarantined?.recallId, recall.id);
  // Held stock is never allocated again.
  assert.ok(s.orders.every((o) => o.reservations.every((r) => r.batchId !== reserved.id)));
  const alerts = workspaceAlerts(s);
  assert.ok(alerts.some((a) => a.kind === "recall" && a.severity === "urgent" && a.title.includes(reserved.lot!)));
  assert.ok(alerts.some((a) => a.kind === "fulfilment" && a.path === `orders/${order.id}`));
  // Disposal removes the stock once and closes the recall.
  const before = held.quantity;
  s = act(s, "recall-dispose", { recallId: recall.id });
  const disposed = s.batches.find((b) => b.id === reserved.id)!;
  assert.equal(disposed.quantity, 0);
  assert.equal(disposed.quarantined, undefined);
  assert.equal(s.recalls[0].status, "disposed");
  const movement = s.movements.at(-1)!;
  assert.equal(movement.quantity, -before);
  assert.match(movement.reason, /Recall disposal/);
  assert.throws(() => act(s, "recall-dispose", { recallId: recall.id }), /already closed/);
});

test("releasing a recall returns the stock to use", () => {
  let s = sampleState();
  const batch = s.batches.find((b) => b.quantity > 0 && b.lot)!;
  s = act(s, "stock-recall", { lot: batch.lot, reason: "Supplier checking a label error" });
  s = act(s, "recall-release", { recallId: s.recalls[0].id, note: "Not our batch" });
  const after = s.batches.find((b) => b.id === batch.id)!;
  assert.equal(after.quarantined, undefined);
  assert.equal(after.quantity, batch.quantity);
  assert.equal(s.recalls[0].status, "released");
});

test("orders that already used a recalled lot are flagged", () => {
  let s = sampleState();
  const used = s.movements.find((m) => m.orderId && m.quantity < 0)!;
  const batch = s.batches.find((b) => b.id === used.batchId)!;
  s = act(s, "stock-recall", { lot: batch.lot, reason: "Listeria" });
  assert.ok(s.recalls[0].orderIds.includes(used.orderId!));
  assert.ok(
    workspaceAlerts(s).some((a) => a.id.startsWith("recall-used-") && a.path === `orders/${used.orderId}`),
  );
});

test("alerts cover expiry, out-of-date stock, progress and schedule clashes", () => {
  const s = sampleState();
  const [expired, soon, undated] = s.batches.filter((b) => b.quantity > 0);
  expired.expiry = addDays(-1);
  expired.dateType = "use-by";
  soon.expiry = addDays(1);
  soon.dateType = "use-by";
  undated.expiry = "";
  const order = s.orders.find((o) => o.status === "ingredients needed")!;
  order.details.date = addDays(1);
  order.details.arrivalTime = "11:00";
  order.details.eventTime = "12:00";
  const other = structuredClone(order);
  other.id = "clash";
  other.reference = "EM-CLASH";
  other.details.arrivalTime = "12:30";
  other.costSnapshot = undefined;
  other.reservations = [];
  other.status = "quote";
  s.orders.push(other);
  const alerts = workspaceAlerts(s);
  const find = (id: string) => alerts.find((a) => a.id === id);
  assert.equal(find(`expiry-passed-${expired.id}`)?.severity, "urgent");
  assert.equal(find(`expiry-soon-${soon.id}`)?.severity, "urgent");
  assert.equal(find(`expiry-missing-${undated.id}`)?.severity, "warning");
  assert.equal(find(`progress-${order.id}`)?.severity, "urgent");
  assert.equal(find("progress-clash")?.severity, "urgent");
  assert.ok(alerts.some((a) => a.kind === "schedule" && a.severity === "warning"));
  // Urgent first.
  const ranks = alerts.map((a) => ["urgent", "warning", "info"].indexOf(a.severity));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

test("food safety feeds parse RSS and Atom and match stocked ingredients by word", () => {
  const rss = `<?xml version="1.0"?><rss><channel><title>FSA</title>
    <item><title><![CDATA[Farm Co recalls Chicken Breast Fillets because of Salmonella]]></title>
      <link>https://www.food.gov.uk/news-alerts/alert/fsa-prin-01-2026</link>
      <description>&lt;p&gt;Batch codes &amp;amp; dates affected&lt;/p&gt;</description>
      <pubDate>Mon, 26 Oct 2026 09:00:00 GMT</pubDate><guid>fsa-prin-01-2026</guid></item>
    <item><title>Unsafe link</title><link>http://example.com</link></item>
  </channel></rss>`;
  const items = parseFeed(rss, "food");
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "fsa-prin-01-2026");
  assert.equal(items[0].published, "2026-10-26T09:00:00.000Z");
  assert.match(items[0].summary, /Batch codes & dates affected/);
  const atom = `<feed><entry><title>Eggplant dip allergy alert</title><link href="https://www.food.gov.uk/x"/><updated>2026-10-20T00:00:00Z</updated><id>a1</id></entry></feed>`;
  assert.equal(parseFeed(atom, "allergy")[0].url, "https://www.food.gov.uk/x");
  const s = sampleState();
  s.ingredients.push({ ...s.ingredients[0], id: "egg", name: "Eggs" });
  assert.ok(alertMatches(s, items[0]).some((i) => /chicken/i.test(i.name)));
  assert.ok(!alertMatches(s, parseFeed(atom, "allergy")[0]).some((i) => i.id === "egg"));
});

test("the briefing groups services by day with the next job and their alerts", () => {
  const s = sampleState();
  const order = s.orders.find((o) => o.status === "ingredients needed")!;
  order.details.date = addDays(1);
  order.details.arrivalTime = "11:00";
  const later = structuredClone(order);
  later.id = "later";
  later.reference = "EM-LATER";
  later.details.date = addDays(4);
  later.status = "confirmed";
  later.reservations = [];
  s.orders.push(later);
  const [soon] = s.batches.filter((b) => b.quantity > 0 && !b.quarantined);
  soon.expiry = addDays(1);
  const alerts = workspaceAlerts(s);
  const b = kitchenBriefing(s, alerts);
  const tomorrow = b.days.find((d) => d.id === "tomorrow")!;
  const svc = tomorrow.services.find((x) => x.id === order.id)!;
  assert.ok(svc, "tomorrow's service is listed");
  assert.equal(svc.time, "11:00");
  assert.match(svc.nextStep, /Order|mark ingredients ready/);
  assert.ok(svc.alerts.some((a) => a.id === `progress-${order.id}`), "the order's alert is shown on its service");
  assert.ok(!b.onThePass.some((a) => a.id === `progress-${order.id}`), "and not repeated below");
  assert.ok(b.days.find((d) => d.id === "week")!.services.some((x) => x.id === "later"));
  assert.ok(b.prep && b.prep.dishes.length > 0);
  assert.ok(b.useFirst.some((l) => l.id === `use-${soon.id}`));
  assert.match(b.summary, /service/);
});
