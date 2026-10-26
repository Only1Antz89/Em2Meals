// AutoSous alerts: everything in the workspace that needs the owner's
// attention, worked out from the records each time (nothing is stored).
// Each alert links to the page or record where it can be dealt with.
import {
  stages,
  today,
  type Order,
  type State,
} from "./domain";
import { draftCurrent, proposals, shortage } from "./operations";
import { batchTrace } from "./recalls";
import { currentSeason, staleItems } from "./menu";

export type AlertSeverity = "urgent" | "warning" | "info";
export type AlertKind =
  | "recall"
  | "food-safety"
  | "expiry"
  | "out-of-date"
  | "fulfilment"
  | "schedule"
  | "progress"
  | "new-order"
  | "customer"
  | "supplier"
  | "idea";
export type AutoSousAlert = {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  path?: string;
  // A question to hand to the AutoSous chat for this alert.
  ask?: string;
};

const CLOSED = ["delivered", "cancelled", "declined"];
const dayNumber = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const round = (n: number) => Math.round(n * 100) / 100;
const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
const orderLabel = (s: State, o: Order) => {
  const c = s.customers.find((x) => x.id === o.customerId);
  return `${o.reference} · ${c?.company || c?.name || o.details.company || o.details.name}`;
};
const ingredientName = (s: State, id: string) =>
  s.ingredients.find((i) => i.id === id)?.name || "Ingredient";
const stageIndex = (status: string) => stages.indexOf(status as (typeof stages)[number]);

function expiryAlerts(s: State, day: string): AutoSousAlert[] {
  const warning = s.settings.warningDays ?? 7;
  const urgent = s.settings.urgentDays ?? 3;
  const out: AutoSousAlert[] = [];
  for (const b of s.batches) {
    if (b.quantity <= 0 || b.quarantined) continue;
    const i = s.ingredients.find((x) => x.id === b.ingredientId);
    const name = `${i?.name || "Ingredient"} (${round(b.quantity)} ${i?.unit || ""}${b.lot ? `, lot ${b.lot}` : ""})`;
    const path = "inventory/storage-expiry";
    if (!b.expiry) {
      out.push({
        id: `expiry-missing-${b.id}`,
        kind: "expiry",
        severity: "warning",
        title: `${name}: label date needed`,
        detail: "Record the supplier label date so this stock can be used for orders.",
        path,
      });
      continue;
    }
    const left = daysBetween(day, b.expiry);
    const useBy = b.dateType === "use-by";
    if (left < 0)
      out.push({
        id: `expiry-passed-${b.id}`,
        kind: "out-of-date",
        severity: useBy ? "urgent" : "warning",
        title: `${name}: ${useBy ? "use-by" : "best-before"} passed`,
        detail: `${useBy ? "Use-by" : "Best-before"} date was ${b.expiry}. ${useBy ? "Dispose of it and record the waste." : "Check quality before use or record it as waste."}`,
        path,
      });
    else if (left <= warning)
      out.push({
        id: `expiry-soon-${b.id}`,
        kind: "expiry",
        severity: useBy && left <= urgent ? "urgent" : "warning",
        title: `${name}: ${left === 0 ? "goes out of date today" : `goes out of date in ${plural(left, "day")}`}`,
        detail: `${useBy ? "Use-by" : "Best-before"} ${b.expiry}, stored ${b.location}.`,
        path,
        ask: `Suggest a dish that uses up ${i?.name || "this ingredient"} before ${b.expiry}.`,
      });
  }
  return out;
}

function recallAlerts(s: State): AutoSousAlert[] {
  const out: AutoSousAlert[] = [];
  for (const r of (s.recalls || []).filter((x) => x.status === "open")) {
    const batches = s.batches.filter((b) => r.batchIds.includes(b.id) && b.quantity > 0);
    const name = r.ingredientId ? ingredientName(s, r.ingredientId) : batches[0] ? ingredientName(s, batches[0].ingredientId) : "Stock";
    const lot = batches[0]?.lot || r.lot;
    out.push({
      id: `recall-${r.id}`,
      kind: "recall",
      severity: "urgent",
      title: `Recall: ${name} lot ${lot} is on hold`,
      detail: `${plural(batches.length, "batch")} quarantined (${batches.map((b) => `${round(b.quantity)} ${s.ingredients.find((i) => i.id === b.ingredientId)?.unit || ""}`).join(", ") || "none on hand"}). ${r.reason}`,
      path: "inventory/storage-expiry",
      ask: `Which orders and customers are affected by the recall of lot ${lot}, and what should I do next?`,
    });
  }
  // Orders that already used recalled stock need the customer contacting.
  for (const r of s.recalls || []) {
    if (r.status === "released") continue;
    const trace = batchTrace(s, r.batchIds);
    for (const o of trace.used)
      out.push({
        id: `recall-used-${r.id}-${o.id}`,
        kind: "recall",
        severity: r.status === "open" ? "urgent" : "warning",
        title: `${orderLabel(s, o)} used recalled lot ${r.lot}`,
        detail: `Stock from this lot went into this order (${o.details.date || "no date"}, ${o.status}). Check the notice and contact the customer if needed.`,
        path: `orders/${o.id}`,
      });
  }
  return out;
}

function fulfilmentAlerts(s: State, day: string): AutoSousAlert[] {
  const out: AutoSousAlert[] = [];
  const open = s.orders.filter((o) => !CLOSED.includes(o.status));
  for (const o of open) {
    if (!o.costSnapshot || o.consumed) continue;
    let lines: ReturnType<typeof shortage> = [];
    try {
      lines = shortage(s, o).filter((l) => l.shortage > 0.0001);
    } catch {
      continue;
    }
    if (!lines.length) continue;
    // Confirmed incoming deliveries that arrive in time cover the gap.
    const uncovered = lines.filter((l) => {
      const incoming = s.purchases
        .filter(
          (p) =>
            p.ingredientId === l.ingredientId &&
            p.status === "ordered" &&
            (!o.details.date || (p.eta && p.eta <= o.details.date)),
        )
        .reduce((n, p) => n + p.quantity - (p.receivedQuantity || 0), 0);
      return incoming + 0.0001 < l.shortage;
    });
    if (!uncovered.length) continue;
    const left = o.details.date ? daysBetween(day, o.details.date) : 99;
    out.push({
      id: `fulfil-${o.id}`,
      kind: "fulfilment",
      severity: left <= 3 ? "urgent" : "warning",
      title: `${orderLabel(s, o)} can't be fulfilled from stock`,
      detail: `Short of ${uncovered
        .slice(0, 4)
        .map((l) => `${round(l.shortage)} ${s.ingredients.find((i) => i.id === l.ingredientId)?.unit || ""} ${ingredientName(s, l.ingredientId)}`)
        .join(", ")}${uncovered.length > 4 ? " and more" : ""}, with no delivery booked in time${o.details.date ? ` for ${o.details.date}` : ""}.`,
      path: `orders/${o.id}`,
      ask: `What do I need to buy for ${o.reference}, from which supplier, and by when?`,
    });
  }
  // Schedule clashes: events on the same day whose times overlap.
  const dated = open.filter((o) => o.details.date && o.details.date >= day);
  const byDate = new Map<string, Order[]>();
  for (const o of dated) byDate.set(o.details.date, [...(byDate.get(o.details.date) || []), o]);
  for (const [date, orders] of byDate) {
    if (orders.length < 2) continue;
    const window = (o: Order) => {
      const start = o.details.arrivalTime || o.details.eventTime;
      if (!start) return null;
      const from = minutes(start);
      const end = o.details.eventEndTime ? minutes(o.details.eventEndTime) : from + 180;
      return [from, Math.max(end, from + 30)] as const;
    };
    for (let a = 0; a < orders.length; a++)
      for (let b = a + 1; b < orders.length; b++) {
        const x = window(orders[a]), y = window(orders[b]);
        const overlap = x && y ? x[0] < y[1] && y[0] < x[1] : null;
        if (overlap === false) continue;
        out.push({
          id: `clash-${orders[a].id}-${orders[b].id}`,
          kind: "schedule",
          severity: overlap ? "warning" : "info",
          title: overlap
            ? `Schedule clash on ${date}`
            : `Two events on ${date}`,
          detail: `${orderLabel(s, orders[a])} and ${orderLabel(s, orders[b])}${overlap ? " overlap in time" : " are on the same day (times not set)"}. Check you can cover both.`,
          path: `orders/${orders[a].id}`,
        });
      }
  }
  return out;
}

function progressAlerts(s: State, day: string): AutoSousAlert[] {
  const out: AutoSousAlert[] = [];
  for (const o of s.orders) {
    if (CLOSED.includes(o.status) || !o.details.date) continue;
    const left = daysBetween(day, o.details.date);
    if (left > 7) continue;
    const stage = stageIndex(o.status);
    const lastUpdate = (o.statusHistory || []).at(-1)?.at?.slice(0, 10) || o.createdAt?.slice(0, 10) || day;
    const idle = daysBetween(lastUpdate, day);
    let severity: AlertSeverity | null = null;
    let why = "";
    if (left < 0) {
      severity = "urgent";
      why = `The event date (${o.details.date}) has passed but it is still marked ${o.status}. Mark it delivered or cancelled.`;
    } else if (["enquiry", "quote"].includes(o.status)) {
      severity = left <= 3 ? "urgent" : "warning";
      why = `The event is ${left === 0 ? "today" : `in ${plural(left, "day")}`} and it is still ${o.status === "enquiry" ? "an enquiry" : "at quote"}. Confirm or decline it.`;
    } else if (left <= 1 && stage < stageIndex("packaged")) {
      severity = "urgent";
      why = `The event is ${left === 0 ? "today" : "tomorrow"} and progress is only at ${o.status}.`;
    } else if (left <= 3 && stage < stageIndex("ingredients ready")) {
      severity = "warning";
      why = `The event is in ${plural(left, "day")} and the order is still at ${o.status}.`;
    } else if (idle >= 5) {
      severity = "info";
      why = `No progress update for ${plural(idle, "day")}, event in ${plural(left, "day")}.`;
    }
    if (severity)
      out.push({
        id: `progress-${o.id}`,
        kind: "progress",
        severity,
        title: `${orderLabel(s, o)} needs a progress update`,
        detail: why,
        path: `orders/${o.id}`,
      });
  }
  return out;
}

function inboxAlerts(s: State, day: string): AutoSousAlert[] {
  const out: AutoSousAlert[] = [];
  for (const o of s.orders) {
    if (o.status !== "enquiry" || !o.createdAt) continue;
    const age = daysBetween(o.createdAt.slice(0, 10), day);
    if (age > 7) continue;
    out.push({
      id: `new-${o.id}`,
      kind: "new-order",
      severity: age >= 2 ? "warning" : "info",
      title: `New enquiry: ${orderLabel(s, o)}`,
      detail: `${o.details.eventType || "Event"} for ${o.details.attendees} on ${o.details.date || "a date to confirm"}${age >= 2 ? `, waiting ${plural(age, "day")} for a reply` : ""}.`,
      path: `orders/${o.id}`,
      ask: `Summarise enquiry ${o.reference} and suggest meals and a quote.`,
    });
  }
  for (const e of s.engagements) {
    if (e.direction !== "inbound") continue;
    const age = daysBetween(e.occurredAt.slice(0, 10), day);
    if (age > 7) continue;
    const c = s.customers.find((x) => x.id === e.customerId);
    if (!c || c.erasedAt) continue;
    out.push({
      id: `message-${e.id}`,
      kind: "customer",
      severity: "info",
      title: `${e.type === "call" ? "Call" : e.type === "email" ? "Email" : "Message"} from ${c.name}${c.company ? ` (${c.company})` : ""}`,
      detail: e.summary.slice(0, 200),
      path: `crm/client/${encodeURIComponent(c.id)}`,
    });
  }
  for (const f of s.feedback) {
    if (daysBetween(f.date, day) > 14) continue;
    const c = s.customers.find((x) => x.id === f.customerId);
    out.push({
      id: `feedback-${f.id}`,
      kind: "customer",
      severity: f.rating <= 2 ? "warning" : "info",
      title: `Feedback from ${c?.name || "a customer"}: ${f.rating}/5`,
      detail: f.comment.slice(0, 200) || "No comment.",
      path: c ? `crm/client/${encodeURIComponent(c.id)}` : "crm",
    });
  }
  for (const f of s.followUps) {
    if (f.status !== "open" || f.dueDate > day) continue;
    const c = s.customers.find((x) => x.id === f.customerId);
    out.push({
      id: `follow-${f.id}`,
      kind: "customer",
      severity: f.dueDate < day ? "warning" : "info",
      title: `Follow up with ${c?.name || "a customer"}${f.dueDate < day ? " (overdue)" : " today"}`,
      detail: f.note,
      path: c ? `crm/client/${encodeURIComponent(c.id)}` : "crm",
    });
  }
  // Supplier side: logged messages, unconfirmed requests, late deliveries.
  for (const sup of s.suppliers)
    for (const [index, m] of sup.comms.entries()) {
      if (daysBetween(m.at.slice(0, 10), day) > 7) continue;
      out.push({
        id: `supplier-${sup.id}-${index}`,
        kind: "supplier",
        severity: /recall|contamin|withdraw|shortage|delay|cancel/i.test(m.message) ? "warning" : "info",
        title: `${sup.name}: ${m.message.slice(0, 80)}`,
        detail: m.message.slice(0, 300),
        path: "suppliers",
      });
    }
  for (const d of s.drafts) {
    if (!d.supplierId || !d.sentAt || d.purchaseConfirmed || d.superseded) continue;
    const age = daysBetween(d.sentAt.slice(0, 10), day);
    if (age < 2) continue;
    out.push({
      id: `request-${d.id}`,
      kind: "supplier",
      severity: "warning",
      title: `${s.suppliers.find((x) => x.id === d.supplierId)?.name || "Supplier"} hasn't confirmed your order`,
      detail: `"${d.subject}" was sent ${plural(age, "day")} ago. Record their reply or chase them.`,
      path: "suppliers?tab=requests",
    });
  }
  for (const p of s.purchases)
    if (p.status === "ordered" && p.eta && p.eta < day)
      out.push({
        id: `late-${p.id}`,
        kind: "supplier",
        severity: "warning",
        title: `Late delivery: ${ingredientName(s, p.ingredientId)}`,
        detail: `${s.suppliers.find((x) => x.id === p.supplierId)?.name || "Supplier"} was due ${p.eta}.`,
        path: "suppliers?tab=purchasing",
      });
  return out;
}

function housekeepingAlerts(s: State, day: string): AutoSousAlert[] {
  const out: AutoSousAlert[] = [];
  for (const i of s.invoices) {
    if (i.kind !== "invoice" || i.status !== "issued" || !i.dueDate || i.dueDate >= day) continue;
    const credited = s.invoices
      .filter((c) => c.originalId === i.id && c.status === "issued")
      .reduce((n, c) => n + c.total, 0);
    const balance = i.total - credited - (i.paid || 0);
    if (balance <= 0) continue;
    out.push({
      id: `invoice-${i.id}`,
      kind: "out-of-date",
      severity: "warning",
      title: `Invoice ${i.number} is overdue`,
      detail: `£${(balance / 100).toFixed(2)} unpaid since ${i.dueDate} (${i.customer}).`,
      path: "business?tab=invoices",
    });
  }
  for (const d of s.drafts)
    if (d.proposal && !d.sentAt && !d.superseded && !draftCurrent(s, d))
      out.push({
        id: `draft-${d.id}`,
        kind: "out-of-date",
        severity: "info",
        title: `Supplier draft needs updating: ${d.subject}`,
        detail: "Demand or stock changed since it was written.",
        path: "suppliers?tab=requests",
      });
  for (const m of s.menus || []) {
    const stale = staleItems(s, m);
    if (m.published && stale.length)
      out.push({
        id: `menu-${m.id}`,
        kind: "out-of-date",
        severity: "info",
        title: `Live menu has ${plural(stale.length, "changed dish")}`,
        detail: `${stale.map((x) => x.name).slice(0, 4).join(", ")} changed since publishing.`,
        path: "menu",
      });
  }
  const season = currentSeason();
  const live = (s.menus || []).find((m) => m.published);
  if (live && (live.season !== season || live.year !== Number(day.slice(0, 4))))
    out.push({
      id: `menu-season-${live.id}`,
      kind: "out-of-date",
      severity: "info",
      title: `Your website shows the ${live.season} ${live.year} menu`,
      detail: `It's ${season} now. Generate and publish the ${season} menu when it's ready.`,
      path: "menu",
      ask: `Suggest dishes for a ${season} ${day.slice(0, 4)} menu using ingredients I have.`,
    });
  const purchasing = proposals(s).flatMap((p) => p.lines).filter((l) => l.deadline && l.deadline <= day);
  if (purchasing.length)
    out.push({
      id: "purchasing-deadline",
      kind: "fulfilment",
      severity: "warning",
      title: `${plural(purchasing.length, "ingredient")} must be ordered today`,
      detail: purchasing.slice(0, 4).map((l) => ingredientName(s, l.ingredientId)).join(", "),
      path: "suppliers?tab=purchasing",
    });
  return out;
}

function ideaAlerts(s: State, day: string): AutoSousAlert[] {
  const warning = s.settings.warningDays ?? 7;
  const soon = Array.from(
    new Set(
      s.batches
        .filter((b) => b.quantity > 0 && !b.quarantined && b.expiry && b.expiry >= day && daysBetween(day, b.expiry) <= warning)
        .map((b) => ingredientName(s, b.ingredientId)),
    ),
  );
  const season = currentSeason();
  const out: AutoSousAlert[] = [
    {
      id: `idea-season-${season}`,
      kind: "idea",
      severity: "info",
      title: `${season} recipe ideas`,
      detail: soon.length
        ? `Ideas for ${season} that use up ${soon.slice(0, 3).join(", ")}.`
        : `Seasonal dish ideas from what you have in stock.`,
      path: "recipes",
      ask: soon.length
        ? `Suggest two ${season} recipes that use ${soon.slice(0, 4).join(", ")} from my stock, and draft the best one.`
        : `Suggest two ${season} recipes I could make from my current catalogue ingredients, and draft the best one.`,
    },
  ];
  return out;
}

const order: Record<AlertSeverity, number> = { urgent: 0, warning: 1, info: 2 };

export function workspaceAlerts(s: State, day = today()): AutoSousAlert[] {
  const all = [
    ...recallAlerts(s),
    ...fulfilmentAlerts(s, day),
    ...progressAlerts(s, day),
    ...expiryAlerts(s, day),
    ...inboxAlerts(s, day),
    ...housekeepingAlerts(s, day),
    ...ideaAlerts(s, day),
  ];
  return all.sort((a, b) => order[a.severity] - order[b.severity]);
}
