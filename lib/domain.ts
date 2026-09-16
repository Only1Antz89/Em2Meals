import {
  type FinanceExtra,
  type Journey,
  reportingCommand,
  industries,
} from "./reporting";
import { z } from "zod";
import {
  type OperationsState,
  type Place,
  type Research,
  type Usage,
  type Proposal,
  normaliseState,
  nextReference,
  reconcileStock,
  consumeOrder,
  invoiceDraft,
  applyOperations,
  tax,
  categories,
  seasons,
  safeURL,
  placeSchema,
} from "./operations";
export const uid = () => crypto.randomUUID();
export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    n / 100,
  );
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
    new Date(),
  );
export const stages = [
  "enquiry",
  "quote",
  "confirmed",
  "ingredients needed",
  "ingredients ready",
  "prepared",
  "cooked",
  "packaged",
  "ready for delivery",
  "delivered",
] as const;
export type Ingredient = {
  category?: (typeof categories)[number];
  id: string;
  name: string;
  unit: "g" | "ml" | "each";
  packQuantity: number;
  packCost: number;
  yield: number;
  allergens: string;
  supplierId: string;
  threshold: number;
  onlineEstimate?: {
    packQuantity: number;
    packCost: number;
    sourceTitle: string;
    sourceUrl: string;
    researchedAt: string;
    acceptedAt: string;
  };
};
export const recipeUnits = [
  "g",
  "kg",
  "ml",
  "L",
  "each",
  "tsp",
  "tbsp",
  "cup",
  "bunch",
  "clove",
  "pinch",
] as const;
export type RecipeUnit = (typeof recipeUnits)[number];
export type RecipeLine = {
  ingredientId: string;
  quantity: number;
  displayQuantity?: number;
  displayUnit?: RecipeUnit;
  conversionConfirmed?: boolean;
};
export type Recipe = {
  collections?: { year: number; season: (typeof seasons)[number] }[];
  imageUrl?: string;
  id: string;
  name: string;
  variant: string;
  createdAt?: string;
  instructions?: string;
  status?: "draft" | "active";
  lines: RecipeLine[];
};
export type Attendee = {
  reference: string;
  requirements: string;
  meal: string;
  reviewed: boolean;
};
export type Enquiry = {
  locality?: string;
  place?: Place;
  service: string;
  eventType: string;
  attendees: number;
  date: string;
  eventTime: string;
  arrivalTime: string;
  requests: string;
  dietary: string;
  requirements: Attendee[];
  name: string;
  company: string;
  email: string;
  phone: string;
  venue: string;
  address: string;
  postcode: string;
  access: string;
  unknownDetails: string;
};
export type Quote = {
  vat?: number;
  priceMode?: "exclusive" | "inclusive";
  version: number;
  net: number;
  vatRate: number;
  total: number;
  notes: string;
  at: string;
};
export type Order = {
  createdAt?: string;
  statusHistory?: { status: string; at: string }[];
  acceptedAt?: string;
  usage?: Usage[];
  venueResearch?: Research;
  id: string;
  reference: string;
  customerId: string;
  enquiryId?: string;
  details: Enquiry;
  status: string;
  items: { recipeId: string; quantity: number }[];
  quotes: Quote[];
  allergyReviewed: boolean;
  costSnapshot?: {
    total: number;
    items: {
      recipeId: string;
      name: string;
      quantity: number;
      unitCost: number;
      lines: {
        ingredientId: string;
        name: string;
        quantity: number;
        cost: number;
      }[];
    }[];
  };
  consumed: boolean;
  reservations: { batchId: string; quantity: number }[];
  route?: {
    miles: number;
    minutes: number;
    outboundMiles?: number;
    outboundMinutes?: number;
    returnMiles?: number;
    returnMinutes?: number;
    fuelCost: number | null;
    source: string;
    at: string;
    departure: string;
    returnDeparture?: string;
    venueDurationMinutes?: number;
    returnTrip: boolean;
    extraCost: number;
    parkingCost?: number;
    otherCost?: number;
    mapUrl?: string;
  };
  analysis?: unknown;
};
export type State = OperationsState & {
  journeys: Journey[];
  settings: {
    priceMode?: "exclusive" | "inclusive";
    warningDays?: number;
    urgentDays?: number;
    businessName?: string;
    businessAddress?: string;
    vatNumber?: string;
    paymentInstructions?: string;
    kitchen: string;
    vatRate: number;
    vehicle: string;
    mpg: number;
    fuelPrice: number;
    bufferMinutes: number;
    ownerNotes: string;
    recipeEditorMode?: "workspace" | "wizard";
  };
  ingredients: Ingredient[];
  recipes: Recipe[];
  customers: {
    industry?: string;
    id: string;
    name: string;
    company: string;
    email: string;
    phone: string;
    notes: string;
  }[];
  orders: Order[];
  batches: {
    id: string;
    ingredientId: string;
    quantity: number;
    location: string;
    intake: string;
    expiry: string;
    dateType: string;
    opened: string;
    frozen: string;
    thawed: string;
    notes: string;
    unitCost: number;
  }[];
  movements: {
    cost?: number;
    id: string;
    batchId: string;
    quantity: number;
    reason: string;
    orderId?: string;
    at: string;
  }[];
  suppliers: {
    contactName?: string;
    contactRole?: string;
    website?: string;
    address?: string;
    logoUrl?: string;
    businessDetails?: string;
    research?: Research;
    id: string;
    name: string;
    email: string;
    phone: string;
    deliveryCharge: number;
    minimumOrder: number;
    leadDays: number;
    notes: string;
    comms: { at: string; message: string }[];
  }[];
  purchases: {
    orderIds?: string[];
    at?: string;
    receivedQuantity?: number;
    requestId?: string;
    id: string;
    supplierId: string;
    ingredientId: string;
    quantity: number;
    cost: number;
    eta: string;
    status: string;
    notes: string;
  }[];
  waste: {
    movementId?: string;
    id: string;
    orderId: string;
    ingredientId: string;
    recipeId: string;
    batchId: string;
    category: string;
    quantity: number;
    unit: string;
    weightGrams: number;
    weightMeasured?: boolean;
    cost: number;
    reason: string;
    date: string;
  }[];
  feedback: {
    id: string;
    customerId: string;
    orderId: string;
    rating: number;
    comment: string;
    date: string;
  }[];
  engagements: {
    id: string;
    customerId: string;
    orderId?: string;
    type: "call" | "email" | "meeting" | "note";
    direction: "inbound" | "outbound" | "internal";
    summary: string;
    occurredAt: string;
    createdAt: string;
    actor: string;
  }[];
  followUps: {
    id: string;
    customerId: string;
    orderId?: string;
    dueDate: string;
    note: string;
    status: "open" | "completed" | "cancelled";
    completedAt?: string;
    createdAt: string;
    actor: string;
  }[];
  finance: (FinanceExtra & {
    invoiceId?: string;
    paymentReference?: string;
    id: string;
    type: string;
    amount: number;
    category: string;
    description: string;
    date: string;
    orderId: string;
  })[];
  drafts: {
    proposal?: Proposal;
    sentAt?: string;
    deliveryStatus?: "sending" | "uncertain" | "failed" | "sent";
    superseded?: boolean;
    purchaseConfirmed?: boolean;
    id: string;
    to: string;
    subject: string;
    body: string;
    customerId?: string;
    supplierId?: string;
    at: string;
  }[];
  audit: { at: string; actor: string; action: string; target: string }[];
  commands: string[];
};
export function emptyState(): State {
  return {
    schemaVersion: 5,
    journeys: [],
    offerings: [],
    invoices: [],
    sequences: {},
    settings: {
      kitchen: "",
      vatRate: 0,
      vehicle: "2018 Hyundai Tucson petrol",
      mpg: 0,
      fuelPrice: 0,
      bufferMinutes: 30,
      ownerNotes: "",
      recipeEditorMode: "workspace",
    },
    ingredients: [],
    recipes: [],
    customers: [],
    orders: [],
    batches: [],
    movements: [],
    suppliers: [],
    purchases: [],
    waste: [],
    feedback: [],
    engagements: [],
    followUps: [],
    finance: [],
    drafts: [],
    audit: [],
    commands: [],
  };
}
const short = z.string().max(500);
const long = z.string().max(8000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const maybeDate = z.union([date, z.literal("")]);
const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
const cents = nonnegative.int();
const count = positive.int().max(100000);
const legacyIngredientCategories = [
  "beef",
  "chicken",
  "rice",
  "pasta",
  "fish",
  "tofu",
] as const;
const ingredientCategory = z
  .union([z.enum(categories), z.enum(legacyIngredientCategories)])
  .transform((value): (typeof categories)[number] => {
    const mapping: Record<string, (typeof categories)[number]> = {
      beef: "meat",
      chicken: "poultry",
      rice: "carbohydrates",
      pasta: "carbohydrates",
      fish: "fish & seafood",
      tofu: "plant proteins",
    };
    return mapping[value] || (value as (typeof categories)[number]);
  });
const time = z.union([
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  z.literal(""),
]);
export const enquirySchema = z
  .object({
    place: placeSchema.optional(),
    locality: short.optional(),
    service: z.enum(["private", "corporate"]),
    eventType: short.min(1),
    attendees: count,
    date: maybeDate,
    eventTime: time,
    arrivalTime: time,
    requests: long,
    dietary: long,
    requirements: z
      .array(
        z.object({
          reference: short.min(1),
          requirements: short,
          meal: short.default(""),
          reviewed: z.boolean().default(false),
        }),
      )
      .max(500),
    name: short.min(1),
    company: short,
    email: z.string().email().max(254),
    phone: short.min(5),
    venue: short,
    address: short,
    postcode: short,
    access: long,
    unknownDetails: long,
  })
  .refine(
    (v) => !v.date || v.date >= today(),
    "Event date must not be in the past",
  );
export function recipeCost(s: State, r: Recipe) {
  return r.lines.reduce((sum, l) => {
    const i = s.ingredients.find((x) => x.id === l.ingredientId);
    if (!i) throw Error("Ingredient is missing");
    return sum + ((l.quantity / i.yield) * i.packCost) / i.packQuantity;
  }, 0);
}
export function recipeCurrentCost(s: State, r: Recipe) {
  return r.lines.reduce((sum, line) => {
    const ingredient = s.ingredients.find((item) => item.id === line.ingredientId);
    if (!ingredient) throw Error("Ingredient is missing");
    const price = ingredientPrice(s, ingredient.id);
    return price.unitCost == null
      ? sum
      : sum + (line.quantity / ingredient.yield) * price.unitCost;
  }, 0);
}
export function normaliseRecipeMeasurement(
  quantity: number,
  unit: RecipeUnit,
  baseUnit: Ingredient["unit"],
  culinaryConversion?: number,
) {
  const fixed: Partial<Record<RecipeUnit, { unit: Ingredient["unit"]; factor: number }>> = {
    g: { unit: "g", factor: 1 },
    kg: { unit: "g", factor: 1000 },
    ml: { unit: "ml", factor: 1 },
    L: { unit: "ml", factor: 1000 },
    each: { unit: "each", factor: 1 },
    tsp: { unit: "ml", factor: 5 },
    tbsp: { unit: "ml", factor: 15 },
    cup: { unit: "ml", factor: 250 },
  };
  const conversion = fixed[unit];
  if (conversion) {
    if (conversion.unit !== baseUnit) return null;
    return quantity * conversion.factor;
  }
  if (!culinaryConversion || culinaryConversion <= 0) return null;
  return quantity * culinaryConversion;
}
export function ingredientPrice(s: State, ingredientId: string) {
  const ingredient = s.ingredients.find((item) => item.id === ingredientId);
  if (!ingredient)
    return { unitCost: null, label: "Unknown", source: "unknown" as const };
  const purchase = s.purchases
    .filter(
      (item) =>
        item.ingredientId === ingredientId &&
        item.status === "received" &&
        item.quantity > 0 &&
        item.cost > 0,
    )
    .toSorted((a, b) => (b.at || "").localeCompare(a.at || ""))[0];
  if (purchase)
    return {
      unitCost: purchase.cost / purchase.quantity,
      label: "Last purchase",
      source: "purchase" as const,
    };
  const offering = s.offerings.find(
    (item) =>
      item.ingredientId === ingredientId &&
      item.preferred &&
      item.packCost != null &&
      item.packCost > 0 &&
      item.packQuantity > 0,
  );
  if (offering)
    return {
      unitCost: offering.packCost! / offering.packQuantity,
      label: "Preferred supplier",
      source: "supplier" as const,
    };
  if (ingredient.onlineEstimate)
    return {
      unitCost:
        ingredient.onlineEstimate.packCost /
        ingredient.onlineEstimate.packQuantity,
      label: "Accepted online estimate",
      source: "online" as const,
    };
  if (ingredient.packQuantity > 0 && ingredient.packCost > 0)
    return {
      unitCost: ingredient.packCost / ingredient.packQuantity,
      label: "Recorded price",
      source: "catalogue" as const,
    };
  return { unitCost: null, label: "Price needed", source: "unknown" as const };
}
export function ingredientAvailable(s: State, ingredientId: string) {
  return s.batches
    .filter(
      (batch) =>
        batch.ingredientId === ingredientId &&
        (!batch.expiry || batch.expiry >= today()),
    )
    .reduce((sum, batch) => sum + Math.max(0, available(s, batch.id)), 0);
}
export function fuelCost(miles: number, mpg: number, pricePounds: number) {
  if (mpg <= 0 || pricePounds <= 0) return null;
  return Math.round((miles / mpg) * 4.54609 * pricePounds * 100);
}
export function needs(s: State, o: Order) {
  const n: Record<string, number> = {};
  if (o.costSnapshot) {
    for (const item of o.costSnapshot.items)
      for (const l of item.lines)
        n[l.ingredientId] =
          (n[l.ingredientId] || 0) + l.quantity * item.quantity;
    for (const u of o.usage || []) n[u.ingredientId] = u.quantity;
    return n;
  }
  for (const line of o.items) {
    const r = s.recipes.find((x) => x.id === line.recipeId);
    if (!r) throw Error("Recipe is missing");
    for (const l of r.lines) {
      const i = s.ingredients.find((x) => x.id === l.ingredientId)!;
      n[i.id] = (n[i.id] || 0) + (l.quantity * line.quantity) / i.yield;
    }
  }
  return n;
}
export function available(s: State, batchId: string, except?: string) {
  const b = s.batches.find((x) => x.id === batchId)!;
  return (
    b.quantity -
    s.orders
      .filter((o) => o.id !== except)
      .flatMap((o) => o.reservations)
      .filter((r) => r.batchId === batchId)
      .reduce((v, r) => v + r.quantity, 0)
  );
}
export function reserve(s: State, o: Order) {
  o.reservations = [];
  const deficits: { ingredientId: string; quantity: number }[] = [];
  for (const [ingredientId, qty] of Object.entries(needs(s, o))) {
    let remaining = qty;
    for (const b of s.batches
      .filter(
        (b) =>
          b.ingredientId === ingredientId &&
          b.expiry &&
          b.expiry >= (o.details.date || today()) &&
          b.expiry >= today(),
      )
      .sort((a, b) => a.expiry.localeCompare(b.expiry))) {
      const take = Math.min(remaining, Math.max(0, available(s, b.id, o.id)));
      if (take > 0) {
        o.reservations.push({ batchId: b.id, quantity: take });
        remaining -= take;
      }
      if (remaining < 0.000001) break;
    }
    if (remaining > 0.000001)
      deficits.push({ ingredientId, quantity: remaining });
  }
  return deficits;
}
export function snapshot(s: State, o: Order) {
  const items = o.items.map((item) => {
    const r = s.recipes.find((x) => x.id === item.recipeId)!;
    const lines = r.lines.map((l) => {
      const i = s.ingredients.find((x) => x.id === l.ingredientId)!;
      return {
        ingredientId: i.id,
        name: i.name,
        quantity: l.quantity / i.yield,
        cost: ((l.quantity / i.yield) * i.packCost) / i.packQuantity,
      };
    });
    return {
      recipeId: r.id,
      name: `${r.name} · ${r.variant}`,
      quantity: item.quantity,
      unitCost: Math.round(lines.reduce((v, l) => v + l.cost, 0)),
      lines,
    };
  });
  return {
    items,
    total: items.reduce((v, l) => v + l.unitCost * l.quantity, 0),
  };
}
export function alerts(s: State) {
  const a: { title: string; detail: string; href: string }[] = [];
  for (const i of s.ingredients) {
    const stock = s.batches
      .filter((b) => b.ingredientId === i.id && b.expiry && b.expiry >= today())
      .reduce((v, b) => v + Math.max(0, available(s, b.id)), 0);
    if (stock <= i.threshold)
      a.push({
        title: `${i.name}: restock`,
        detail: `${Math.round(stock * 100) / 100} ${i.unit} available · threshold ${i.threshold}`,
        href: "inventory",
      });
  }
  for (const b of s.batches) {
    if (b.quantity <= 0) continue;
    const days = b.expiry
      ? Math.round((Date.parse(b.expiry) - Date.parse(today())) / 86400000)
      : null;
    if (days === null || days <= 3)
      a.push({
        title: `${s.ingredients.find((i) => i.id === b.ingredientId)?.name}: ${days === null ? "date needed" : days < 0 ? "expired" : "expiry approaching"}`,
        detail:
          b.expiry ||
          "Record the supplier label date before allocating this batch.",
        href: "expiry",
      });
  }
  for (const p of s.purchases)
    if (p.status === "ordered" && p.eta < today())
      a.push({
        title: "Supplier delivery overdue",
        detail: s.suppliers.find((x) => x.id === p.supplierId)?.name || "",
        href: "suppliers",
      });
  for (const o of s.orders)
    if (
      !["delivered", "cancelled", "declined"].includes(o.status) &&
      o.details.date &&
      o.details.date <=
        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    )
      a.push({
        title: `${o.reference} · ${o.details.date}`,
        detail: `${o.details.company || o.details.name} · ${o.status}`,
        href: `orders/${o.id}`,
      });
  return a;
}
export function recap(s: State, customerId: string, from: string, to: string) {
  const customer = s.customers.find((x) => x.id === customerId);
  if (!customer) throw Error("Select a customer");
  const orders = s.orders.filter(
    (o) =>
      o.customerId === customerId &&
      o.status === "delivered" &&
      o.details.date >= from &&
      o.details.date <= to,
  );
  const ids = new Set(orders.map((o) => o.id));
  const popular: Record<string, number> = {};
  for (const o of orders)
    for (const item of o.costSnapshot?.items || [])
      popular[item.name] = (popular[item.name] || 0) + item.quantity;
  const waste = s.waste.filter(
    (w) => ids.has(w.orderId) && w.date >= from && w.date <= to,
  );
  const feedback = s.feedback.filter(
    (f) =>
      f.customerId === customerId &&
      ids.has(f.orderId) &&
      f.date >= from &&
      f.date <= to,
  );
  return {
    customer: customer.company || customer.name,
    from,
    to,
    orders: orders.length,
    portions: Object.values(popular).reduce((a, b) => a + b, 0),
    popular: Object.entries(popular)
      .sort((a, b) => b[1] - a[1])
      .map(([name, portions]) => ({ name, portions })),
    wasteKg: waste.reduce((v, w) => v + w.weightGrams, 0) / 1000,
    wasteRecords: waste.length,
    unservedPortions: waste
      .filter(
        (w) => w.category === "unserved portions" && w.unit === "portions",
      )
      .reduce((v, w) => v + w.quantity, 0),
    feedback: feedback.length
      ? Math.round(
          (feedback.reduce((v, f) => v + f.rating, 0) / feedback.length) * 10,
        ) / 10
      : null,
  };
}
const recipeImage = z.union([
  safeURL,
  z.string().regex(/^\/images\/[a-zA-Z0-9_./-]+$/),
]);
const recipeLineSchema = z.object({
  ingredientId: short.min(1),
  quantity: positive,
  displayQuantity: positive.optional(),
  displayUnit: z.enum(recipeUnits).optional(),
  conversionConfirmed: z.boolean().optional(),
});
const recipeSchema = z.object({
  id: short.optional(),
  name: short.min(1),
  variant: short.min(1),
  imageUrl: recipeImage.optional(),
  createdAt: date.optional(),
  instructions: long.optional(),
  status: z.enum(["draft", "active"]).optional(),
  collections: z
    .array(
      z.object({
        year: z.number().int().min(2000).max(2200),
        season: z.enum(seasons),
      }),
    )
    .max(100)
    .optional(),
  lines: z.array(recipeLineSchema).min(1).max(100),
});
export type Command = { id: string; type: string; payload: any };
export function applyCommand(
  original: State,
  command: Command,
  actor: string,
): State {
  if (original.commands.includes(command.id)) return original;
  const s = normaliseState(structuredClone(original)),
    p = command.payload,
    at = new Date().toISOString();
  let target = "";
  const findOrder = () => {
    const o = s.orders.find((x) => x.id === p.orderId);
    if (!o) throw Error("Order not found");
    target = o.id;
    return o;
  };
  const editable = (o: Order) => {
    if (!["enquiry", "quote"].includes(o.status))
      throw Error(
        "Only unconfirmed orders can be edited. Cancel and create a replacement for a confirmed change.",
      );
  };
  const saveRecipe = (input: z.infer<typeof recipeSchema>) => {
    if (
      input.lines.some(
        (line) => !s.ingredients.some((item) => item.id === line.ingredientId),
      )
    )
      throw Error("Ingredient not found");
    if (
      input.lines.some(
        (line) =>
          line.conversionConfirmed === false ||
          !Number.isFinite(line.quantity) ||
          line.quantity <= 0,
      )
    )
      throw Error("Review ingredient measurements before saving");
    if (
      input.id &&
      (() => {
        const old = s.recipes.find((recipe) => recipe.id === input.id);
        return (
          !old ||
          old.name !== input.name ||
          old.variant !== input.variant ||
          JSON.stringify(old.lines) !== JSON.stringify(input.lines)
        );
      })() &&
      s.orders.some(
        (order) =>
          ![
            "enquiry",
            "quote",
            "delivered",
            "cancelled",
            "declined",
          ].includes(order.status) &&
          order.items.some((item) => item.recipeId === input.id),
      )
    )
      throw Error(
        "Create a new variant while this recipe has active confirmed orders",
      );
    const id = input.id || uid();
    const recipe: Recipe = {
      ...input,
      id,
      createdAt: input.createdAt || today(),
      instructions: input.instructions || "",
      status: input.status || "active",
      collections: input.collections || [],
    };
    s.recipes = s.recipes.filter((item) => item.id !== id).concat(recipe);
    for (const order of s.orders.filter(
      (item) =>
        item.items.some((line) => line.recipeId === id) &&
        ["enquiry", "quote"].includes(item.status),
    ))
      order.allergyReviewed = false;
    target = id;
  };
  switch (command.type) {
    case "settings": {
      s.settings = z
        .object({
          priceMode: z.enum(["exclusive", "inclusive"]).optional(),
          warningDays: nonnegative.int().max(365).optional(),
          urgentDays: nonnegative.int().max(365).optional(),
          businessName: short.optional(),
          businessAddress: short.optional(),
          vatNumber: short.optional(),
          paymentInstructions: long.optional(),
          kitchen: short,
          vatRate: nonnegative.max(100),
          vehicle: short,
          mpg: nonnegative.max(300),
          fuelPrice: nonnegative.max(20),
          bufferMinutes: nonnegative.int().max(1440),
          ownerNotes: long,
          recipeEditorMode: z.enum(["workspace", "wizard"]).optional(),
        })
        .parse(p);
      if ((s.settings.urgentDays ?? 3) > (s.settings.warningDays ?? 7))
        throw Error("Urgent warning must be within the warning window");
      break;
    }
    case "ingredient": {
      const v = z
        .object({
          id: short.optional(),
          name: short.min(1),
          category: ingredientCategory.optional(),
          unit: z.enum(["g", "ml", "each"]),
          packQuantity: positive,
          packCost: cents,
          yield: positive.max(1),
          allergens: short,
          supplierId: short,
          threshold: nonnegative,
        })
        .parse(p);
      if (v.supplierId && !s.suppliers.some((x) => x.id === v.supplierId))
        throw Error("Supplier not found");
      const old = s.ingredients.find((i) => i.id === v.id);
      if (
        old &&
        (old.unit !== v.unit ||
          old.yield !== v.yield ||
          old.allergens !== v.allergens) &&
        s.orders.some(
          (o) =>
            ![
              "enquiry",
              "quote",
              "delivered",
              "cancelled",
              "declined",
            ].includes(o.status) &&
            o.items.some((item) =>
              s.recipes
                .find((r) => r.id === item.recipeId)
                ?.lines.some((l) => l.ingredientId === old.id),
            ),
        )
      )
        throw Error(
          "Ingredient handling or allergen changes affect a confirmed order. Create a replacement ingredient and revise the order first.",
        );
      const id = v.id || uid();
      s.ingredients = s.ingredients
        .filter((x) => x.id !== id)
        .concat({ ...v, id });
      const preferred = s.offerings.find(
        (x) => x.ingredientId === id && x.preferred,
      );
      if (!preferred && v.supplierId)
        s.offerings.push({
          id: uid(),
          ingredientId: id,
          supplierId: v.supplierId,
          preferred: true,
          packQuantity: v.packQuantity,
          packCost: v.packCost,
          vatRate: null,
          priceMode: "exclusive",
        });
      else if (
        preferred &&
        (old?.packCost !== v.packCost ||
          old?.packQuantity !== v.packQuantity ||
          old?.supplierId !== v.supplierId)
      )
        Object.assign(preferred, {
          packCost: v.packCost,
          packQuantity: v.packQuantity,
          supplierId: v.supplierId,
        });
      for (const o of s.orders.filter((x) =>
        ["enquiry", "quote"].includes(x.status),
      ))
        o.allergyReviewed = false;
      target = id;
      break;
    }
    case "recipe-save": {
      const payload = z
        .object({
          recipe: recipeSchema,
          ingredients: z
            .array(
              z.object({
                id: short.min(1),
                name: short.min(1),
                category: z.enum(categories).optional(),
                unit: z.enum(["g", "ml", "each"]),
                packQuantity: positive,
                packCost: cents,
                yield: positive.max(1),
                allergens: short,
                supplierId: short,
                threshold: nonnegative,
                onlineEstimate: z
                  .object({
                    packQuantity: positive,
                    packCost: cents,
                    sourceTitle: short,
                    sourceUrl: safeURL,
                    researchedAt: z.string().datetime(),
                    acceptedAt: z.string().datetime(),
                  })
                  .optional(),
              }),
            )
            .max(100)
            .default([]),
        })
        .parse(p);
      for (const ingredient of payload.ingredients) {
        if (
          ingredient.supplierId &&
          !s.suppliers.some((supplier) => supplier.id === ingredient.supplierId)
        )
          throw Error("Supplier not found");
        if (s.ingredients.some((item) => item.id === ingredient.id))
          throw Error("A proposed ingredient id already exists");
      }
      s.ingredients.push(...payload.ingredients);
      saveRecipe(payload.recipe);
      break;
    }
    case "recipe": {
      saveRecipe(recipeSchema.parse(p));
      break;
    }
    case "customer": {
      const v = z
        .object({
          id: short.optional(),
          industry: z.enum(industries).optional(),
          name: short.min(1),
          company: short,
          email: z.string().email(),
          phone: short,
          notes: long,
        })
        .parse(p);
      const id = v.id || uid();
      s.customers = s.customers.filter((x) => x.id !== id).concat({ ...v, id });
      target = id;
      break;
    }
    case "order": {
      // Historical website enquiries may be imported after their event date.
      const details =
        p.imported === true && actor === "system:enquiry-import"
          ? enquirySchema.innerType().parse(p.details)
          : enquirySchema.parse(p.details);
      const id = p.orderId || uid();
      const o = s.orders.find((x) => x.id === id);
      if (o) editable(o);
      let customer = s.customers.find(
        (x) =>
          x.email.trim().toLowerCase() === details.email.trim().toLowerCase(),
      );
      if (!customer) {
        customer = {
          id: uid(),
          name: details.name,
          company: details.company,
          email: details.email,
          phone: details.phone,
          notes: "",
        };
        s.customers.push(customer);
      }
      const items = z
        .array(z.object({ recipeId: short, quantity: count }))
        .max(100)
        .parse(p.items || []);
      if (new Set(items.map((i) => i.recipeId)).size !== items.length)
        throw Error(
          "Combine quantities for each recipe variant into one order line",
        );
      if (
        items.some(
          (i) =>
            !s.recipes.some(
              (r) => r.id === i.recipeId && (r.status || "active") === "active",
            ),
        )
      )
        throw Error("Recipe not found or still in draft");
      if (p.enquiryId && s.orders.some((x) => x.enquiryId === p.enquiryId))
        throw Error("This enquiry already has an order");
      const cleanDetails = {
        ...details,
        requirements: details.requirements.map((r) => ({
          ...r,
          reviewed: false,
        })),
      };
      if (o) {
        if (
          cleanDetails.place?.id === o.details.place?.id &&
          (cleanDetails.address !== o.details.address ||
            cleanDetails.venue !== o.details.venue ||
            cleanDetails.postcode !== o.details.postcode)
        )
          cleanDetails.place = undefined;
        o.details = cleanDetails;
        o.items = items;
        o.customerId = customer.id;
        o.allergyReviewed = false;
        o.status = "enquiry";
        o.statusHistory ||= [];
        o.statusHistory.push({ status: "enquiry", at });
      } else {
        s.orders.push({
          id,
          createdAt: at,
          statusHistory: [{ status: "enquiry", at }],
          reference: nextReference(s, "EM"),
          customerId: customer.id,
          enquiryId: p.enquiryId,
          details: cleanDetails,
          status: "enquiry",
          items,
          quotes: [],
          allergyReviewed: false,
          consumed: false,
          reservations: [],
        });
      }
      target = id;
      break;
    }
    case "quote": {
      const o = findOrder();
      editable(o);
      if (!o.items.length) throw Error("Add meal quantities first");
      const v = z
        .object({
          net: cents,
          notes: long,
          priceMode: z.enum(["exclusive", "inclusive"]).optional(),
        })
        .parse(p);
      const vatRate = s.settings.vatRate;
      const priceMode = v.priceMode || s.settings.priceMode || "exclusive";
      const totals = tax(v.net, vatRate, priceMode);
      o.quotes.push({
        version: o.quotes.length + 1,
        ...totals,
        vatRate,
        priceMode,
        notes: v.notes,
        at,
      });
      o.status = "quote";
      o.statusHistory ||= [];
      o.statusHistory.push({ status: "quote", at });
      break;
    }
    case "allergy-review": {
      const o = findOrder();
      editable(o);
      const rows = z
        .array(
          z.object({
            reference: short.min(1),
            requirements: short,
            meal: short.min(1),
            reviewed: z.literal(true),
          }),
        )
        .parse(p.requirements);
      if (rows.length !== o.details.requirements.length)
        throw Error("Review every attendee requirement");
      if (
        rows.some(
          (r, i) =>
            r.reference !== o.details.requirements[i].reference ||
            r.requirements !== o.details.requirements[i].requirements,
        )
      )
        throw Error("Requirements changed; reload and review");
      if (rows.some((r) => !o.items.some((item) => item.recipeId === r.meal)))
        throw Error("Assign each attendee to a meal on this order");
      for (const item of o.items)
        if (rows.filter((r) => r.meal === item.recipeId).length > item.quantity)
          throw Error("Assigned guests exceed the portions for this meal");
      o.details.requirements = rows;
      o.allergyReviewed = true;
      break;
    }
    case "stage": {
      const o = findOrder();
      const next = z.enum([...stages, "cancelled", "declined"]).parse(p.status);
      if (next === o.status) break;
      if (["delivered", "cancelled", "declined"].includes(o.status))
        throw Error("This order is closed");
      if (["cancelled", "declined"].includes(next)) {
        if (o.status === "delivered")
          throw Error("Delivered orders cannot be cancelled");
        if (["prepared", "cooked"].includes(o.status) && !o.consumed)
          throw Error(
            "Reconcile actual consumed/wasted ingredients before cancelling a prepared order",
          );
        o.reservations = [];
        o.status = next;
        o.statusHistory ||= [];
        o.statusHistory.push({ status: next, at });
        break;
      }
      if (next === "confirmed") {
        if (o.status !== "quote" || !o.quotes.length || !o.items.length)
          throw Error("Prepare a quote before confirming");
        if (!o.allergyReviewed)
          throw Error("Confirm dietary and allergy review before accepting");
        if (!o.details.date || !o.details.address)
          throw Error("Confirm the date and venue address first");
        o.costSnapshot = snapshot(s, o);
        o.acceptedAt = at;
        o.status = "confirmed";
        reconcileStock(s);
        invoiceDraft(s, o, at);
      } else if (
        next === "ingredients needed" ||
        next === "ingredients ready"
      ) {
        if (
          !["confirmed", "ingredients needed", "ingredients ready"].includes(
            o.status,
          )
        )
          throw Error("Confirm the order first");
        const missing = reserve(s, o);
        if (next === "ingredients ready" && missing.length)
          throw Error(
            "Insufficient dated stock; receive stock before marking ready",
          );
      } else if (next === "prepared") {
        if (o.status !== "ingredients ready")
          throw Error("Mark ingredients ready first");
        reconcileStock(s);
        if (
          Object.entries(needs(s, o)).some(
            ([id, q]) =>
              q -
                o.reservations
                  .filter(
                    (r) =>
                      s.batches.find((b) => b.id === r.batchId)
                        ?.ingredientId === id,
                  )
                  .reduce((n, r) => n + r.quantity, 0) >
              1e-6,
          )
        )
          throw Error("Stock availability changed");
      } else if (next === "packaged") {
        if (o.status !== "cooked") throw Error("Mark cooked first");
        consumeOrder(s, o, at);
      } else if (
        stages.indexOf(next as any) !==
        stages.indexOf(o.status as any) + 1
      )
        throw Error("Follow the next preparation stage");
      o.status = next;
      o.statusHistory ||= [];
      o.statusHistory.push({ status: next, at });
      break;
    }
    case "stock-receive": {
      const v = z
        .object({
          ingredientId: short,
          quantity: positive,
          location: z.enum(["fridge", "freezer", "ambient"]),
          intake: date,
          expiry: maybeDate,
          dateType: z.enum(["use-by", "best-before"]),
          opened: maybeDate,
          frozen: maybeDate,
          thawed: maybeDate,
          notes: long,
          purchaseId: short.optional(),
        })
        .parse(p);
      const i = s.ingredients.find((x) => x.id === v.ingredientId);
      if (!i) throw Error("Ingredient not found");
      if (v.expiry && v.expiry < v.intake)
        throw Error("Expiry is before intake");
      const id = uid();
      const purchase = v.purchaseId
        ? s.purchases.find((po) => po.id === v.purchaseId)
        : undefined;
      s.batches.push({
        ...v,
        id,
        unitCost: purchase
          ? purchase.cost / purchase.quantity
          : i.packCost / i.packQuantity,
      });
      s.movements.push({
        id: uid(),
        batchId: id,
        quantity: v.quantity,
        reason: "Stock intake",
        at,
      });
      if (v.purchaseId) {
        const po = s.purchases.find((x) => x.id === v.purchaseId);
        if (!po || po.status === "received")
          throw Error("Purchase is missing or already received");
        if (
          po.ingredientId !== v.ingredientId ||
          v.quantity > po.quantity - (po.receivedQuantity || 0)
        )
          throw Error(
            "Received item must match and quantity must not exceed the outstanding purchase",
          );
        po.receivedQuantity = (po.receivedQuantity || 0) + v.quantity;
        po.status = po.receivedQuantity >= po.quantity ? "received" : "ordered";
      }
      target = id;
      break;
    }
    case "stock-adjust": {
      const v = z
        .object({
          batchId: short,
          quantity: nonnegative,
          reason: short.min(3),
          location: z.enum(["fridge", "freezer", "ambient"]),
          expiry: maybeDate,
          opened: maybeDate,
          frozen: maybeDate,
          thawed: maybeDate,
        })
        .parse(p);
      const b = s.batches.find((x) => x.id === v.batchId);
      if (!b) throw Error("Batch not found");
      const delta = v.quantity - b.quantity;
      Object.assign(b, v);
      s.movements.push({
        id: uid(),
        batchId: b.id,
        quantity: delta,
        cost: Math.round(Math.abs(delta) * b.unitCost),
        reason: v.reason,
        at,
      });
      target = b.id;
      break;
    }
    case "supplier": {
      const v = z
        .object({
          id: short.optional(),
          name: short.min(1),
          email: z.string().email(),
          phone: short,
          deliveryCharge: cents,
          minimumOrder: cents,
          leadDays: nonnegative.int().max(365),
          contactName: short.optional(),
          contactRole: short.optional(),
          website: safeURL.optional(),
          address: short.optional(),
          logoUrl: safeURL.optional(),
          businessDetails: long.optional(),
          research: z
            .object({
              key: long,
              text: z.string().max(30000),
              at: short,
              sources: z
                .array(z.object({ title: short, url: safeURL }))
                .max(50),
            })
            .optional(),
          notes: long,
        })
        .parse(p);
      const id = v.id || uid(),
        old = s.suppliers.find((x) => x.id === id);
      s.suppliers = s.suppliers
        .filter((x) => x.id !== id)
        .concat({ ...v, id, comms: old?.comms || [] });
      target = id;
      break;
    }
    case "supplier-note": {
      const v = z.object({ supplierId: short, message: long.min(1) }).parse(p);
      const sup = s.suppliers.find((x) => x.id === v.supplierId);
      if (!sup) throw Error("Supplier not found");
      sup.comms.push({ at, message: v.message });
      target = sup.id;
      break;
    }
    case "purchase": {
      const v = z
        .object({
          supplierId: short,
          ingredientId: short,
          quantity: positive,
          cost: cents,
          eta: date,
          notes: long,
        })
        .parse(p);
      if (
        !s.suppliers.some((x) => x.id === v.supplierId) ||
        !s.ingredients.some((x) => x.id === v.ingredientId)
      )
        throw Error("Select a supplier and ingredient");
      s.purchases.push({
        ...v,
        id: uid(),
        status: "ordered",
        at,
        receivedQuantity: 0,
      });
      break;
    }
    case "waste": {
      const v = z
        .object({
          orderId: short,
          ingredientId: short,
          recipeId: short,
          batchId: short,
          category: z.enum([
            "preparation trimmings",
            "spoilage",
            "unserved portions",
            "plate waste",
          ]),
          quantity: positive,
          unit: z.enum(["g", "ml", "each", "portions"]),
          weightGrams: nonnegative,
          weightMeasured: z.preprocess(
            (v) => (v === "yes" ? true : v === "no" ? false : v),
            z.boolean().optional(),
          ),
          reason: short.min(1),
          date: date,
        })
        .parse(p);
      const o = s.orders.find((x) => x.id === v.orderId);
      let cost = 0;
      let movementId: string | undefined;
      if (v.orderId && !o) throw Error("Order not found");
      if (v.category === "spoilage") {
        const b = s.batches.find((x) => x.id === v.batchId);
        const i = b && s.ingredients.find((x) => x.id === b.ingredientId);
        if (!b || !i || v.ingredientId !== i.id || v.unit !== i.unit)
          throw Error("Select a stock batch with its matching unit");
        if (v.quantity > b.quantity) throw Error("Waste exceeds stock");
        b.quantity -= v.quantity;
        cost = Math.round(v.quantity * b.unitCost);
        s.movements.push({
          id: uid(),
          batchId: b.id,
          quantity: -v.quantity,
          reason: "Spoilage",
          cost,
          orderId: v.orderId || undefined,
          at: `${v.date}T12:00:00.000Z`,
        });
        movementId = s.movements.at(-1)!.id;
      } else {
        if (!o || (!o.consumed && !["prepared", "cooked"].includes(o.status)))
          throw Error("Select an order whose ingredients have been prepared");
        if (v.category === "preparation trimmings") {
          const line = o.costSnapshot?.items
            .flatMap((item) =>
              item.lines.map((l) => ({
                ...l,
                orderQty: l.quantity * item.quantity,
              })),
            )
            .filter((l) => l.ingredientId === v.ingredientId);
          const i = s.ingredients.find((x) => x.id === v.ingredientId);
          if (!line?.length || !i || v.unit !== i.unit)
            throw Error("Select an ingredient used by this order");
          const max = line.reduce((a, l) => a + l.orderQty, 0);
          const prior = s.waste
            .filter(
              (w) =>
                w.orderId === o.id &&
                w.ingredientId === i.id &&
                w.category === v.category,
            )
            .reduce((a, w) => a + w.quantity, 0);
          if (v.quantity + prior > max)
            throw Error("Trimmings exceed the ingredient quantity used");
          cost = Math.round((v.quantity * line[0].cost) / line[0].quantity);
        } else {
          const item = o.costSnapshot?.items.find(
            (x) => x.recipeId === v.recipeId,
          );
          if (!item || v.unit !== "portions")
            throw Error(
              "Select a meal and record portions; weight is entered separately",
            );
          const prior = s.waste
            .filter(
              (w) =>
                w.orderId === o.id &&
                w.recipeId === v.recipeId &&
                ["unserved portions", "plate waste"].includes(w.category),
            )
            .reduce((a, w) => a + w.quantity, 0);
          if (prior + v.quantity > item.quantity)
            throw Error("Waste exceeds prepared portions");
          cost = Math.round(item.unitCost * v.quantity);
        }
      }
      s.waste.push({ ...v, id: uid(), cost, movementId });
      break;
    }
    case "feedback": {
      const v = z
        .object({
          customerId: short,
          orderId: short,
          rating: positive.int().max(5),
          comment: long,
          date: date,
        })
        .parse(p);
      if (
        !s.orders.some(
          (o) => o.id === v.orderId && o.customerId === v.customerId,
        )
      )
        throw Error("Order does not belong to customer");
      s.feedback.push({ ...v, id: uid() });
      break;
    }
    case "crm-engagement": {
      const v = z
        .object({
          customerId: short.min(1),
          orderId: short.optional(),
          type: z.enum(["call", "email", "meeting", "note"]),
          direction: z.enum(["inbound", "outbound", "internal"]),
          summary: long.min(1),
          occurredAt: z.string().datetime(),
        })
        .parse(p);
      if (!s.customers.some((c) => c.id === v.customerId))
        throw Error("Customer not found");
      if (
        v.orderId &&
        !s.orders.some(
          (o) => o.id === v.orderId && o.customerId === v.customerId,
        )
      )
        throw Error("Order does not belong to customer");
      const id = uid();
      s.engagements.push({ ...v, id, createdAt: at, actor });
      target = id;
      break;
    }
    case "crm-follow-up": {
      const v = z
        .object({
          id: short.optional(),
          customerId: short.min(1),
          orderId: short.optional(),
          dueDate: date,
          note: long.min(1),
          status: z
            .enum(["open", "completed", "cancelled"])
            .default("open"),
        })
        .parse(p);
      if (!s.customers.some((c) => c.id === v.customerId))
        throw Error("Customer not found");
      if (
        v.orderId &&
        !s.orders.some(
          (o) => o.id === v.orderId && o.customerId === v.customerId,
        )
      )
        throw Error("Order does not belong to customer");
      const existing = v.id
        ? s.followUps.find((followUp) => followUp.id === v.id)
        : undefined;
      if (v.id && !existing) throw Error("Follow-up not found");
      if (existing && existing.customerId !== v.customerId)
        throw Error("Follow-up does not belong to customer");
      const id = existing?.id || uid();
      const followUp = {
        ...v,
        id,
        createdAt: existing?.createdAt || at,
        actor: existing?.actor || actor,
        completedAt:
          v.status === "completed" ? existing?.completedAt || at : undefined,
      };
      s.followUps = s.followUps.filter((x) => x.id !== id).concat(followUp);
      target = id;
      break;
    }
    case "finance": {
      const v = z
        .object({
          type: z.enum(["income", "expense"]),
          amount: cents,
          category: short.min(1),
          description: short.min(1),
          date: date,
          orderId: short,
        })
        .parse(p);
      if (v.orderId && !s.orders.some((x) => x.id === v.orderId))
        throw Error("Order not found");
      s.finance.push({ ...v, id: uid() });
      break;
    }
    case "draft": {
      const v = z
        .object({
          to: z.string().email(),
          subject: short.min(1),
          body: long.min(1),
          customerId: short.optional(),
          supplierId: short.optional(),
        })
        .parse(p);
      s.drafts.push({ ...v, id: uid(), at });
      break;
    }
    case "route": {
      const o = findOrder();
      o.route = z
        .object({
          miles: nonnegative,
          minutes: nonnegative,
          departure: short,
          returnTrip: z.boolean(),
          extraCost: cents,
          outboundMiles: nonnegative.optional(),
          outboundMinutes: nonnegative.optional(),
          returnMiles: nonnegative.optional(),
          returnMinutes: nonnegative.optional(),
          returnDeparture: short.optional(),
          venueDurationMinutes: nonnegative.optional(),
          parkingCost: cents.optional(),
          otherCost: cents.optional(),
        })
        .transform((v) => ({
          ...v,
          fuelCost: fuelCost(v.miles, s.settings.mpg, s.settings.fuelPrice),
          source: "Manual estimate",
          at,
        }))
        .parse(p);
      break;
    }
    case "analysis": {
      const o = findOrder();
      o.analysis = p.analysis;
      break;
    }
    default: {
      const result =
        applyOperations(s, command.type, p, at) ??
        reportingCommand(s, command.type, p);
      if (result === undefined) throw Error("Unknown action");
      target = result;
    }
  }
  reconcileStock(s);
  s.audit.push({ at, actor, action: command.type, target });
  s.commands.push(command.id);
  s.commands = s.commands.slice(-500);
  return s;
}
