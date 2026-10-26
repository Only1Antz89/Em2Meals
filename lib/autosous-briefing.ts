// The AutoSous briefing: what a sous chef would tell you at the start of a
// shift. Services today, tomorrow and later this week with where each one is
// up to and the next job, deliveries due in, what to prep, stock to use
// first, and the alerts that are not tied to a service.
import { needs, stages, today, type Order, type State } from "./domain";
import type { AutoSousAlert } from "./autosous-alerts";

export type BriefingService = {
  id: string;
  reference: string;
  path: string;
  date: string;
  time: string;
  title: string;
  guests: number;
  status: string;
  // 0 to 1, how far through the stages the order is.
  progress: number;
  nextStep: string;
  alerts: AutoSousAlert[];
};
export type BriefingLine = {
  id: string;
  title: string;
  detail: string;
  path?: string;
  ask?: string;
};
export type BriefingDay = {
  id: "today" | "tomorrow" | "week";
  label: string;
  services: BriefingService[];
  deliveries: BriefingLine[];
};
export type Briefing = {
  day: string;
  summary: string;
  days: BriefingDay[];
  prep: { date: string; label: string; dishes: { name: string; portions: number; recipeId: string }[] } | null;
  useFirst: BriefingLine[];
  onThePass: AutoSousAlert[];
  keepAnEye: AutoSousAlert[];
  quiet: boolean;
};

const CLOSED = ["delivered", "cancelled", "declined"];
const dayNumber = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const weekday = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });

function nextStep(s: State, o: Order, left: number, shortages: string[]) {
  switch (o.status) {
    case "enquiry":
      return "Reply with a quote, or decline it";
    case "quote":
      return "Chase the customer to confirm the quote";
    case "confirmed":
      return o.items.length ? "Check stock and order what's missing" : "Add the meals so stock can be planned";
    case "ingredients needed":
      return shortages.length
        ? `Order ${shortages.slice(0, 2).join(" and ")}${shortages.length > 2 ? ` and ${shortages.length - 2} more` : ""}`
        : "Stock is covered: mark ingredients ready";
    case "ingredients ready":
      return left <= 1 ? "Start prep" : "Ingredients in. Prep closer to the day";
    case "prepared":
      return "Cook";
    case "cooked":
      return "Pack and label";
    case "packaged":
      return o.details.arrivalTime ? `Load up for ${o.details.arrivalTime} arrival` : "Load up for delivery";
    case "ready for delivery":
      return `Deliver to ${o.details.venue || o.details.postcode || "the venue"}`;
    default:
      return "Check the order";
  }
}

function service(s: State, o: Order, day: string, alerts: AutoSousAlert[]): BriefingService {
  const c = s.customers.find((x) => x.id === o.customerId);
  const stage = stages.indexOf(o.status as (typeof stages)[number]);
  const left = daysBetween(day, o.details.date);
  // Ingredients still short, by name, for the next-step line.
  let shortages: string[] = [];
  if (o.status === "ingredients needed") {
    try {
      const need = needs(s, o);
      shortages = Object.entries(need)
        .filter(([id, qty]) => {
          const held = o.reservations
            .filter((r) => s.batches.find((b) => b.id === r.batchId)?.ingredientId === id)
            .reduce((n, r) => n + r.quantity, 0);
          return held + 0.0001 < qty;
        })
        .map(([id]) => s.ingredients.find((i) => i.id === id)?.name || "ingredients");
    } catch {}
  }
  const path = `orders/${o.id}`;
  return {
    id: o.id,
    reference: o.reference,
    path,
    date: o.details.date,
    time: o.details.arrivalTime || o.details.eventTime || "",
    title: `${o.details.eventType || "Event"} · ${c?.company || c?.name || o.details.company || o.details.name}`,
    guests: o.details.attendees || 0,
    status: o.status,
    progress: stage < 0 ? 0 : stage / (stages.length - 1),
    nextStep: nextStep(s, o, left, shortages),
    alerts: alerts.filter(
      (a) => a.path === path || a.id.endsWith(`-${o.id}`) || a.id.includes(`-${o.id}-`),
    ),
  };
}

function deliveries(s: State, date: string): BriefingLine[] {
  return s.purchases
    .filter((p) => p.status === "ordered" && p.eta === date)
    .map((p) => {
      const i = s.ingredients.find((x) => x.id === p.ingredientId);
      const sup = s.suppliers.find((x) => x.id === p.supplierId);
      const qty = Math.round((p.quantity - (p.receivedQuantity || 0)) * 100) / 100;
      return {
        id: `delivery-${p.id}`,
        title: `${i?.name || "Ingredient"}: ${qty} ${i?.unit || ""}`.trim(),
        detail: `From ${sup?.name || "your supplier"}. Book it in and record the lot code when it arrives.`,
        path: "suppliers?tab=purchasing",
      };
    });
}

export function kitchenBriefing(
  s: State,
  alerts: AutoSousAlert[],
  day = today(),
): Briefing {
  const tomorrow = new Date(dayNumber(day) * 86400000 + 86400000).toISOString().slice(0, 10);
  const open = s.orders
    .filter((o) => !CLOSED.includes(o.status) && o.details.date)
    .sort((a, b) =>
      `${a.details.date} ${a.details.arrivalTime || a.details.eventTime || "99"}`.localeCompare(
        `${b.details.date} ${b.details.arrivalTime || b.details.eventTime || "99"}`,
      ),
    );
  const within = (from: number, to: number) =>
    open.filter((o) => {
      const left = daysBetween(day, o.details.date);
      return left >= from && left <= to;
    });
  const todayOrders = within(0, 0);
  const tomorrowOrders = within(1, 1);
  const weekOrders = within(2, 7);
  const days: BriefingDay[] = [
    {
      id: "today",
      label: "Today",
      services: todayOrders.map((o) => service(s, o, day, alerts)),
      deliveries: deliveries(s, day),
    },
    {
      id: "tomorrow",
      label: `Tomorrow, ${weekday(tomorrow)}`,
      services: tomorrowOrders.map((o) => service(s, o, day, alerts)),
      deliveries: deliveries(s, tomorrow),
    },
    {
      id: "week",
      label: "Later this week",
      services: weekOrders.map((o) => service(s, o, day, alerts)),
      deliveries: [],
    },
  ];

  // Prep list: the next day with a service that is not yet cooked.
  const prepOrders = [todayOrders, tomorrowOrders]
    .map((list) => list.filter((o) => stages.indexOf(o.status as (typeof stages)[number]) < stages.indexOf("cooked")))
    .find((list) => list.some((o) => o.items.length));
  let prep: Briefing["prep"] = null;
  if (prepOrders) {
    const dishes = new Map<string, { name: string; portions: number; recipeId: string }>();
    for (const o of prepOrders)
      for (const item of o.items) {
        const r = s.recipes.find((x) => x.id === item.recipeId);
        const current = dishes.get(item.recipeId) || { name: r?.name || "Dish", portions: 0, recipeId: item.recipeId };
        current.portions += item.quantity;
        dishes.set(item.recipeId, current);
      }
    const date = prepOrders[0].details.date;
    prep = {
      date,
      label: date === day ? "Prep for today" : "Prep for tomorrow",
      dishes: [...dishes.values()].sort((a, b) => b.portions - a.portions),
    };
  }

  // Stock to use first: going out of date soon, and whether an upcoming
  // service will use it.
  const warning = s.settings.warningDays ?? 7;
  const upcoming = within(0, 7);
  const useFirst: BriefingLine[] = s.batches
    .filter(
      (b) =>
        b.quantity > 0 &&
        !b.quarantined &&
        b.expiry &&
        b.expiry >= day &&
        daysBetween(day, b.expiry) <= Math.min(warning, 4),
    )
    .sort((a, b) => a.expiry.localeCompare(b.expiry))
    .slice(0, 6)
    .map((b) => {
      const i = s.ingredients.find((x) => x.id === b.ingredientId);
      const left = daysBetween(day, b.expiry);
      const earmarked = upcoming.find((o) => {
        try {
          return (needs(s, o)[b.ingredientId] || 0) > 0 && o.details.date <= b.expiry;
        } catch {
          return false;
        }
      });
      const when = left === 0 ? "today" : left === 1 ? "tomorrow" : weekday(b.expiry);
      return {
        id: `use-${b.id}`,
        title: `${i?.name || "Ingredient"} (${Math.round(b.quantity * 100) / 100} ${i?.unit || ""}) by ${when}`,
        detail: earmarked
          ? `Going into ${earmarked.reference} on ${earmarked.details.date === day ? "today's" : weekday(earmarked.details.date) + "'s"} service.`
          : "Not on any service yet. Use it in a special or staff meal, or record it as waste.",
        path: earmarked ? `orders/${earmarked.id}` : "inventory/storage-expiry",
        ask: earmarked ? undefined : `Suggest a dish or special that uses up ${i?.name || "this"} before ${b.expiry}.`,
      };
    });

  // Alerts already shown against a service are not repeated below.
  const attached = new Set(days.flatMap((d) => d.services.flatMap((x) => x.alerts.map((a) => a.id))));
  const loose = alerts.filter((a) => a.kind !== "idea" && !attached.has(a.id) && !a.id.startsWith("expiry-soon-"));
  const onThePass = loose.filter((a) => a.severity === "urgent");
  const keepAnEye = loose.filter((a) => a.severity === "warning").slice(0, 6);

  const guests = (list: Order[]) => list.reduce((n, o) => n + (o.details.attendees || 0), 0);
  const parts: string[] = [];
  if (todayOrders.length)
    parts.push(`${plural(todayOrders.length, "service")} today for ${plural(guests(todayOrders), "guest")}`);
  if (tomorrowOrders.length)
    parts.push(`${plural(tomorrowOrders.length, "service")} tomorrow`);
  if (weekOrders.length) parts.push(`${weekOrders.length} more later this week`);
  const jobs = onThePass.length + days.slice(0, 2).reduce((n, d) => n + d.services.filter((x) => x.alerts.some((a) => a.severity === "urgent")).length, 0);
  const quiet = !todayOrders.length && !tomorrowOrders.length && !weekOrders.length;
  const summary = quiet
    ? `No services booked this week.${onThePass.length ? ` ${plural(onThePass.length, "thing")} to sort first.` : " A good time for menu work or chasing enquiries."}`
    : `${parts.join(", ")}.${jobs ? ` ${plural(jobs, "thing")} need${jobs === 1 ? "s" : ""} you first.` : " Everything is on track."}`;
  return {
    day,
    summary: summary.charAt(0).toUpperCase() + summary.slice(1),
    days,
    prep,
    useFirst,
    onThePass,
    keepAnEye,
    quiet,
  };
}
