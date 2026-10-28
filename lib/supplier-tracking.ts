import { type State, today } from "./domain";

// Learns how each supplier really performs from finished deliveries, so
// purchasing can plan with real lead times instead of the stated ones.

export type DeliveryFeedback = {
  // Did it arrive when the supplier promised?
  arrival: "on-time" | "early" | "late" | "short";
  // Did the kitchen place the order early enough for the event?
  orderedInTime: "yes" | "tight" | "no";
  note: string;
  at: string;
};

export type Delivery = {
  key: string;
  supplierId: string;
  purchaseIds: string[];
  orderedOn: string;
  promisedOn: string;
  receivedOn: string;
  leadDays: number;
  lateDays: number;
  onTime: boolean;
  feedback?: DeliveryFeedback;
};

export type SupplierPerformance = {
  deliveries: number;
  typicalLeadDays: number | null;
  onTimeRate: number | null;
  averageLateDays: number;
  shortDeliveries: number;
  tightOrders: number;
  confirmHours: number | null;
};

export type PlanningLead = {
  days: number;
  // Extra days added to the order-by date when recent orders were too tight.
  orderBuffer: number;
  source: "learned" | "supplier";
  note: string;
};

const day = (value: string) => value.slice(0, 10);
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(day(to)) - Date.parse(day(from))) / 86400000);

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

// The date the kitchen placed an order: when the request was sent, or when
// it was recorded for purchases logged by hand.
function orderedOn(s: State, p: State["purchases"][number]) {
  if (p.orderedOn) return p.orderedOn;
  const request = p.requestId
    ? s.drafts.find((d) => d.id === p.requestId)
    : undefined;
  return day(request?.sentAt || request?.at || p.at || "");
}

// Finished deliveries, one per supplier request (or per hand-logged purchase).
export function deliveries(s: State, supplierId?: string): Delivery[] {
  const groups = new Map<string, State["purchases"]>();
  for (const p of s.purchases) {
    if (supplierId && p.supplierId !== supplierId) continue;
    const key = p.requestId || p.id;
    groups.set(key, [...(groups.get(key) || []), p]);
  }
  const result: Delivery[] = [];
  for (const [key, items] of groups) {
    if (!items.every((p) => p.status === "received" && p.receivedOn)) continue;
    const first = items[0];
    const ordered = orderedOn(s, first);
    if (!ordered) continue;
    const receivedOn = items
      .map((p) => p.receivedOn!)
      .sort()
      .at(-1)!;
    const promisedOn = first.promisedEta || first.eta;
    const feedback = items.find((p) => p.deliveryFeedback)?.deliveryFeedback;
    let lateDays = Math.max(0, daysBetween(promisedOn, receivedOn));
    if (feedback?.arrival === "on-time" || feedback?.arrival === "early")
      lateDays = 0;
    if (feedback?.arrival === "late") lateDays = Math.max(1, lateDays);
    result.push({
      key,
      supplierId: first.supplierId,
      purchaseIds: items.map((p) => p.id),
      orderedOn: ordered,
      promisedOn,
      receivedOn,
      leadDays: Math.max(0, daysBetween(ordered, receivedOn)),
      lateDays,
      onTime: lateDays === 0,
      feedback,
    });
  }
  return result.sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));
}

export function supplierPerformance(
  s: State,
  supplierId: string,
): SupplierPerformance {
  const recent = deliveries(s, supplierId).slice(0, 10);
  const late = recent.filter((d) => !d.onTime);
  const confirmations = s.drafts
    .filter(
      (d) =>
        d.supplierId === supplierId && d.sentAt && d.supplierResponse?.firstAt,
    )
    .map(
      (d) =>
        (Date.parse(d.supplierResponse!.firstAt) - Date.parse(d.sentAt!)) /
        3600000,
    )
    .filter((hours) => hours >= 0);
  return {
    deliveries: recent.length,
    typicalLeadDays: median(recent.map((d) => d.leadDays)),
    onTimeRate: recent.length
      ? (recent.length - late.length) / recent.length
      : null,
    averageLateDays: late.length
      ? late.reduce((n, d) => n + d.lateDays, 0) / late.length
      : 0,
    shortDeliveries: recent.filter((d) => d.feedback?.arrival === "short")
      .length,
    tightOrders: recent
      .filter((d) => d.feedback)
      .slice(0, 3)
      .filter((d) => d.feedback!.orderedInTime !== "yes").length,
    confirmHours: median(confirmations),
  };
}

// How many days to plan for when ordering from this supplier. Two or more
// finished deliveries replace the stated lead time with the real one, plus
// a safety margin when the supplier is often late.
export function planningLead(s: State, supplierId: string): PlanningLead {
  const supplier = s.suppliers.find((x) => x.id === supplierId);
  const stated = supplier?.leadDays || 0;
  const perf = supplierPerformance(s, supplierId);
  const orderBuffer = perf.tightOrders ? 1 : 0;
  if (perf.deliveries < 2 || perf.typicalLeadDays === null)
    return {
      days: stated,
      orderBuffer,
      source: "supplier",
      note: `Supplier's stated lead time (${stated} ${stated === 1 ? "day" : "days"})`,
    };
  const margin =
    perf.onTimeRate !== null && perf.onTimeRate < 0.8
      ? Math.ceil(perf.averageLateDays)
      : 0;
  const days = Math.ceil(perf.typicalLeadDays) + margin;
  return {
    days,
    orderBuffer,
    source: "learned",
    note: `Usually ${Math.ceil(perf.typicalLeadDays)} ${Math.ceil(perf.typicalLeadDays) === 1 ? "day" : "days"} from ${perf.deliveries} deliveries${margin ? `, plus ${margin} for late arrivals` : ""}`,
  };
}

// Received deliveries the kitchen has not yet rated, newest first.
export function awaitingFeedback(s: State, withinDays = 21) {
  const now = today();
  return deliveries(s).filter(
    (d) => !d.feedback && daysBetween(d.receivedOn, now) <= withinDays,
  );
}
