// Em2 Wrapped: a client-facing, story-style recap of the food we served and
// what happened to what was left. Two halves live here:
//
// 1. Gathering: the post-event waste check, one form per event that records
//    leftovers per dish, plate waste, real headcount and where food went.
// 2. Presenting: buildWrapped() turns workspace records into a customer-safe
//    story. Shared links store a frozen copy, so a client only ever sees the
//    allowlisted fields below (no costs, suppliers, margins or ids).
import { z } from "zod";
import { type State, type Order, today, uid } from "./domain";
import { dateValue } from "./operations";
import {
  type ReportFilter,
  inPeriod,
  orderMatches,
  previousPeriod,
  wasteReport,
} from "./reporting";

export const wasteDisposals = [
  "redistributed",
  "client",
  "staff",
  "recycled",
  "general",
] as const;
export type WasteDisposal = (typeof wasteDisposals)[number];
export const disposalLabels: Record<WasteDisposal, string> = {
  redistributed: "Donated or redistributed",
  client: "Left with the client",
  staff: "Eaten by the team",
  recycled: "Food recycling or compost",
  general: "General waste",
};
// Food that was still eaten by someone.
const rehomed = new Set<WasteDisposal>(["redistributed", "client", "staff"]);

export type WasteCheck = {
  date: string;
  at: string;
  // Guests who actually ate; null when not counted.
  guests: number | null;
  // Scraped plate waste for the whole event; null when not weighed.
  plateWasteGrams: number | null;
  notes: string;
};

// Orders whose food has been made can be checked.
export const checkable = (o: Order) =>
  o.consumed ||
  [
    "prepared",
    "cooked",
    "packaged",
    "ready for delivery",
    "delivered",
  ].includes(o.status);

export type WrappedStory = {
  version: 1;
  business: string;
  customer: string;
  customerLogoUrl?: string;
  reportedWaste?: {
    records: number;
    unmeasured: number;
    measuredKg: number;
    categories: { name: string; records: number; measuredKg: number }[];
  };
  from: string;
  to: string;
  periodLabel: string;
  service: ReportFilter["service"];
  occasions: number;
  guests: number;
  portions: number;
  dishCount: number;
  topDishes: { name: string; portions: number }[];
  // Share of portions not returned as leftovers or plate waste.
  enjoyedRate: number | null;
  leftoverPortions: number;
  measuredWasteKg: number | null;
  wastePerGuestGrams: number | null;
  previous: {
    enjoyedRate: number | null;
    wastePerGuestGrams: number | null;
  } | null;
  secondLife: {
    rehomedPortions: number;
    // Share of measured waste with a recorded destination that stayed out of
    // general waste.
    divertedRate: number | null;
  };
  bestEvent: { date: string; name: string; enjoyedRate: number } | null;
  months: {
    month: string;
    label: string;
    portions: number;
    enjoyedRate: number | null;
  }[];
  feedback: {
    average: number | null;
    count: number;
    quote: string | null;
  };
  persona: { title: string; line: string };
  tips: string[];
  coverage: { checked: number; events: number };
  note: string;
  generatedAt: string;
};

export type WrappedShare = {
  id: string;
  customerId: string;
  from: string;
  to: string;
  service: ReportFilter["service"];
  createdAt: string;
  revokedAt?: string;
  story: WrappedStory;
};

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
  utc(d).toLocaleDateString("en-GB", { timeZone: "UTC", ...o });
const lastDayOfMonth = (d: string) =>
  new Date(Date.UTC(utc(d).getUTCFullYear(), utc(d).getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);

export function periodLabel(from: string, to: string) {
  if (
    from.slice(0, 4) === to.slice(0, 4) &&
    from.endsWith("-01-01") &&
    to.endsWith("-12-31")
  )
    return from.slice(0, 4);
  if (
    from.slice(0, 7) === to.slice(0, 7) &&
    from.endsWith("-01") &&
    to === lastDayOfMonth(to)
  )
    return fmt(from, { month: "long", year: "numeric" });
  // A rolling twelve months across two years reads as "2025–26".
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (from.endsWith("-01") && days >= 330 && days <= 366 && from.slice(0, 4) !== to.slice(0, 4))
    return `${from.slice(0, 4)}–${to.slice(2, 4)}`;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${fmt(from, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" })} – ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}`;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

type Cohort = ReturnType<typeof cohort>;
function cohort(s: State, f: ReportFilter) {
  const events = s.orders
    .filter(
      (o) =>
        orderMatches(o, f) &&
        o.status === "delivered" &&
        inPeriod(o.details.date, f),
    )
    .sort((a, b) => a.details.date.localeCompare(b.details.date));
  const ids = new Set(events.map((o) => o.id));
  const waste = s.waste.filter((w) => ids.has(w.orderId));
  const dishes = (o: Order) =>
    o.costSnapshot?.items.map((i) => ({
      recipeId: i.recipeId,
      name: i.name,
      quantity: i.quantity,
    })) ||
    o.items.map((i) => ({
      recipeId: i.recipeId,
      name: s.recipes.find((r) => r.id === i.recipeId)?.name || "Dish",
      quantity: i.quantity,
    }));
  const portionsOf = (o: Order) =>
    dishes(o).reduce((n, i) => n + i.quantity, 0);
  const guestsOf = (o: Order) => o.wasteCheck?.guests ?? o.details.attendees;
  // Portions that came back: unserved leftovers or counted plate waste.
  const returnedOf = (orderId: string) =>
    waste
      .filter(
        (w) =>
          w.orderId === orderId &&
          w.unit === "portions" &&
          ["unserved portions", "plate waste"].includes(w.category),
      )
      .reduce((n, w) => n + w.quantity, 0);
  const checked = (o: Order) =>
    !!o.wasteCheck || waste.some((w) => w.orderId === o.id);
  const measured = (w: State["waste"][number]) =>
    w.weightMeasured ?? w.weightGrams > 0;
  const measuredEvent = (o: Order) =>
    (o.wasteCheck && o.wasteCheck.plateWasteGrams !== null) ||
    waste.some((w) => w.orderId === o.id && measured(w));
  return {
    events,
    waste,
    dishes,
    portionsOf,
    guestsOf,
    returnedOf,
    checked,
    measured,
    measuredEvent,
  };
}

function headline(c: Cohort) {
  const checkedEvents = c.events.filter(c.checked);
  const checkedPortions = checkedEvents.reduce(
    (n, o) => n + c.portionsOf(o),
    0,
  );
  const returned = checkedEvents.reduce((n, o) => n + c.returnedOf(o.id), 0);
  const measuredEvents = c.events.filter(c.measuredEvent);
  const measuredIds = new Set(measuredEvents.map((o) => o.id));
  const grams = c.waste
    .filter((w) => measuredIds.has(w.orderId) && c.measured(w))
    .reduce((n, w) => n + w.weightGrams, 0);
  const guests = measuredEvents.reduce((n, o) => n + c.guestsOf(o), 0);
  return {
    enjoyedRate: pct(checkedPortions - returned, checkedPortions),
    measuredGrams: measuredEvents.length ? grams : null,
    wastePerGuestGrams:
      measuredEvents.length && guests ? Math.round(grams / guests) : null,
  };
}

function personaFor(rate: number | null, occasions: number) {
  if (rate === null)
    return occasions > 2
      ? {
          title: "The Regulars",
          line: "Good food, again and again. We love feeding your team.",
        }
      : {
          title: "Good Food Fans",
          line: "Thanks for having us. Here is how it went.",
        };
  if (rate >= 97)
    return {
      title: "The Clean Plate Club",
      line: "Almost nothing came back to the kitchen.",
    };
  if (rate >= 92)
    return {
      title: "The Perfect Portioners",
      line: "Your orders matched appetite remarkably well.",
    };
  if (rate >= 85)
    return {
      title: "The Generous Hosts",
      line: "Everyone had plenty, with a little to spare.",
    };
  return {
    title: "The Big-Hearted Hosts",
    line: "Nobody went hungry. A few tweaks will cut leftovers next time.",
  };
}

export function buildWrapped(
  s: State,
  f: ReportFilter,
  options: { note?: string; generatedAt?: string } = {},
): WrappedStory {
  if (!f.customerId) throw Error("Select one customer for a Wrapped report");
  const customer = s.customers.find((c) => c.id === f.customerId);
  if (!customer) throw Error("Customer not found");
  const report = wasteReport(s, f);
  const c = cohort(s, f);
  const now = headline(c);
  const before = headline(cohort(s, previousPeriod(f)));
  const hasBefore =
    before.enjoyedRate !== null || before.wastePerGuestGrams !== null;

  const dishTotals = new Map<
    string,
    { name: string; portions: number; events: number; leftover: number }
  >();
  for (const o of c.events)
    for (const d of c.dishes(o)) {
      const row = dishTotals.get(d.recipeId) || {
        name: d.name,
        portions: 0,
        events: 0,
        leftover: 0,
      };
      row.portions += d.quantity;
      row.events += 1;
      dishTotals.set(d.recipeId, row);
    }
  for (const w of c.waste)
    if (
      w.category === "unserved portions" &&
      w.unit === "portions" &&
      dishTotals.has(w.recipeId)
    )
      dishTotals.get(w.recipeId)!.leftover += w.quantity;
  const topDishes = [...dishTotals.values()]
    .sort((a, b) => b.portions - a.portions || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map(({ name, portions }) => ({ name, portions }));

  const leftovers = c.waste.filter(
    (w) => w.category === "unserved portions" && w.unit === "portions",
  );
  const leftoverPortions = leftovers.reduce((n, w) => n + w.quantity, 0);
  const rehomedPortions = leftovers
    .filter((w) => w.disposal && rehomed.has(w.disposal))
    .reduce((n, w) => n + w.quantity, 0);
  const destined = c.waste.filter((w) => w.disposal && c.measured(w));
  const destinedGrams = destined.reduce((n, w) => n + w.weightGrams, 0);
  const divertedGrams = destined
    .filter((w) => w.disposal !== "general")
    .reduce((n, w) => n + w.weightGrams, 0);

  const scored = c.events
    .filter((o) => c.checked(o) && c.portionsOf(o) > 0)
    .map((o) => ({
      o,
      rate: pct(c.portionsOf(o) - c.returnedOf(o.id), c.portionsOf(o))!,
    }))
    .sort((a, b) => b.rate - a.rate || c.guestsOf(b.o) - c.guestsOf(a.o));
  const best = scored.length > 1 ? scored[0] : null;

  const monthKeys = [
    ...new Set(c.events.map((o) => o.details.date.slice(0, 7))),
  ].sort();
  const months = monthKeys.map((month) => {
    const rows = c.events.filter((o) => o.details.date.startsWith(month));
    const checked = rows.filter(c.checked);
    const portions = checked.reduce((n, o) => n + c.portionsOf(o), 0);
    const returned = checked.reduce((n, o) => n + c.returnedOf(o.id), 0);
    return {
      month,
      label: fmt(`${month}-01`, { month: "short" }),
      portions: rows.reduce((n, o) => n + c.portionsOf(o), 0),
      enjoyedRate: pct(portions - returned, portions),
    };
  });

  const ids = new Set(c.events.map((o) => o.id));
  const feedback = s.feedback.filter((x) => ids.has(x.orderId));
  const quote =
    [...feedback]
      .filter((x) => x.comment.trim().length >= 12)
      .sort(
        (a, b) => b.rating - a.rating || b.comment.length - a.comment.length,
      )[0]
      ?.comment.trim() || null;

  const tips: string[] = [];
  const mostLeft = [...dishTotals.values()]
    .filter((d) => d.leftover >= 2 && d.leftover / d.portions >= 0.1)
    .sort((a, b) => b.leftover / b.portions - a.leftover / a.portions)[0];
  if (mostLeft) {
    const perEvent = Math.max(
      1,
      Math.round(mostLeft.leftover / mostLeft.events),
    );
    tips.push(
      `Order around ${perEvent} fewer ${perEvent === 1 ? "portion" : "portions"} of ${mostLeft.name}. It had the most leftovers.`,
    );
  }
  const counted = c.events.filter((o) => o.wasteCheck?.guests != null);
  const booked = counted.reduce((n, o) => n + o.details.attendees, 0);
  const came = counted.reduce((n, o) => n + (o.wasteCheck!.guests ?? 0), 0);
  if (booked && came < booked * 0.92)
    tips.push(
      `About ${Math.round((1 - came / booked) * 100)}% fewer guests came than were booked. Confirming final numbers 48 hours ahead helps us cook the right amount.`,
    );
  if (now.enjoyedRate !== null && now.enjoyedRate >= 95)
    tips.push("Keep ordering the way you do. Your portions are spot on.");
  if (topDishes[0] && tips.length < 3)
    tips.push(
      `Keep ${topDishes[0].name} on the menu. It was your most ordered dish.`,
    );

  const occasions = c.events.length;
  return {
    version: 1,
    business: s.settings.businessName || "Fork Goodness Baked",
    customer: customer.company || customer.name,
    customerLogoUrl: customer.logoUrl,
    reportedWaste: {
      records: report.waste.length,
      unmeasured: report.unmeasured,
      measuredKg: report.weight / 1000,
      categories: report.categories.map((c) => ({ name: c.name, records: c.records, measuredKg: c.grams / 1000 })),
    },
    from: f.from,
    to: f.to,
    periodLabel: periodLabel(f.from, f.to),
    service: f.service,
    occasions,
    guests: c.events.reduce((n, o) => n + c.guestsOf(o), 0),
    portions: c.events.reduce((n, o) => n + c.portionsOf(o), 0),
    dishCount: dishTotals.size,
    topDishes,
    enjoyedRate: now.enjoyedRate,
    leftoverPortions,
    measuredWasteKg:
      now.measuredGrams === null
        ? null
        : Math.round(now.measuredGrams / 10) / 100,
    wastePerGuestGrams: now.wastePerGuestGrams,
    previous: hasBefore
      ? {
          enjoyedRate: before.enjoyedRate,
          wastePerGuestGrams: before.wastePerGuestGrams,
        }
      : null,
    secondLife: {
      rehomedPortions,
      divertedRate: pct(divertedGrams, destinedGrams),
    },
    bestEvent: best
      ? {
          date: best.o.details.date,
          name: best.o.details.eventType || "Event",
          enjoyedRate: best.rate,
        }
      : null,
    months: months.length > 1 ? months : [],
    feedback: {
      average: feedback.length
        ? Math.round(
            (feedback.reduce((n, x) => n + x.rating, 0) / feedback.length) * 10,
          ) / 10
        : null,
      count: feedback.length,
      quote:
        quote && quote.length > 280
          ? quote.slice(0, 277).trimEnd() + "…"
          : quote,
    },
    persona: personaFor(now.enjoyedRate, occasions),
    tips: tips.slice(0, 3),
    coverage: { checked: c.events.filter(c.checked).length, events: occasions },
    note: (options.note || "").trim(),
    generatedAt: options.generatedAt || today(),
  };
}

// Events in the filter that are finished but have no waste check yet.
export function checksDue(s: State, f: ReportFilter) {
  return s.orders
    .filter(
      (o) =>
        orderMatches(o, f) &&
        checkable(o) &&
        !o.wasteCheck &&
        !s.waste.some((w) => w.orderId === o.id) &&
        o.details.date <= today(),
    )
    .sort((a, b) => b.details.date.localeCompare(a.details.date));
}

// Public read of a shared link. Returns only the frozen story.
export function publicWrapped(
  s: Pick<State, "wrapped">,
  id: string,
): WrappedStory | null {
  const share = (s.wrapped || []).find((x) => x.id === id && !x.revokedAt);
  return share ? share.story : null;
}

const text = z.string().max(500);
const grams = z.number().finite().nonnegative().max(1_000_000);
const optionalDisposal = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.enum(wasteDisposals).optional(),
);

export function wrappedCommand(
  s: State,
  type: string,
  payload: unknown,
  at: string,
): string | undefined {
  switch (type) {
    case "waste-check": {
      const v = z
        .object({
          orderId: z.string().min(1),
          date: dateValue,
          guests: z.number().int().nonnegative().max(100000).nullable(),
          dishes: z
            .array(
              z.object({
                recipeId: z.string().min(1),
                leftover: z.number().int().nonnegative().max(100000),
                weightGrams: grams.nullable(),
              }),
            )
            .max(200),
          plateWasteGrams: grams.nullable(),
          leftoverDisposal: optionalDisposal,
          plateDisposal: optionalDisposal,
          notes: z.string().max(2000).default(""),
        })
        .parse(payload);
      const o = s.orders.find((x) => x.id === v.orderId);
      if (!o) throw Error("Order not found");
      if (!checkable(o))
        throw Error("Waste can be checked once the food has been prepared");
      // A repeated check replaces the previous one for this event.
      s.waste = s.waste.filter(
        (w) => !(w.orderId === o.id && w.source === "check"),
      );
      const reason = v.notes.trim() || "Post-event waste check";
      for (const d of v.dishes) {
        const item = o.costSnapshot?.items.find(
          (x) => x.recipeId === d.recipeId,
        );
        const planned =
          item?.quantity ??
          o.items.find((x) => x.recipeId === d.recipeId)?.quantity;
        if (planned === undefined) throw Error("Select a dish from this order");
        if (!d.leftover && !d.weightGrams) continue;
        const prior = s.waste
          .filter(
            (w) =>
              w.orderId === o.id &&
              w.recipeId === d.recipeId &&
              w.unit === "portions" &&
              ["unserved portions", "plate waste"].includes(w.category),
          )
          .reduce((n, w) => n + w.quantity, 0);
        if (prior + d.leftover > planned)
          throw Error(
            `Leftovers for ${item?.name || "a dish"} exceed the ${planned} portions prepared`,
          );
        if (!d.leftover) continue;
        s.waste.push({
          id: uid(),
          orderId: o.id,
          ingredientId: "",
          recipeId: d.recipeId,
          batchId: "",
          category: "unserved portions",
          quantity: d.leftover,
          unit: "portions",
          weightGrams: d.weightGrams ?? 0,
          weightMeasured: d.weightGrams !== null,
          cost: Math.round((item?.unitCost ?? 0) * d.leftover),
          reason,
          date: v.date,
          disposal: v.leftoverDisposal,
          source: "check",
        });
      }
      if (v.plateWasteGrams)
        s.waste.push({
          id: uid(),
          orderId: o.id,
          ingredientId: "",
          recipeId: "",
          batchId: "",
          category: "plate waste",
          quantity: v.plateWasteGrams,
          unit: "g",
          weightGrams: v.plateWasteGrams,
          weightMeasured: true,
          cost: 0,
          reason,
          date: v.date,
          disposal: v.plateDisposal,
          source: "check",
        });
      o.wasteCheck = {
        date: v.date,
        at,
        guests: v.guests,
        plateWasteGrams: v.plateWasteGrams,
        notes: v.notes.trim(),
      };
      return o.id;
    }
    case "wrapped-share": {
      const v = z
        .object({
          customerId: z.string().min(1),
          from: dateValue,
          to: dateValue,
          service: z.enum(["all", "private", "corporate"]).default("all"),
          note: text.default(""),
          expectedStory: z.string().max(200000).optional(),
        })
        .parse(payload);
      if (v.from > v.to)
        throw Error("The start date must be before the end date");
      const story = buildWrapped(s, v, {
        note: v.note,
        generatedAt: at.slice(0, 10),
      });
      if (v.expectedStory && v.expectedStory !== JSON.stringify({ ...story, generatedAt: "" }))
        throw Error("The report data changed. Generate the wrap-up again before sharing.");
      if (!story.occasions)
        throw Error(
          "This customer has no completed events in the selected period",
        );
      const id = uid().replaceAll("-", "");
      (s.wrapped ||= []).push({
        id,
        customerId: v.customerId,
        from: v.from,
        to: v.to,
        service: v.service,
        createdAt: at,
        story,
      });
      return id;
    }
    case "wrapped-revoke": {
      const v = z.object({ id: z.string().min(1) }).parse(payload);
      const share = (s.wrapped || []).find((x) => x.id === v.id);
      if (!share) throw Error("Shared report not found");
      share.revokedAt ||= at;
      return share.id;
    }
  }
  return undefined;
}
