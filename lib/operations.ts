import { z } from "zod";
import {
  type State,
  type Order,
  needs,
  available,
  today,
  uid,
  money,
} from "./domain";

export const seasons = ["Spring", "Summer", "Autumn", "Winter"] as const;
export const categories = [
  "meat",
  "poultry",
  "fish & seafood",
  "vegetables",
  "fruit",
  "carbohydrates",
  "bakery",
  "dairy",
  "eggs",
  "herbs",
  "spices",
  "condiments",
  "oils & fats",
  "liquids",
  "plant proteins",
  "other",
] as const;
export const symbols: Record<string, string> = {
  meat: "🥩",
  poultry: "🍗",
  "fish & seafood": "🐟",
  vegetables: "🥬",
  fruit: "🍓",
  carbohydrates: "🌾",
  bakery: "🥖",
  dairy: "🥛",
  eggs: "🥚",
  herbs: "🌿",
  spices: "✦",
  condiments: "◌",
  "oils & fats": "◒",
  liquids: "💧",
  "plant proteins": "◇",
  other: "•",
};
const short = z.string().max(500);
const cents = z.number().int().nonnegative().max(1e12);
const quantity = z.number().finite().nonnegative().max(1e9);
export const safeURL = z.union([
  z.literal(""),
  z
    .string()
    .url()
    .max(2000)
    .refine((v) => v.startsWith("https://"), "Use an HTTPS URL"),
]);
export const dateValue = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
export const placeSchema = z.object({
  id: short,
  name: short,
  address: short,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  mapUrl: safeURL,
  postcode: short.optional(),
  locality: short.optional(),
});
export type Place = z.infer<typeof placeSchema>;
export type Research = {
  key: string;
  text: string;
  sources: { title: string; url: string }[];
  at: string;
  carParks?: Place[];
  parkingOptions?: {
    name: string;
    paymentSystem: string;
    tariff: string;
    hourlyRatePence: number | null;
    dailyCapPence: number | null;
    maximumStayMinutes: number | null;
  }[];
};
export const offeringSchema = z.object({
  id: short.optional(),
  ingredientId: short,
  supplierId: short,
  packQuantity: quantity.positive(),
  packCost: cents.nullable(),
  vatRate: z.number().min(0).max(100).nullable(),
  priceMode: z.enum(["exclusive", "inclusive"]),
  preferred: z.boolean(),
});
export type Offering = z.infer<typeof offeringSchema> & { id: string };
export type InvoiceLine = {
  description: string;
  quantity: number;
  amount: number;
  vatRate: number;
  priceMode: "exclusive" | "inclusive";
};
export type Invoice = {
  id: string;
  orderId: string;
  kind: "invoice" | "credit";
  originalId?: string;
  status: "draft" | "issued";
  number: string;
  lines: InvoiceLine[];
  customer: string;
  email: string;
  billingAddress: string;
  businessName: string;
  businessAddress: string;
  vatNumber: string;
  paymentInstructions: string;
  issueDate: string;
  supplyDate: string;
  dueDate: string;
  net: number;
  vat: number;
  total: number;
  paid: number;
  at: string;
};
export type PurchaseLine = {
  ingredientId: string;
  offeringId: string;
  required: number;
  quantity: number;
  packs: number;
  cost: number | null;
  vat: number | null;
  orderIds: string[];
  eventDate: string;
  eta: string;
  deadline: string;
};
export type Proposal = {
  supplierId: string;
  lines: PurchaseLine[];
  delivery: number;
  minimum: number;
  total: number | null;
  fingerprint: string;
};
export type Usage = {
  ingredientId: string;
  quantity: number;
  reason: string;
  at: string;
};
export type OperationsState = {
  schemaVersion: number;
  offerings: Offering[];
  invoices: Invoice[];
  sequences: Record<string, number>;
};
export function tax(
  amount: number,
  rate: number,
  mode: "exclusive" | "inclusive",
) {
  const net =
    mode === "inclusive" ? Math.round(amount / (1 + rate / 100)) : amount;
  const total =
    mode === "inclusive" ? amount : amount + Math.round((amount * rate) / 100);
  return { net, vat: total - net, total };
}
export function normaliseState(s: State): State {
  s.journeys ||= [];
  s.engagements ||= [];
  s.followUps ||= [];
  for (const c of s.customers) c.industry ||= "Unclassified";
  s.offerings ||= [];
  s.invoices ||= [];
  s.sequences ||= {};
  s.settings.priceMode ||= "exclusive";
  s.settings.warningDays ??= 7;
  s.settings.urgentDays ??= 3;
  s.settings.recipeEditorMode ||= "workspace";
  const legacyCategories: Record<string, (typeof categories)[number]> = {
    beef: "meat",
    chicken: "poultry",
    fish: "fish & seafood",
    rice: "carbohydrates",
    pasta: "carbohydrates",
    tofu: "plant proteins",
  };
  for (const ingredient of s.ingredients) {
    const category = ingredient.category as string | undefined;
    if (category && legacyCategories[category])
      ingredient.category = legacyCategories[category];
  }
  for (const r of s.recipes) {
    r.collections ||= [];
    r.imageUrl ||= "";
    r.createdAt ||= "1970-01-01";
    r.instructions ||= "";
    r.status ||= "active";
    for (const line of r.lines) {
      line.displayQuantity ??= line.quantity;
      line.displayUnit ||= s.ingredients.find(
        (ingredient) => ingredient.id === line.ingredientId,
      )?.unit;
      line.conversionConfirmed ??= true;
    }
  }
  for (const o of s.orders) {
    o.usage ||= [];
    o.acceptedAt ||= o.costSnapshot ? "1970-01-01T00:00:00Z" : undefined;
    o.createdAt ||=
      s.audit?.find((entry) => entry.action === "order" && entry.target === o.id)
        ?.at ||
      o.quotes[0]?.at ||
      o.acceptedAt ||
      (o.details.date ? `${o.details.date}T00:00:00.000Z` : undefined);
    o.statusHistory ||= [];
    if (!o.statusHistory.length && o.createdAt)
      o.statusHistory.push({ status: o.status, at: o.createdAt });
  }
  if (!s.schemaVersion || s.schemaVersion < 2) {
    for (const i of s.ingredients)
      if (i.supplierId && !s.offerings.some((v) => v.ingredientId === i.id))
        s.offerings.push({
          id: `legacy-${i.id}`,
          ingredientId: i.id,
          supplierId: i.supplierId,
          packQuantity: i.packQuantity,
          packCost: i.packCost,
          priceMode: "exclusive",
          vatRate: null,
          preferred: true,
        });
    s.schemaVersion = 2;
  }
  s.schemaVersion = 5;
  return s;
}
export function nextReference(s: State, prefix: string) {
  const year = today().slice(0, 4),
    key = `${prefix}-${year}`;
  let value: string;
  do {
    s.sequences[key] = (s.sequences[key] || 0) + 1;
    value = `${key}-${String(s.sequences[key]).padStart(6, "0")}`;
  } while (
    s.orders.some((o) => o.reference === value) ||
    s.invoices.some((i) => i.number === value)
  );
  return value;
}
export function expiryStatus(
  expiry: string,
  type: string,
  day = today(),
  warning = 7,
  urgent = 3,
) {
  if (!expiry) return { label: "Date required", tone: "amber" };
  const days = Math.round((Date.parse(expiry) - Date.parse(day)) / 86400000);
  if (days < 0)
    return {
      label: `${type === "use-by" ? "Use-by" : "Best-before"} passed · ${-days} days ago`,
      tone: type === "use-by" ? "red" : "amber",
    };
  let duration = `${days} day${days === 1 ? "" : "s"}`;
  if (days >= 31) {
    const start = new Date(day),
      end = new Date(expiry);
    let months =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      end.getUTCMonth() -
      start.getUTCMonth();
    const anchor = new Date(start);
    anchor.setUTCDate(1);
    anchor.setUTCMonth(anchor.getUTCMonth() + months);
    anchor.setUTCDate(
      Math.min(
        start.getUTCDate(),
        new Date(
          Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    );
    if (anchor > end) {
      months--;
      anchor.setUTCDate(1);
      anchor.setUTCMonth(anchor.getUTCMonth() - 1);
      anchor.setUTCDate(
        Math.min(
          start.getUTCDate(),
          new Date(
            Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
          ).getUTCDate(),
        ),
      );
    }
    duration = `${months} month${months === 1 ? "" : "s"}, ${Math.round((+end - +anchor) / 86400000)} days`;
  }
  return {
    label: days === 0 ? "Due today" : `${duration} remaining`,
    tone:
      type === "use-by" && days <= urgent
        ? "red"
        : days <= warning
          ? "amber"
          : "green",
  };
}
export const active = (o: Order) =>
  !!o.costSnapshot &&
  !o.consumed &&
  !["cancelled", "declined", "delivered"].includes(o.status);
export function reconcileStock(s: State) {
  const orders = s.orders
    .filter(active)
    .sort(
      (a, b) =>
        a.details.date.localeCompare(b.details.date) ||
        (a.acceptedAt || "").localeCompare(b.acceptedAt || "") ||
        a.id.localeCompare(b.id),
    );
  // Preserve eligible reservations, trimming only where quantities or dates changed.
  const remaining = new Map(s.batches.map((b) => [b.id, b.quantity]));
  for (const o of orders) {
    const demand = needs(s, o),
      kept: Order["reservations"] = [];
    for (const r of o.reservations) {
      const b = s.batches.find((b) => b.id === r.batchId);
      if (
        !b ||
        !b.expiry ||
        b.expiry < today() ||
        b.expiry < (o.details.date || today())
      )
        continue;
      const take = Math.min(
        r.quantity,
        demand[b.ingredientId] || 0,
        remaining.get(b.id) || 0,
      );
      if (take > 0) {
        kept.push({ batchId: b.id, quantity: take });
        demand[b.ingredientId] -= take;
        remaining.set(b.id, (remaining.get(b.id) || 0) - take);
      }
    }
    o.reservations = kept;
  }
  for (const o of orders) {
    for (const [id, qty] of Object.entries(needs(s, o))) {
      let deficit = qty - reservedFor(s, o, id);
      for (const b of s.batches
        .filter(
          (b) =>
            b.ingredientId === id &&
            b.expiry &&
            b.expiry >= today() &&
            b.expiry >= (o.details.date || today()),
        )
        .sort(
          (a, b) =>
            a.expiry.localeCompare(b.expiry) || a.id.localeCompare(b.id),
        )) {
        const take = Math.min(deficit, remaining.get(b.id) || 0);
        if (take > 0) {
          const r = o.reservations.find((r) => r.batchId === b.id);
          if (r) r.quantity += take;
          else o.reservations.push({ batchId: b.id, quantity: take });
          remaining.set(b.id, (remaining.get(b.id) || 0) - take);
          deficit -= take;
        }
      }
    }
  }
}
export function reservedFor(s: State, o: Order, id: string) {
  return o.reservations
    .filter(
      (r) => s.batches.find((b) => b.id === r.batchId)?.ingredientId === id,
    )
    .reduce((n, r) => n + r.quantity, 0);
}
export function shortage(s: State, o: Order) {
  return Object.entries(needs(s, o)).map(([ingredientId, quantity]) => {
    const eligible = s.batches
      .filter(
        (b) =>
          b.ingredientId === ingredientId &&
          b.expiry &&
          b.expiry >= today() &&
          b.expiry >= (o.details.date || today()),
      )
      .reduce((n, b) => n + Math.max(0, available(s, b.id, o.id)), 0);
    return {
      ingredientId,
      quantity,
      available: eligible,
      shortage: o.consumed ? 0 : Math.max(0, quantity - eligible),
    };
  });
}
export function consumeOrder(
  s: State,
  o: Order,
  at: string,
  reason = "Packaged",
) {
  if (o.consumed) return;
  reconcileStock(s);
  if (
    Object.entries(needs(s, o)).some(
      ([id, q]) => q - reservedFor(s, o, id) > 1e-6,
    )
  )
    throw Error(
      "Insufficient eligible stock for actual usage. Receive or reconcile ingredients first.",
    );
  for (const r of o.reservations) {
    const b = s.batches.find((b) => b.id === r.batchId)!;
    b.quantity -= r.quantity;
    s.movements.push({
      id: uid(),
      batchId: b.id,
      quantity: -r.quantity,
      reason,
      cost: Math.round(r.quantity * b.unitCost),
      orderId: o.id,
      at,
    });
  }
  o.reservations = [];
  o.consumed = true;
}
const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
export function proposals(s: State): Proposal[] {
  const incoming = new Map(
    s.purchases
      .filter((p) => p.status === "ordered" && p.eta >= today())
      .map((p) => [p.id, p.quantity - (p.receivedQuantity || 0)]),
  );
  const grouped = new Map<string, PurchaseLine[]>();
  for (const o of s.orders
    .filter(active)
    .sort(
      (a, b) =>
        a.details.date.localeCompare(b.details.date) ||
        (a.acceptedAt || "").localeCompare(b.acceptedAt || ""),
    )) {
    for (const [ingredientId, qty] of Object.entries(needs(s, o))) {
      let required = Math.max(0, qty - reservedFor(s, o, ingredientId));
      for (const p of s.purchases
        .filter(
          (p) => p.ingredientId === ingredientId && p.eta <= o.details.date,
        )
        .sort((a, b) => a.eta.localeCompare(b.eta))) {
        const take = Math.min(required, incoming.get(p.id) || 0);
        required -= take;
        incoming.set(p.id, (incoming.get(p.id) || 0) - take);
      }
      if (required < 1e-6) continue;
      const offering = s.offerings.find(
        (x) => x.ingredientId === ingredientId && x.preferred,
      );
      const supplier = s.suppliers.find((x) => x.id === offering?.supplierId);
      const supplierId = supplier?.id || "unassigned",
        lines = grouped.get(supplierId) || [];
      let line = lines.find((l) => l.ingredientId === ingredientId);
      if (!line) {
        line = {
          ingredientId,
          offeringId: offering?.id || "",
          required: 0,
          quantity: 0,
          packs: 0,
          cost: null,
          vat: null,
          orderIds: [],
          eventDate: o.details.date,
          eta: shiftDate(today(), supplier?.leadDays || 0),
          deadline: shiftDate(
            o.details.date || today(),
            -(supplier?.leadDays || 0),
          ),
        };
        lines.push(line);
      }
      line.required += required;
      line.orderIds.push(o.id);
      line.packs = Math.ceil(
        (line.required - 1e-9) / (offering?.packQuantity || 1),
      );
      line.quantity = line.packs * (offering?.packQuantity || 1);
      if (offering?.packCost != null) {
        const amount = line.packs * offering.packCost;
        const t = tax(amount, offering.vatRate || 0, offering.priceMode);
        line.cost = t.net;
        line.vat = offering.vatRate == null ? null : t.vat;
      }
      grouped.set(supplierId, lines);
    }
  }
  return [...grouped].map(([supplierId, lines]) => {
    const sup = s.suppliers.find((x) => x.id === supplierId);
    const proposal = {
      supplierId,
      lines,
      delivery: sup?.deliveryCharge || 0,
      minimum: sup?.minimumOrder || 0,
      total: lines.some((l) => l.cost === null || l.vat === null)
        ? null
        : lines.reduce(
            (n, l) => n + l.cost! + l.vat!,
            sup?.deliveryCharge || 0,
          ),
    };
    return {
      ...proposal,
      fingerprint: JSON.stringify({
        ...proposal,
        to: sup?.email,
        offerings: lines.map((l) =>
          s.offerings.find((x) => x.id === l.offeringId),
        ),
      }),
    };
  });
}
export function draftCurrent(s: State, d: State["drafts"][number]) {
  return (
    !d.proposal ||
    proposals(s).find((p) => p.supplierId === d.supplierId)?.fingerprint ===
      d.proposal.fingerprint
  );
}
export function invoiceDraft(s: State, o: Order, at: string) {
  if (s.invoices.some((i) => i.orderId === o.id && i.kind === "invoice"))
    return;
  const q = o.quotes.at(-1)!;
  s.invoices.push({
    id: uid(),
    orderId: o.id,
    kind: "invoice",
    status: "draft",
    number: "",
    lines: [
      {
        description: `${o.details.eventType}: ${o.costSnapshot?.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}`,
        quantity: 1,
        amount: q.priceMode === "inclusive" ? q.total : q.net,
        vatRate: q.vatRate,
        priceMode: q.priceMode || "exclusive",
      },
    ],
    customer: o.details.company || o.details.name,
    email: o.details.email,
    billingAddress: "",
    businessName: s.settings.businessName || "EM² Meals",
    businessAddress: s.settings.businessAddress || "",
    vatNumber: s.settings.vatNumber || "",
    paymentInstructions: s.settings.paymentInstructions || "",
    issueDate: today(),
    supplyDate: o.details.date,
    dueDate: shiftDate(today(), 14),
    net: q.net,
    vat: q.total - q.net,
    total: q.total,
    paid: 0,
    at,
  });
}
const invoiceLine = z.object({
  description: z.string().min(1).max(16000),
  quantity: quantity.positive(),
  amount: cents,
  vatRate: z.number().min(0).max(100),
  priceMode: z.enum(["exclusive", "inclusive"]),
});
export function applyOperations(
  s: State,
  type: string,
  payload: unknown,
  at: string,
): string | undefined {
  const p = z.record(z.unknown()).parse(payload);
  switch (type) {
    case "venue-select": {
      const v = z.object({ orderId: short, place: placeSchema }).parse(p);
      const o = s.orders.find((o) => o.id === v.orderId);
      if (!o || ["delivered", "cancelled", "declined"].includes(o.status))
        throw Error("Select an open order");
      o.details.place = v.place;
      o.details.venue = v.place.name;
      o.details.address = v.place.address;
      o.details.postcode = v.place.postcode || "";
      o.details.locality = v.place.locality || "";
      return o.id;
    }
    case "offering": {
      const v = offeringSchema.parse(p);
      if (
        !s.ingredients.some((i) => i.id === v.ingredientId) ||
        !s.suppliers.some((i) => i.id === v.supplierId)
      )
        throw Error("Select an ingredient and supplier");
      const id = v.id || uid();
      if (v.preferred)
        s.offerings
          .filter((x) => x.ingredientId === v.ingredientId)
          .forEach((x) => (x.preferred = false));
      s.offerings = s.offerings.filter((x) => x.id !== id).concat({ ...v, id });
      if (v.preferred) {
        const ingredient = s.ingredients.find((i) => i.id === v.ingredientId)!;
        ingredient.supplierId = v.supplierId;
        if (v.packCost !== null) {
          ingredient.packQuantity = v.packQuantity;
          ingredient.packCost = tax(
            v.packCost,
            v.vatRate || 0,
            v.priceMode,
          ).net;
        }
      }
      return id;
    }
    case "usage": {
      const v = z
        .object({
          orderId: short,
          ingredientId: short,
          quantity,
          reason: short.min(3),
        })
        .parse(p);
      const o = s.orders.find((o) => o.id === v.orderId);
      if (!o || !active(o)) throw Error("Select an accepted, unpackaged order");
      if (!s.ingredients.some((i) => i.id === v.ingredientId))
        throw Error("Ingredient not found");
      o.usage = [
        ...(o.usage || []).filter((x) => x.ingredientId !== v.ingredientId),
        { ...v, at },
      ];
      return o.id;
    }
    case "cancel-reconcile": {
      const v = z
        .object({
          orderId: short,
          reason: short.min(3),
          used: z.array(z.object({ ingredientId: short, quantity })).max(100),
        })
        .parse(p);
      const o = s.orders.find((o) => o.id === v.orderId);
      if (!o || !["prepared", "cooked"].includes(o.status) || o.consumed)
        throw Error("Select an unconsumed prepared or cooked order");
      const original = needs(s, o);
      if (
        new Set(v.used.map((x) => x.ingredientId)).size !== v.used.length ||
        Object.keys(original).some(
          (id) => !v.used.some((x) => x.ingredientId === id),
        ) ||
        v.used.some((x) => !(x.ingredientId in original))
      )
        throw Error("Reconcile every ingredient exactly once");
      o.usage = v.used.map((x) => ({ ...x, reason: v.reason, at }));
      consumeOrder(s, o, at, "Cancelled order usage: " + v.reason);
      o.status = "cancelled";
      return o.id;
    }
    case "procurement-draft": {
      const v = z
        .object({
          supplierId: short,
          to: z.string().email(),
          subject: short.min(1),
          body: z.string().min(1).max(8000),
          fingerprint: z.string().max(50000),
        })
        .parse(p);
      const proposal = proposals(s).find((x) => x.supplierId === v.supplierId);
      if (!proposal || proposal.fingerprint !== v.fingerprint)
        throw Error("Demand changed. Refresh the proposal before saving.");
      if (
        s.drafts.some(
          (d) =>
            d.supplierId === v.supplierId &&
            d.proposal &&
            !d.superseded &&
            !d.purchaseConfirmed,
        )
      )
        throw Error(
          "Resolve the existing request before preparing another draft",
        );
      const id = uid();
      s.drafts.push({
        id,
        to: v.to,
        subject: v.subject,
        body: v.body,
        supplierId: v.supplierId,
        at,
        proposal,
      });
      return id;
    }
    case "draft-replace": {
      const v = z
        .object({
          draftId: short,
          to: z.string().email(),
          subject: short.min(1),
          body: z.string().min(1).max(8000),
          fingerprint: z.string().max(50000),
        })
        .parse(p);
      const d = s.drafts.find((d) => d.id === v.draftId);
      if (d?.deliveryStatus === "sending" || d?.deliveryStatus === "uncertain")
        throw Error(
          "Verify the pending email delivery before replacing this request",
        );
      if (!d?.proposal || d.sentAt || d.superseded)
        throw Error("Only an unsent request can be replaced");
      const proposal = proposals(s).find((x) => x.supplierId === d.supplierId);
      if (!proposal || proposal.fingerprint !== v.fingerprint)
        throw Error("Demand changed. Refresh the proposal.");
      d.superseded = true;
      const id = uid();
      s.drafts.push({
        ...d,
        id,
        to: v.to,
        subject: v.subject,
        body: v.body,
        at,
        proposal,
        superseded: false,
        deliveryStatus: undefined,
        sentAt: undefined,
      });
      return id;
    }
    case "draft-close": {
      const d = s.drafts.find((d) => d.id === p.draftId);
      if (d?.deliveryStatus === "sending" || d?.deliveryStatus === "uncertain")
        throw Error(
          "Verify the pending email delivery before closing this request",
        );
      if (!d?.proposal || d.purchaseConfirmed) throw Error("Request not found");
      d.superseded = true;
      return d.id;
    }
    case "purchase-confirm": {
      const v = z
        .object({
          draftId: short,
          eta: dateValue,
          lines: z
            .array(
              z.object({
                ingredientId: short,
                quantity: quantity.positive(),
                cost: cents,
              }),
            )
            .min(1)
            .max(100),
        })
        .parse(p);
      const d = s.drafts.find((d) => d.id === v.draftId);
      if (!d?.proposal || d.purchaseConfirmed || d.superseded)
        throw Error("Request missing or already resolved");
      if (!d.sentAt)
        throw Error("Send the request first, or record a manual purchase");
      if (
        new Set(v.lines.map((l) => l.ingredientId)).size !== v.lines.length ||
        v.lines.some(
          (l) =>
            !d.proposal!.lines.some((x) => x.ingredientId === l.ingredientId),
        )
      )
        throw Error("Select request ingredients once each");
      for (const l of v.lines)
        s.purchases.push({
          id: uid(),
          supplierId: d.supplierId!,
          ...l,
          eta: v.eta,
          status: "ordered",
          notes: `Confirmed request ${d.id}`,
          at,
          requestId: d.id,
          orderIds:
            d.proposal.lines.find(
              (line) => line.ingredientId === l.ingredientId,
            )?.orderIds || [],
          receivedQuantity: 0,
        });
      d.purchaseConfirmed = true;
      return d.id;
    }
    case "invoice-edit": {
      const v = z
        .object({
          invoiceId: short,
          lines: z.array(invoiceLine).min(1).max(100),
          customer: short.min(1),
          email: z.string().email(),
          billingAddress: short,
          businessName: short.min(1),
          businessAddress: short,
          vatNumber: short,
          paymentInstructions: z.string().max(2000),
          issueDate: dateValue,
          supplyDate: dateValue,
          dueDate: dateValue,
        })
        .parse(p);
      const i = s.invoices.find((i) => i.id === v.invoiceId);
      if (!i || i.status !== "draft")
        throw Error("Only draft invoices can be edited");
      if (v.dueDate < v.issueDate) throw Error("Due date is before issue date");
      Object.assign(i, v);
      const totals = v.lines.map((l) =>
        tax(Math.round(l.amount * l.quantity), l.vatRate, l.priceMode),
      );
      i.net = totals.reduce((n, t) => n + t.net, 0);
      i.vat = totals.reduce((n, t) => n + t.vat, 0);
      i.total = i.net + i.vat;
      return i.id;
    }
    case "invoice-issue": {
      const i = s.invoices.find((i) => i.id === p.invoiceId);
      if (!i) throw Error("Invoice not found");
      if (i.status === "issued") return i.id;
      if (
        !i.businessAddress ||
        !i.billingAddress ||
        !i.supplyDate ||
        !i.businessName ||
        (i.vat > 0 && !i.vatNumber)
      )
        throw Error(
          "Complete business address, billing address, supply date and VAT registration details before issuing",
        );
      if (i.kind === "credit") {
        const original = s.invoices.find((x) => x.id === i.originalId)!;
        const credited = s.invoices
          .filter((x) => x.originalId === original.id && x.status === "issued")
          .reduce((n, x) => n + x.total, 0);
        if (i.total + credited > original.total)
          throw Error("Credit exceeds the original invoice");
      }
      i.number = nextReference(s, i.kind === "credit" ? "CN" : "INV");
      i.status = "issued";
      return i.id;
    }
    case "invoice-credit": {
      const original = s.invoices.find((i) => i.id === p.invoiceId);
      if (
        !original ||
        original.status !== "issued" ||
        original.kind !== "invoice"
      )
        throw Error("Select an issued invoice");
      if (s.invoices.some((i) => i.originalId === original.id))
        throw Error("A credit note already exists for this invoice");
      const id = uid();
      s.invoices.push({
        ...structuredClone(original),
        id,
        kind: "credit",
        originalId: original.id,
        status: "draft",
        number: "",
        paid: 0,
        at,
        issueDate: today(),
      });
      return id;
    }
    case "invoice-payment": {
      const v = z
        .object({
          invoiceId: short,
          amount: cents.positive(),
          reference: short.min(1),
          date: dateValue,
        })
        .parse(p);
      const i = s.invoices.find((i) => i.id === v.invoiceId);
      if (!i || i.kind !== "invoice" || i.status !== "issued")
        throw Error("Select an issued invoice");
      if (
        s.finance.some(
          (f) => f.paymentReference === v.reference && f.invoiceId === i.id,
        )
      )
        throw Error("This payment reference is already recorded");
      const credits = s.invoices
        .filter((x) => x.originalId === i.id && x.status === "issued")
        .reduce((n, x) => n + x.total, 0);
      if (i.paid + v.amount > i.total - credits)
        throw Error("Payment exceeds the remaining balance");
      i.paid += v.amount;
      s.finance.push({
        id: uid(),
        type: "income",
        amount: v.amount,
        category: "Invoice payment",
        description: i.number,
        date: v.date,
        orderId: i.orderId,
        invoiceId: i.id,
        paymentReference: v.reference,
      });
      return i.id;
    }
    case "invoice-email": {
      const i = s.invoices.find((i) => i.id === p.invoiceId);
      if (!i || i.status !== "issued") throw Error("Issue the invoice first");
      const id = uid();
      const body = invoiceText(s, i);
      s.drafts.push({
        id,
        to: i.email,
        subject: `EM² Meals ${i.kind === "credit" ? "credit note" : "invoice"} ${i.number}`,
        body,
        customerId: s.orders.find((o) => o.id === i.orderId)?.customerId,
        at,
      });
      return id;
    }
    default:
      return undefined;
  }
}
export function invoiceText(s: State, i: Invoice) {
  return `${i.kind === "credit" ? "CREDIT NOTE" : "INVOICE"} ${i.number}\nOrder: ${s.orders.find((o) => o.id === i.orderId)?.reference}\n${i.originalId ? `Original invoice: ${s.invoices.find((x) => x.id === i.originalId)?.number}\n` : ""}${i.businessName}\n${i.businessAddress}\nVAT registration: ${i.vatNumber || "Not registered"}\n\nBill to: ${i.customer}\n${i.billingAddress}\nIssued: ${i.issueDate} · Supply: ${i.supplyDate} · Due: ${i.dueDate}\n\n${i.lines
    .map((l) => {
      const t = tax(Math.round(l.quantity * l.amount), l.vatRate, l.priceMode);
      return `${l.description} × ${l.quantity} · net ${money(t.net)} · VAT ${l.vatRate}% ${money(t.vat)} · ${money(t.total)}`;
    })
    .join(
      "\n",
    )}\n\nNet: ${money(i.net)}\nVAT: ${money(i.vat)}\nTotal: ${money(i.total)}\n\n${i.paymentInstructions}`;
}
