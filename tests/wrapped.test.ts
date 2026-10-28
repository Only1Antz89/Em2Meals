import test from "node:test";
import assert from "node:assert/strict";
import { applyCommand, type State, today } from "../lib/domain";
import { sampleState } from "../lib/sample";
import { defaultFilter } from "../lib/reporting";
import {
  buildWrapped,
  checksDue,
  periodLabel,
  publicWrapped,
} from "../lib/wrapped";
import { assertStateIntegrity } from "../lib/state-integrity";

const run = (s: State, type: string, payload: unknown) =>
  applyCommand(s, { id: crypto.randomUUID(), type, payload }, "test");
const order = (s: State) => s.orders.find((o) => o.id === "sample-delivered")!;
const filter = (s: State) => ({
  ...defaultFilter(),
  from: today().slice(0, 7) + "-01",
  to: today(),
  customerId: order(s).customerId,
});
const check = (s: State, patch: Record<string, unknown> = {}) =>
  run(s, "waste-check", {
    orderId: "sample-delivered",
    date: today(),
    guests: 27,
    dishes: [
      { recipeId: "burger-seeded", leftover: 2, weightGrams: 500 },
      { recipeId: "burger-plain", leftover: 0, weightGrams: null },
    ],
    plateWasteGrams: 850,
    leftoverDisposal: "redistributed",
    plateDisposal: "recycled",
    notes: "",
    ...patch,
  });

test("waste check records leftovers, plate waste and headcount, and replaces itself", () => {
  let s = sampleState();
  s.waste = [];
  s = check(s);
  const records = s.waste.filter((w) => w.orderId === "sample-delivered");
  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((w) => [w.category, w.quantity, w.disposal]),
    [
      ["unserved portions", 2, "redistributed"],
      ["plate waste", 850, "recycled"],
    ],
  );
  assert.equal(order(s).wasteCheck?.guests, 27);
  s = check(s, {
    dishes: [{ recipeId: "burger-seeded", leftover: 1, weightGrams: null }],
    plateWasteGrams: null,
  });
  const again = s.waste.filter((w) => w.orderId === "sample-delivered");
  assert.equal(again.length, 1);
  assert.equal(again[0].weightMeasured, false);
  assertStateIntegrity(s);
  assert.throws(
    () =>
      check(s, {
        dishes: [{ recipeId: "burger-plain", leftover: 11, weightGrams: null }],
      }),
    /exceed the 10 portions/,
  );
  assert.throws(
    () => check(s, { orderId: "sample-upcoming" }),
    /once the food has been prepared/,
  );
});

test("Wrapped story uses event cohorts, stays customer-safe and needs a customer", () => {
  let s = sampleState();
  s.waste = [];
  s = check(s);
  const story = buildWrapped(s, filter(s));
  assert.equal(story.occasions, 1);
  assert.equal(story.portions, 30);
  assert.equal(story.guests, 27);
  assert.equal(story.leftoverPortions, 2);
  assert.equal(story.enjoyedRate, 93.3);
  assert.equal(story.measuredWasteKg, 1.35);
  assert.equal(story.wastePerGuestGrams, 50);
  assert.equal(story.secondLife.rehomedPortions, 2);
  assert.equal(story.secondLife.divertedRate, 100);
  assert.equal(story.topDishes[0].portions, 20);
  assert.deepEqual(story.coverage, { checked: 1, events: 1 });
  assert.ok(story.tips.some((t) => /fewer guests came/.test(t)));
  const json = JSON.stringify(story);
  assert.ok(!/cost|supplier|unitCost|sample-delivered/i.test(json));
  assert.throws(
    () => buildWrapped(s, { ...filter(s), customerId: "" }),
    /Select one customer/,
  );
});

test("shared Wrapped links are frozen snapshots that can be revoked", () => {
  let s = sampleState();
  s.waste = [];
  s = check(s);
  const f = filter(s);
  s = run(s, "wrapped-share", { ...f, note: "Thanks for a great season!" });
  const share = s.wrapped!.at(-1)!;
  assert.match(share.id, /^[a-f0-9]{32}$/);
  assert.equal(publicWrapped(s, share.id)?.note, "Thanks for a great season!");
  assertStateIntegrity(s);
  s = check(s, { dishes: [], plateWasteGrams: 0 });
  assert.equal(
    publicWrapped(s, share.id)?.leftoverPortions,
    2,
    "snapshot is frozen",
  );
  s = run(s, "wrapped-revoke", { id: share.id });
  assert.equal(publicWrapped(s, share.id), null);
  assert.throws(
    () =>
      run(s, "wrapped-share", { ...f, from: "2001-01-01", to: "2001-01-31" }),
    /no completed events/,
  );
});

test("waste checks due lists finished events without any waste records", () => {
  const s = sampleState();
  const due = checksDue(s, {
    ...defaultFilter(),
    from: "2000-01-01",
    to: today(),
  });
  assert.ok(!due.some((o) => o.id === "sample-delivered"));
  assert.ok(due.some((o) => o.id === "sample-delivered-prior"));
});

test("period labels read naturally", () => {
  assert.equal(periodLabel("2026-01-01", "2026-12-31"), "2026");
  assert.equal(periodLabel("2026-06-01", "2026-06-30"), "June 2026");
  assert.equal(periodLabel("2026-06-01", "2026-08-31"), "1 Jun – 31 Aug 2026");
  assert.equal(periodLabel("2025-11-01", "2026-10-28"), "2025–26");
});

test("sample workspace includes a shared example Wrapped", () => {
  const s = sampleState();
  assertStateIntegrity(s);
  const share = s.wrapped?.find((x) => x.customerId === "sample-client-harbour");
  assert.ok(share && !share.revokedAt);
  assert.equal(share.story.occasions, 5);
  assert.deepEqual(share.story.coverage, { checked: 5, events: 5 });
});
