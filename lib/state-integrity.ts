import type { State } from "./domain";

type Identified = { id: string };

function ids<T extends Identified>(rows: T[], label: string) {
  if (!Array.isArray(rows)) throw Error(`Workspace ${label} must be a list`);
  const result = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || !row.id)
      throw Error(`Workspace ${label} contains a record without an id`);
    if (result.has(row.id))
      throw Error(`Workspace ${label} contains duplicate id ${row.id}`);
    result.add(row.id);
  }
  return result;
}

function reference(
  source: string,
  value: string | undefined,
  target: Set<string>,
  optional = false,
) {
  if (!value && optional) return;
  if (!value || !target.has(value))
    throw Error(`Workspace ${source} references missing id ${value || "(empty)"}`);
}

export function assertStateShape(value: unknown): asserts value is State {
  if (!value || typeof value !== "object") throw Error("Workspace data is invalid");
  const state = value as Partial<State>;
  for (const key of [
    "ingredients",
    "recipes",
    "customers",
    "orders",
    "batches",
    "movements",
    "suppliers",
    "purchases",
    "waste",
    "feedback",
    "finance",
    "drafts",
    "audit",
    "commands",
  ] as const) {
    if (!Array.isArray(state[key])) throw Error(`Workspace ${key} must be a list`);
  }
  if (!state.settings || typeof state.settings !== "object")
    throw Error("Workspace settings are invalid");
}

export function assertStateIntegrity(state: State) {
  const ingredients = ids(state.ingredients, "ingredients");
  const recipes = ids(state.recipes, "recipes");
  const customers = ids(state.customers, "customers");
  const orders = ids(state.orders, "orders");
  const batches = ids(state.batches, "batches");
  ids(state.movements, "movements");
  const suppliers = ids(state.suppliers, "suppliers");
  ids(state.offerings, "offerings");
  const purchases = ids(state.purchases, "purchases");
  ids(state.waste, "waste");
  ids(state.feedback, "feedback");
  ids(state.engagements, "engagements");
  ids(state.followUps, "follow-ups");
  ids(state.finance, "finance");
  ids(state.drafts, "drafts");
  const journeys = ids(state.journeys, "journeys");
  const invoices = ids(state.invoices, "invoices");

  for (const recipe of state.recipes)
    for (const line of recipe.lines)
      reference(`recipe ${recipe.id}`, line.ingredientId, ingredients);

  for (const order of state.orders) {
    reference(`order ${order.id}`, order.customerId, customers);
    for (const item of order.items)
      reference(`order ${order.id}`, item.recipeId, recipes);
    for (const reservation of order.reservations)
      reference(`order ${order.id}`, reservation.batchId, batches);
  }

  for (const batch of state.batches)
    reference(`batch ${batch.id}`, batch.ingredientId, ingredients);

  for (const movement of state.movements) {
    reference(`movement ${movement.id}`, movement.batchId, batches);
    reference(`movement ${movement.id}`, movement.orderId, orders, true);
  }

  for (const offering of state.offerings) {
    reference(`offering ${offering.id}`, offering.ingredientId, ingredients);
    reference(`offering ${offering.id}`, offering.supplierId, suppliers);
  }

  for (const purchase of state.purchases) {
    reference(`purchase ${purchase.id}`, purchase.ingredientId, ingredients);
    reference(`purchase ${purchase.id}`, purchase.supplierId, suppliers);
    for (const orderId of purchase.orderIds || [])
      reference(`purchase ${purchase.id}`, orderId, orders);
  }

  for (const waste of state.waste) {
    reference(`waste ${waste.id}`, waste.orderId, orders, true);
    reference(`waste ${waste.id}`, waste.ingredientId, ingredients, true);
    reference(`waste ${waste.id}`, waste.recipeId, recipes, true);
    reference(`waste ${waste.id}`, waste.batchId, batches, true);
  }

  for (const feedback of state.feedback) {
    reference(`feedback ${feedback.id}`, feedback.customerId, customers);
    reference(`feedback ${feedback.id}`, feedback.orderId, orders);
  }

  for (const engagement of state.engagements) {
    reference(`engagement ${engagement.id}`, engagement.customerId, customers);
    reference(`engagement ${engagement.id}`, engagement.orderId, orders, true);
  }

  for (const followUp of state.followUps) {
    reference(`follow-up ${followUp.id}`, followUp.customerId, customers);
    reference(`follow-up ${followUp.id}`, followUp.orderId, orders, true);
  }

  for (const entry of state.finance) {
    reference(`finance entry ${entry.id}`, entry.orderId, orders, true);
    reference(`finance entry ${entry.id}`, entry.purchaseId, purchases, true);
    reference(`finance entry ${entry.id}`, entry.journeyId, journeys, true);
  }

  // Drafts are immutable communication snapshots and may deliberately outlive
  // a deleted customer or supplier. Their optional ids are historical context,
  // rather than live referential links.

  for (const journey of state.journeys)
    reference(`journey ${journey.id}`, journey.orderId, orders);

  for (const invoice of state.invoices) {
    reference(`invoice ${invoice.id}`, invoice.orderId, orders);
    reference(`invoice ${invoice.id}`, invoice.originalId, invoices, true);
  }
}
