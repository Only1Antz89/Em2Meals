// Supplier recalls and contamination notices.
//
// A recall matches stock batches by their label lot code (and optionally the
// ingredient and supplier). Matching batches are quarantined, so they are no
// longer allocated to orders, and the orders that had them reserved or
// already used them are recorded for follow-up. The owner then disposes of
// the stock (recorded as a stock movement) or releases it if the notice
// turns out not to apply.
import { z } from "zod";
import { sameLot, uid, type Recall, type State } from "./domain";

const short = z.string().max(500);

export function matchingBatches(
  s: State,
  match: { lot: string; ingredientId?: string; supplierId?: string },
) {
  return s.batches.filter(
    (b) =>
      sameLot(b.lot, match.lot) &&
      (!match.ingredientId || b.ingredientId === match.ingredientId) &&
      (!match.supplierId || !b.supplierId || b.supplierId === match.supplierId),
  );
}

// Everything that touched a set of batches: current reservations and past
// usage (stock movements linked to an order).
export function batchTrace(s: State, batchIds: string[]) {
  const ids = new Set(batchIds);
  const reserved = s.orders.filter((o) =>
    o.reservations.some((r) => ids.has(r.batchId)),
  );
  const used = s.orders.filter((o) =>
    s.movements.some(
      (m) => ids.has(m.batchId) && m.orderId === o.id && m.quantity < 0,
    ),
  );
  return {
    reserved,
    used,
    orderIds: Array.from(new Set([...reserved, ...used].map((o) => o.id))),
  };
}

export function recallCommand(
  s: State,
  type: string,
  payload: unknown,
  at: string,
): string | undefined {
  if (!["stock-recall", "recall-dispose", "recall-release"].includes(type))
    return undefined;
  const p = z.record(z.unknown()).parse(payload);
  s.recalls ||= [];
  if (type === "stock-recall") {
    const v = z
      .object({
        lot: short.trim().min(1, "Enter the batch or lot code from the notice"),
        ingredientId: short.optional(),
        supplierId: short.optional(),
        reason: z.string().trim().min(3).max(2000),
        reference: short.default(""),
        source: z.enum(["supplier", "food-safety-alert", "owner"]).default("supplier"),
      })
      .parse(p);
    if (v.ingredientId && !s.ingredients.some((i) => i.id === v.ingredientId))
      throw Error("Ingredient not found");
    if (v.supplierId && !s.suppliers.some((x) => x.id === v.supplierId))
      throw Error("Supplier not found");
    const batches = matchingBatches(s, v).filter(
      (b) => b.quantity > 0 || s.movements.some((m) => m.batchId === b.id),
    );
    const trace = batchTrace(s, batches.map((b) => b.id));
    const recall: Recall = {
      id: uid(),
      at,
      source: v.source,
      reference: v.reference,
      reason: v.reason,
      lot: v.lot,
      ingredientId: v.ingredientId,
      supplierId: v.supplierId,
      batchIds: batches.map((b) => b.id),
      orderIds: trace.orderIds,
      status: batches.some((b) => b.quantity > 0) ? "open" : "disposed",
    };
    if (recall.status === "disposed") {
      recall.closedAt = at;
      recall.closedNote = "No matching stock on hand.";
    }
    for (const b of batches)
      if (b.quantity > 0)
        b.quarantined = { recallId: recall.id, at, reason: v.reason };
    // Release reservations so the stock reconciliation re-allocates orders
    // from other eligible batches where it can.
    for (const o of s.orders)
      o.reservations = o.reservations.filter(
        (r) => !batches.some((b) => b.id === r.batchId),
      );
    s.recalls.push(recall);
    if (v.supplierId) {
      const supplier = s.suppliers.find((x) => x.id === v.supplierId);
      supplier?.comms.push({
        at,
        message: `Recall notice${v.reference ? ` ${v.reference}` : ""}: lot ${v.lot}. ${v.reason}`,
      });
    }
    return recall.id;
  }
  const v = z
    .object({ recallId: short, note: z.string().max(2000).default("") })
    .parse(p);
  const recall = s.recalls.find((r) => r.id === v.recallId);
  if (!recall) throw Error("Recall not found");
  if (recall.status !== "open") throw Error("This recall is already closed");
  for (const b of s.batches.filter((b) => b.quarantined?.recallId === recall.id)) {
    if (type === "recall-dispose" && b.quantity > 0) {
      s.movements.push({
        id: uid(),
        batchId: b.id,
        quantity: -b.quantity,
        cost: Math.round(b.quantity * b.unitCost),
        reason: `Recall disposal: lot ${recall.lot}${recall.reference ? ` (${recall.reference})` : ""}`,
        at,
      });
      b.quantity = 0;
    }
    delete b.quarantined;
  }
  recall.status = type === "recall-dispose" ? "disposed" : "released";
  recall.closedAt = at;
  recall.closedNote = v.note;
  return recall.id;
}
