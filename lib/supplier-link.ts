import type { State } from "./domain";
import { requestForLink, type SupplierResponse } from "./operations";

// What a supplier sees on their confirmation page. Only the kitchen's name,
// the items and dates: never customer names, order references or notes.
export type SupplierOrderView = {
  status: "open" | "confirmed" | "received" | "cancelled" | "recorded";
  kitchen: string;
  supplier: string;
  requestedOn: string;
  neededBy: string;
  suggestedDate: string;
  lines: {
    ingredientId: string;
    name: string;
    unit: string;
    quantity: number;
    packs: number;
    packSize: number;
    estimate: number | null;
    neededBy: string;
  }[];
  response?: SupplierResponse;
};

export function supplierOrderView(
  s: State,
  token: string,
): SupplierOrderView | null {
  const d = requestForLink(s, token);
  if (!d?.proposal) return null;
  const purchases = s.purchases.filter((p) => p.requestId === d.id);
  const status: SupplierOrderView["status"] =
    d.superseded && !d.purchaseConfirmed
      ? "cancelled"
      : d.purchaseConfirmed && !d.supplierResponse
        ? "recorded"
        : purchases.some((p) => (p.receivedQuantity || 0) > 0)
          ? "received"
          : d.supplierResponse
            ? "confirmed"
            : "open";
  const lines = d.proposal.lines.map((l) => {
    const ingredient = s.ingredients.find((i) => i.id === l.ingredientId);
    const packs = l.packs || 1;
    return {
      ingredientId: l.ingredientId,
      name: ingredient?.name || "Item",
      unit: ingredient?.unit || "",
      quantity: l.quantity,
      packs,
      packSize: l.quantity / packs,
      estimate: l.cost === null ? null : l.cost + (l.vat || 0),
      neededBy: l.eventDate,
    };
  });
  const neededBy = lines.map((l) => l.neededBy).filter(Boolean).sort()[0] || "";
  const etas = d.proposal.lines.map((l) => l.eta).sort();
  return {
    status,
    kitchen: s.settings.businessName || "The kitchen",
    supplier: s.suppliers.find((x) => x.id === d.supplierId)?.name || "",
    requestedOn: (d.sentAt || d.at).slice(0, 10),
    neededBy,
    suggestedDate: d.supplierResponse?.deliveryDate || etas[0] || neededBy,
    lines,
    response: d.supplierResponse,
  };
}

export const supplierLinkPath = (token: string) => `/supplier/orders/${token}`;

export function supplierLinkText(origin: string, token: string) {
  return `Confirm this order, change quantities or set your delivery date here (no account needed):\n${origin}${supplierLinkPath(token)}`;
}
