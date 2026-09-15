import { z } from "zod";
import { type State, type Order, today, uid } from "./domain";
import { dateValue, tax } from "./operations";

export const industries = [
  "Unclassified",
  "Business & professional services",
  "Education",
  "Healthcare",
  "Hospitality",
  "Public sector",
  "Charity & nonprofit",
  "Individual / household",
  "Other",
] as const;
export type Service = "private" | "corporate" | "shared" | "unclassified";
export const costTypes = [
  "ingredients",
  "labour",
  "travel",
  "overhead",
  "other",
] as const;
export type FinanceExtra = {
  service?: Service;
  costType?: (typeof costTypes)[number];
  incurredDate?: string;
  paymentDate?: string;
  status?: "actual" | "estimated";
  net?: number;
  vat?: number;
  recoverableVAT?: number;
  purchaseId?: string;
  journeyId?: string;
  hours?: number;
  excluded?: boolean;
  reconciliationNote?: string;
};
export type Journey = {
  id: string;
  orderId: string;
  service: Service;
  date: string;
  miles: number;
  minutes: number;
  fuelCost: number | null;
  extraCost: number;
  status: "actual" | "estimated";
  notes: string;
};
export type ReportFilter = {
  from: string;
  to: string;
  customerId: string;
  service: "all" | "private" | "corporate";
};
export const defaultFilter = (): ReportFilter => ({
  from: today().slice(0, 7) + "-01",
  to: today(),
  customerId: "",
  service: "all",
});
export const inPeriod = (
  date: string | undefined,
  f: Pick<ReportFilter, "from" | "to">,
) => !!date && date >= f.from && date <= f.to;
export const orderMatches = (o: Order, f: ReportFilter) =>
  (!f.customerId || o.customerId === f.customerId) &&
  (f.service === "all" || o.details.service === f.service);
export function previousPeriod(f: ReportFilter): ReportFilter {
  const days =
    Math.round((Date.parse(f.to) - Date.parse(f.from)) / 86400000) + 1;
  return {
    ...f,
    from: new Date(Date.parse(f.from) - days * 86400000)
      .toISOString()
      .slice(0, 10),
    to: new Date(Date.parse(f.from) - 86400000).toISOString().slice(0, 10),
  };
}
export function presetDates(preset: string, day = today()) {
  const year = day.slice(0, 4),
    month = day.slice(0, 7);
  const first = new Date(`${month}-01T00:00:00Z`);
  if (preset === "last-month")
    return {
      from: new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1),
      )
        .toISOString()
        .slice(0, 10),
      to: new Date(+first - 86400000).toISOString().slice(0, 10),
    };
  if (preset === "year") return { from: `${year}-01-01`, to: day };
  if (preset === "twelve-months")
    return {
      from: new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 11, 1),
      )
        .toISOString()
        .slice(0, 10),
      to: day,
    };
  return { from: `${month}-01`, to: day };
}
export function filtersFromURL(params: URLSearchParams): ReportFilter {
  const defaults = defaultFilter();
  const from = params.get("from") || defaults.from,
    to = params.get("to") || defaults.to;
  const valid =
    dateValue.safeParse(from).success &&
    dateValue.safeParse(to).success &&
    from <= to;
  return {
    from: valid ? from : defaults.from,
    to: valid ? to : defaults.to,
    customerId: params.get("customer") || "",
    service:
      params.get("service") === "private"
        ? "private"
        : params.get("service") === "corporate"
          ? "corporate"
          : "all",
  };
}
export function wasteReport(s: State, f: ReportFilter) {
  const orders = s.orders.filter((o) => orderMatches(o, f)),
    ids = new Set(orders.map((o) => o.id));
  const waste = s.waste.filter(
    (w) =>
      inPeriod(w.date, f) &&
      (w.orderId ? ids.has(w.orderId) : !f.customerId && f.service === "all"),
  );
  const completed = orders.filter(
      (o) => o.status === "delivered" && inPeriod(o.details.date, f),
    ),
    completedIds = new Set(completed.map((o) => o.id));
  const cohortWaste = s.waste.filter((w) => completedIds.has(w.orderId));
  const portions = completed.reduce(
    (n, o) =>
      n +
      (o.costSnapshot?.items || o.items).reduce((n, i) => n + i.quantity, 0),
    0,
  );
  const unserved = cohortWaste
    .filter((w) => w.category === "unserved portions" && w.unit === "portions")
    .reduce((n, w) => n + w.quantity, 0);
  const popular = new Map<string, number>();
  for (const o of completed)
    for (const i of o.costSnapshot?.items || [])
      popular.set(i.name, (popular.get(i.name) || 0) + i.quantity);
  const feedback = s.feedback.filter(
    (x) => completedIds.has(x.orderId) && inPeriod(x.date, f),
  );
  const categories = [
    "preparation trimmings",
    "spoilage",
    "unserved portions",
    "plate waste",
  ].map((category) => {
    const rows = waste.filter((w) => w.category === category);
    return {
      name: category,
      grams: rows.reduce((n, w) => n + w.weightGrams, 0),
      cost: rows.reduce((n, w) => n + w.cost, 0),
      records: rows.length,
    };
  });
  return {
    waste,
    completed,
    portions,
    unserved,
    unservedRate: portions ? (unserved / portions) * 100 : null,
    weight: waste.reduce((n, w) => n + w.weightGrams, 0),
    unmeasured: waste.filter((w) => !(w.weightMeasured ?? w.weightGrams > 0))
      .length,
    cost: waste.reduce((n, w) => n + w.cost, 0),
    categories,
    popular: [...popular]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity),
    feedback,
    averageFeedback: feedback.length
      ? feedback.reduce((n, x) => n + x.rating, 0) / feedback.length
      : null,
  };
}
export function customerExport(s: State, f: ReportFilter) {
  if (!f.customerId)
    throw Error("Select one customer for a customer-facing recap");
  const customer = s.customers.find((c) => c.id === f.customerId);
  if (!customer) throw Error("Customer not found");
  const r = wasteReport(s, f);
  // Deliberate allowlist: internal waste cost, supplier, invoices and margins never enter exports.
  return {
    customer: customer.company || customer.name,
    from: f.from,
    to: f.to,
    service: f.service,
    occasions: r.completed.length,
    portions: r.portions,
    measuredWasteKg: r.weight / 1000,
    unmeasuredRecords: r.unmeasured,
    unservedPortions: r.unserved,
    unservedRate: r.unservedRate,
    feedback: r.averageFeedback,
    popular: r.popular,
  };
}
function attributed(
  s: State,
  record: { orderId?: string; service?: Service },
  f: ReportFilter,
) {
  if (record.orderId) {
    const o = s.orders.find((o) => o.id === record.orderId);
    return !!o && orderMatches(o, f);
  }
  if (f.customerId) return false;
  return f.service === "all" || record.service === f.service;
}
export const expenseCost = (f: State["finance"][number]) =>
  f.amount - (f.recoverableVAT || 0);
export type Job = {
  order: Order;
  revenue: number;
  ingredients: number;
  labour: number;
  travel: number;
  miles: number;
  minutes: number;
  fuel: number;
  extra: number;
  grossProfit: number;
  estimatedRevenue: boolean;
  estimatedIngredients: boolean;
  estimatedTravel: boolean;
  estimatedMileage: boolean;
  missingLabour: boolean;
  missingFuel: boolean;
  estimatedLabour: boolean;
};
export function jobPerformance(s: State, o: Order): Job {
  const invoices = s.invoices.filter(
    (i) => i.orderId === o.id && i.status === "issued",
  );
  const hasInvoice = invoices.some((i) => i.kind === "invoice");
  const revenue = hasInvoice
    ? invoices.reduce((n, i) => n + (i.kind === "credit" ? -i.net : i.net), 0)
    : o.quotes.at(-1)?.net || 0;
  const movements = s.movements.filter(
    (m) => m.orderId === o.id && m.quantity < 0 && m.reason !== "Spoilage",
  );
  const snapshotComplete =
    movements.length > 0 && movements.every((m) => m.cost !== undefined);
  const ingredients = snapshotComplete
    ? movements.reduce((n, m) => n + (m.cost || 0), 0)
    : o.costSnapshot?.total || 0;
  const expenses = s.finance.filter(
    (x) => !x.excluded && x.type === "expense" && x.orderId === o.id,
  );
  const labour = expenses.filter((x) => x.costType === "labour");
  const journeys = s.journeys.filter((j) => j.orderId === o.id);
  const actual = journeys.filter((j) => j.status === "actual"),
    selected = actual.length ? actual : journeys;
  const travelExpenses = expenses.filter(
    (x) => x.costType === "travel" && !x.journeyId,
  );
  const actualExpenses = travelExpenses.filter((x) => x.status === "actual");
  const chosenExpenses = actualExpenses.length
    ? actualExpenses
    : travelExpenses;
  const miles = selected.length
    ? selected.reduce((n, j) => n + j.miles, 0)
    : o.route?.miles || 0;
  const minutes = selected.length
    ? selected.reduce((n, j) => n + j.minutes, 0)
    : o.route?.minutes || 0;
  const fuel = selected.length
    ? selected.reduce((n, j) => n + (j.fuelCost || 0), 0)
    : o.route?.fuelCost || 0;
  const extra = selected.length
    ? selected.reduce((n, j) => n + j.extraCost, 0)
    : o.route?.extraCost || 0;
  const missingFuel = selected.length
    ? selected.some((j) => j.fuelCost === null)
    : o.route?.fuelCost == null;
  // A standalone actual travel expense replaces the route's monetary estimate.
  const travel = selected.length
    ? fuel + extra + chosenExpenses.reduce((n, x) => n + expenseCost(x), 0)
    : chosenExpenses.length
      ? chosenExpenses.reduce((n, x) => n + expenseCost(x), 0)
      : fuel + extra;
  const labourCost = labour.reduce((n, x) => n + expenseCost(x), 0);
  return {
    order: o,
    revenue,
    ingredients,
    labour: labourCost,
    travel,
    miles,
    minutes,
    fuel,
    extra,
    grossProfit: revenue - ingredients - labourCost - travel,
    estimatedRevenue: !hasInvoice,
    estimatedIngredients: !snapshotComplete,
    estimatedTravel: selected.length
      ? selected.some((j) => j.status === "estimated")
      : !actualExpenses.length,
    estimatedMileage:
      !selected.length || selected.some((j) => j.status === "estimated"),
    missingLabour: !labour.length,
    missingFuel,
    estimatedLabour: labour.some((x) => x.status !== "actual"),
  };
}
export function businessReport(s: State, f: ReportFilter) {
  const orders = s.orders.filter((o) => orderMatches(o, f));
  const ids = new Set(orders.map((o) => o.id));
  const invoices = s.invoices.filter(
    (i) =>
      i.status === "issued" && ids.has(i.orderId) && inPeriod(i.issueDate, f),
  );
  const signed = (key: "net" | "vat" | "total") =>
    invoices.reduce((n, i) => n + (i.kind === "credit" ? -i[key] : i[key]), 0);
  const finance = s.finance.filter((x) => !x.excluded && attributed(s, x, f));
  const cash = finance.filter(
    (x) => x.status !== "estimated" && inPeriod(x.paymentDate ?? x.date, f),
  );
  const cashIn = cash
      .filter((x) => x.type === "income")
      .reduce((n, x) => n + x.amount, 0),
    cashOut = cash
      .filter((x) => x.type === "expense")
      .reduce((n, x) => n + x.amount, 0);
  const jobs = orders
    .filter((o) => o.status === "delivered" && inPeriod(o.details.date, f))
    .map((o) => jobPerformance(s, o));
  const sum = (
    key:
      | "revenue"
      | "ingredients"
      | "labour"
      | "travel"
      | "grossProfit"
      | "miles"
      | "minutes"
      | "fuel"
      | "extra",
  ) => jobs.reduce((n, j) => n + j[key], 0);
  const periodExpenses = finance.filter(
    (x) =>
      x.type === "expense" &&
      x.costType &&
      inPeriod(x.incurredDate ?? x.date, f),
  );
  const overhead = periodExpenses.filter(
    (x) =>
      !["ingredients", "labour", "travel"].includes(x.costType!) ||
      (!x.orderId && !x.journeyId && x.costType !== "ingredients"),
  );
  const standaloneJourneys = s.journeys.filter(
    (j) => !j.orderId && attributed(s, j, f) && inPeriod(j.date, f),
  );
  const standaloneTravel = standaloneJourneys.reduce(
    (n, j) => n + (j.fuelCost || 0) + j.extraCost,
    0,
  );
  const lossMovements = s.movements.filter(
    (m) =>
      (!m.orderId ||
        m.reason === "Spoilage" ||
        (m.orderId &&
          s.orders.some(
            (o) => o.id === m.orderId && o.status === "cancelled",
          ))) &&
      m.quantity < 0 &&
      inPeriod(m.at.slice(0, 10), f) &&
      (m.orderId ? ids.has(m.orderId) : !f.customerId && f.service === "all"),
  );
  const losses = lossMovements.reduce(
    (n, m) =>
      n + (m.cost ?? s.waste.find((w) => w.movementId === m.id)?.cost ?? 0),
    0,
  );
  const overheadCost =
    overhead.reduce((n, x) => n + expenseCost(x), 0) + standaloneTravel;
  const shared =
    overhead
      .filter((x) => !x.orderId && x.service === "shared")
      .reduce((n, x) => n + expenseCost(x), 0) +
    standaloneJourneys
      .filter((j) => j.service === "shared")
      .reduce((n, j) => n + (j.fuelCost || 0) + j.extraCost, 0);
  const outstanding = s.invoices
    .filter(
      (i) =>
        i.kind === "invoice" &&
        i.status === "issued" &&
        ids.has(i.orderId) &&
        i.issueDate <= f.to,
    )
    .map((i) => {
      const credits = s.invoices
        .filter(
          (c) =>
            c.originalId === i.id &&
            c.status === "issued" &&
            c.issueDate <= f.to,
        )
        .reduce((n, c) => n + c.total, 0);
      const payments = s.finance
        .filter(
          (p) =>
            !p.excluded &&
            p.type === "income" &&
            p.invoiceId === i.id &&
            (p.paymentDate ?? p.date) <= f.to,
        )
        .reduce((n, p) => n + p.amount, 0);
      return { invoice: i, balance: Math.max(0, i.total - credits - payments) };
    });
  const unclassified = finance.filter(
    (x) =>
      !x.costType &&
      !x.invoiceId &&
      !x.reconciliationNote &&
      inPeriod(x.date, f),
  );
  const bookings = orders.filter(
    (o) =>
      !!o.costSnapshot &&
      !["cancelled", "declined", "delivered"].includes(o.status) &&
      o.details.date >= today(),
  );
  const segments = (["private", "corporate"] as const).map((service) => {
    const js = jobs.filter((j) => j.order.details.service === service);
    const rev = js.reduce((n, j) => n + j.revenue, 0);
    const direct = js.reduce(
      (n, j) => n + j.ingredients + j.labour + j.travel,
      0,
    );
    const operating =
      overhead
        .filter((x) =>
          x.orderId
            ? s.orders.find((o) => o.id === x.orderId)?.details.service ===
              service
            : x.service === service,
        )
        .reduce((n, x) => n + expenseCost(x), 0) +
      standaloneJourneys
        .filter((j) => j.service === service)
        .reduce((n, j) => n + (j.fuelCost || 0) + j.extraCost, 0);
    const segmentLoss = lossMovements
      .filter(
        (m) =>
          m.orderId &&
          s.orders.find((o) => o.id === m.orderId)?.details.service === service,
      )
      .reduce(
        (n, m) =>
          n + (m.cost ?? s.waste.find((w) => w.movementId === m.id)?.cost ?? 0),
        0,
      );
    const customers = new Set(js.map((j) => j.order.customerId));
    return {
      service,
      jobs: js.length,
      portions: js.reduce(
        (n, j) => n + j.order.items.reduce((n, i) => n + i.quantity, 0),
        0,
      ),
      revenue: rev,
      direct,
      operating: operating + segmentLoss,
      contribution: rev - direct - operating - segmentLoss,
      repeatCustomers: [...customers].filter(
        (id) =>
          s.orders.filter(
            (o) =>
              o.customerId === id &&
              o.status === "delivered" &&
              o.details.date <= f.to &&
              o.details.service === service,
          ).length > 1,
      ).length,
      share: jobs.length ? (js.length / jobs.length) * 100 : 0,
    };
  });
  const customers = s.customers
    .filter((c) => !f.customerId || c.id === f.customerId)
    .map((c) => {
      const js = jobs.filter((j) => j.order.customerId === c.id);
      const waste = wasteReport(s, { ...f, customerId: c.id });
      return {
        id: c.id,
        name: c.company || c.name,
        jobs: js.length,
        revenue: js.reduce((n, j) => n + j.revenue, 0),
        average: js.length
          ? js.reduce((n, j) => n + j.revenue, 0) / js.length
          : 0,
        repeat:
          js.length > 0 &&
          s.orders.filter(
            (o) =>
              o.customerId === c.id &&
              o.status === "delivered" &&
              o.details.date <= f.to,
          ).length > 1,
        last:
          s.orders
            .filter(
              (o) =>
                o.customerId === c.id &&
                o.status === "delivered" &&
                o.details.date <= f.to,
            )
            .map((o) => o.details.date)
            .sort()
            .at(-1) || "",
        feedback: waste.averageFeedback,
        waste: waste.weight,
        orders: js.map((j) => j.order.id),
      };
    })
    .filter((c) => c.jobs > 0 || c.waste > 0);
  // A combined purchase cannot be allocated arbitrarily to one customer or service.
  const purchaseMatches = (p: State["purchases"][number]) =>
    (!f.customerId && f.service === "all") ||
    (!!p.orderIds?.length && p.orderIds.every((id) => ids.has(id)));
  const purchases = s.purchases.filter(
    (p) => inPeriod(p.at?.slice(0, 10), f) && purchaseMatches(p),
  );
  const suppliers = s.suppliers
    .map((sup) => {
      const ps = purchases.filter((p) => p.supplierId === sup.id);
      const open = s.purchases.filter(
        (p) =>
          p.supplierId === sup.id &&
          p.status === "ordered" &&
          purchaseMatches(p),
      );
      return {
        id: sup.id,
        name: sup.name,
        spend: ps.reduce((n, p) => n + p.cost, 0),
        orders: new Set(ps.map((p) => p.requestId || p.id)).size,
        ingredients: new Set(ps.map((p) => p.ingredientId)).size,
        outstanding: open.length,
        overdue: open.filter((p) => p.eta < today()).length,
        purchaseIds: ps.map((p) => p.id),
      };
    })
    .filter((x) => x.orders || x.outstanding);
  const ingredients = s.ingredients
    .map((i) => {
      const ps = purchases
        .filter((p) => p.ingredientId === i.id)
        .sort((a, b) => (a.at || "").localeCompare(b.at || ""));
      const moves = s.movements.filter(
        (m) =>
          s.batches.find((b) => b.id === m.batchId)?.ingredientId === i.id &&
          m.orderId &&
          jobs.some((j) => j.order.id === m.orderId) &&
          m.quantity < 0 &&
          m.reason !== "Spoilage",
      );
      const first = ps[0],
        last = ps.at(-1);
      return {
        id: i.id,
        name: i.name,
        unit: i.unit,
        spend: ps.reduce((n, p) => n + p.cost, 0),
        purchased: ps.reduce((n, p) => n + p.quantity, 0),
        used: moves.reduce((n, m) => n - m.quantity, 0),
        consumptionCost: moves.reduce((n, m) => n + (m.cost || 0), 0),
        priceChange:
          first && last && first !== last && first.cost > 0
            ? (last.cost / last.quantity / (first.cost / first.quantity) - 1) *
              100
            : null,
        waste: wasteReport(s, f)
          .waste.filter((w) => w.ingredientId === i.id)
          .reduce((n, w) => n + w.weightGrams, 0),
      };
    })
    .filter((i) => i.spend || i.used || i.waste);
  const rank = (key: (o: Order) => string) => {
    const rows = new Map<
      string,
      {
        name: string;
        jobs: number;
        revenue: number;
        miles: number;
        travel: number;
        orders: string[];
      }
    >();
    for (const j of jobs) {
      const name = key(j.order) || "Unclassified";
      const r = rows.get(name) || {
        name,
        jobs: 0,
        revenue: 0,
        miles: 0,
        travel: 0,
        orders: [],
      };
      r.jobs++;
      r.revenue += j.revenue;
      r.miles += j.miles;
      r.travel += j.travel;
      r.orders.push(j.order.id);
      rows.set(name, r);
    }
    return [...rows.values()].sort((a, b) => b.jobs - a.jobs);
  };
  const places = rank(
    (o) =>
      o.details.postcode
        ?.trim()
        .toUpperCase()
        .match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/)?.[1] ||
      o.details.postcode
        ?.trim()
        .toUpperCase()
        .match(/^[A-Z]{1,2}\d[A-Z\d]?$/)?.[0] ||
      o.details.locality ||
      o.details.place?.locality ||
      "",
  );
  const sectors = rank(
      (o) =>
        s.customers.find((c) => c.id === o.customerId)?.industry ||
        "Unclassified",
    ),
    events = rank((o) => o.details.eventType);
  const warnings = {
    revenueEstimates: jobs.filter((j) => j.estimatedRevenue).length,
    ingredientEstimates: jobs.filter((j) => j.estimatedIngredients).length,
    missingLabour: jobs.filter((j) => j.missingLabour).length,
    estimatedLabour: jobs.filter((j) => j.estimatedLabour).length,
    estimatedTravel: jobs.filter((j) => j.estimatedTravel).length,
    missingFuel: jobs.filter((j) => j.missingFuel).length,
    unclassified: unclassified.length,
    undatedPurchases: s.purchases.filter((p) => !p.at).length,
    estimatedOperating:
      overhead.filter((x) => x.status === "estimated").length +
      standaloneJourneys.filter((j) => j.status === "estimated").length,
    unknownLossCost: lossMovements.filter(
      (m) =>
        m.cost === undefined && !s.waste.some((w) => w.movementId === m.id),
    ).length,
  };
  return {
    invoices,
    cash,
    cashIn,
    cashOut,
    cashChange: cashIn - cashOut,
    salesNet: signed("net"),
    vat: signed("vat"),
    salesGross: signed("total"),
    credits: invoices
      .filter((i) => i.kind === "credit")
      .reduce((n, i) => n + i.total, 0),
    outstanding,
    unpaid: outstanding.reduce((n, x) => n + x.balance, 0),
    overdue: outstanding
      .filter((x) => x.invoice.dueDate < f.to)
      .reduce((n, x) => n + x.balance, 0),
    jobs,
    revenue: sum("revenue"),
    ingredientCost: sum("ingredients"),
    labour: sum("labour"),
    travel: sum("travel"),
    grossProfit: sum("grossProfit"),
    grossMargin: sum("revenue")
      ? (sum("grossProfit") / sum("revenue")) * 100
      : null,
    operating: overheadCost,
    shared,
    losses,
    netProfit: sum("grossProfit") - overheadCost - losses,
    actualMiles:
      jobs.filter((j) => !j.estimatedMileage).reduce((n, j) => n + j.miles, 0) +
      standaloneJourneys
        .filter((j) => j.status === "actual")
        .reduce((n, j) => n + j.miles, 0),
    estimatedMiles:
      jobs.filter((j) => j.estimatedMileage).reduce((n, j) => n + j.miles, 0) +
      standaloneJourneys
        .filter((j) => j.status === "estimated")
        .reduce((n, j) => n + j.miles, 0),
    miles: sum("miles") + standaloneJourneys.reduce((n, j) => n + j.miles, 0),
    minutes:
      sum("minutes") + standaloneJourneys.reduce((n, j) => n + j.minutes, 0),
    fuel:
      sum("fuel") +
      standaloneJourneys.reduce((n, j) => n + (j.fuelCost || 0), 0),
    extras:
      sum("extra") + standaloneJourneys.reduce((n, j) => n + j.extraCost, 0),
    bookings,
    bookingValue: bookings.reduce((n, o) => n + (o.quotes.at(-1)?.net || 0), 0),
    enquiries: orders.filter(
      (o) =>
        ["enquiry", "quote"].includes(o.status) && inPeriod(o.details.date, f),
    ).length,
    cancellations: orders.filter(
      (o) =>
        ["cancelled", "declined"].includes(o.status) &&
        inPeriod(o.details.date, f),
    ).length,
    segments,
    customers,
    suppliers,
    ingredients,
    places,
    sectors,
    events,
    unclassified,
    warnings,
    purchases,
    overhead,
  };
}
export function monthlyTrends(s: State, f: ReportFilter) {
  const results = [];
  let month = f.from.slice(0, 7);
  while (month <= f.to.slice(0, 7)) {
    const start = `${month}-01`,
      d = new Date(start);
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
        .toISOString()
        .slice(0, 10),
      end = new Date(Date.parse(next) - 86400000).toISOString().slice(0, 10);
    const filter = {
      ...f,
      from: start < f.from ? f.from : start,
      to: end > f.to ? f.to : end,
    };
    const b = businessReport(s, filter),
      w = wasteReport(s, filter);
    results.push({
      month,
      sales: b.salesNet / 100,
      cash: b.cashIn / 100,
      profit: b.netProfit / 100,
      waste: w.weight / 1000,
    });
    month = next.slice(0, 7);
  }
  return results;
}
const amount = z.number().int().nonnegative().max(1e12),
  num = z.number().finite().nonnegative().max(1e9),
  text = z.string().max(1000),
  maybeDate = z.union([dateValue, z.literal("")]);
function serviceFor(s: State, orderId: string, service: Service): Service {
  if (!orderId) return service;
  const o = s.orders.find((o) => o.id === orderId);
  if (!o) throw Error("Order not found");
  return o.details.service as Service;
}
export function reportingCommand(
  s: State,
  type: string,
  payload: unknown,
): string | undefined {
  const p = z.record(z.unknown()).parse(payload);
  switch (type) {
    case "expense": {
      const v = z
        .object({
          id: text.optional(),
          orderId: text.default(""),
          purchaseId: text.default(""),
          service: z.enum(["private", "corporate", "shared"]),
          costType: z.enum(costTypes),
          description: text.min(1),
          amount,
          vatRate: num.max(100),
          priceMode: z.enum(["inclusive", "exclusive"]),
          vatRecoverable: z.boolean(),
          incurredDate: dateValue,
          paymentDate: maybeDate,
          status: z.enum(["actual", "estimated"]),
          hours: num.optional(),
        })
        .parse(p);
      const old = s.finance.find((x) => x.id === v.id);
      if (v.id && (!old || old.type !== "expense" || old.journeyId))
        throw Error("Select an editable expense");
      if (v.purchaseId && !s.purchases.some((x) => x.id === v.purchaseId))
        throw Error("Purchase not found");
      if (v.purchaseId && v.costType !== "ingredients")
        throw Error(
          "Purchase payments must be classified as ingredients; consumption determines job cost",
        );
      const totals = tax(v.amount, v.vatRate, v.priceMode);
      const id = v.id || uid();
      s.finance = s.finance
        .filter((x) => x.id !== id)
        .concat({
          id,
          type: "expense",
          ...v,
          amount: totals.total,
          net: totals.net,
          vat: totals.vat,
          recoverableVAT: v.vatRecoverable ? totals.vat : 0,
          service: serviceFor(s, v.orderId, v.service),
          date: v.paymentDate || v.incurredDate,
          category: v.costType,
        });
      return id;
    }
    case "journey": {
      const v = z
        .object({
          id: text.optional(),
          orderId: text.default(""),
          service: z.enum(["private", "corporate", "shared"]),
          date: dateValue,
          miles: num,
          minutes: num,
          fuelCost: amount.nullable(),
          extraCost: amount,
          status: z.enum(["actual", "estimated"]),
          notes: text,
          paymentDate: maybeDate,
        })
        .parse(p);
      if (v.id && !s.journeys.some((j) => j.id === v.id))
        throw Error("Journey not found");
      const id = v.id || uid(),
        service = serviceFor(s, v.orderId, v.service);
      s.journeys = s.journeys
        .filter((j) => j.id !== id)
        .concat({ ...v, id, service });
      const old = s.finance.find((x) => x.journeyId === id);
      s.finance = s.finance
        .filter((x) => x.journeyId !== id)
        .concat({
          id: old?.id || uid(),
          journeyId: id,
          orderId: v.orderId,
          service,
          type: "expense",
          costType: "travel",
          category: "Travel",
          description: v.notes || "Journey costs",
          amount: (v.fuelCost || 0) + v.extraCost,
          recoverableVAT: 0,
          incurredDate: v.date,
          paymentDate: v.paymentDate,
          date: v.paymentDate || v.date,
          status: v.status,
        });
      return id;
    }
    case "income-link": {
      const v = z
        .object({
          id: text,
          orderId: text.default(""),
          invoiceId: text.default(""),
        })
        .parse(p);
      const f = s.finance.find((x) => x.id === v.id);
      if (!f || f.type !== "income" || f.invoiceId || f.excluded)
        throw Error("Select an unlinked income record");
      const invoice = v.invoiceId
        ? s.invoices.find(
            (i) =>
              i.id === v.invoiceId &&
              i.status === "issued" &&
              i.kind === "invoice",
          )
        : undefined;
      if (v.invoiceId && !invoice) throw Error("Issued invoice not found");
      if (invoice) {
        const credits = s.invoices
          .filter((i) => i.originalId === invoice.id && i.status === "issued")
          .reduce((n, i) => n + i.total, 0);
        if (invoice.paid + f.amount > invoice.total - credits)
          throw Error(
            "Income exceeds the remaining invoice balance; check for a duplicate",
          );
        invoice.paid += f.amount;
        f.invoiceId = invoice.id;
      }
      f.orderId = invoice?.orderId || v.orderId;
      f.service = serviceFor(s, f.orderId, "shared");
      f.status = "actual";
      f.paymentDate = f.date;
      f.reconciliationNote = "Owner linked existing income";
      return f.id;
    }
    case "finance-exclude": {
      const v = z.object({ id: text, reason: text.min(5) }).parse(p);
      const f = s.finance.find((x) => x.id === v.id);
      if (!f || f.invoiceId || f.journeyId)
        throw Error("Only unlinked legacy entries can be excluded");
      f.excluded = true;
      f.reconciliationNote = v.reason;
      return f.id;
    }
    default:
      return undefined;
  }
}
