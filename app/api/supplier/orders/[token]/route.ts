import { after } from "next/server";
import { applyCommand, uid, type State } from "@/lib/domain";
import { requestForLink } from "@/lib/operations";
import {
  commitState,
  config,
  errorResponse,
  jsonBody,
  loadState,
  sameOrigin,
} from "@/lib/server";
import { rateLimit } from "@/lib/upgrade-server";
import { emailProvider, sendEmail } from "@/lib/email";
import { supplierOrderView } from "@/lib/supplier-link";

// Public endpoint behind the supplier's secret order link. No account is
// needed: knowing the link is the permission, and it only ever changes the
// one request it belongs to.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    sameOrigin(req);
    const { token } = await params;
    try {
      await rateLimit(req, "supplier-order", 30);
    } catch {
      return Response.json(
        { error: "Too many updates. Please try again later." },
        { status: 429 },
      );
    }
    const body = await jsonBody(req);
    let saved: State | undefined;
    for (let attempt = 0; attempt < 4 && !saved; attempt++) {
      const { state, revision } = await loadState("live");
      const request = requestForLink(state, token);
      const supplier = state.suppliers.find(
        (x) => x.id === request?.supplierId,
      );
      const next = applyCommand(
        state,
        {
          id: uid(),
          type: "supplier-response",
          payload: { ...body, token },
        },
        `supplier:${supplier?.name || "link"}`,
      );
      try {
        await commitState("live", next, revision);
        saved = next;
      } catch {
        /* another change landed first; retry from the latest revision */
      }
    }
    if (!saved) throw Error("The kitchen is busy. Please try again.");
    const view = supplierOrderView(saved, token)!;
    const origin = new URL(req.url).origin;
    try {
      after(() =>
        notifyKitchen(view, origin).catch((error) =>
          console.error("Supplier confirmation notification failed", error),
        ),
      );
    } catch {
      // Outside a Next.js request scope (unit tests); skip the email.
    }
    return Response.json(
      { view },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

// Let the kitchen know a supplier answered, so they don't have to check.
async function notifyKitchen(
  view: NonNullable<ReturnType<typeof supplierOrderView>>,
  origin: string,
) {
  const c = config();
  const recipients = String(c.OWNER_EMAILS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const provider = emailProvider(c);
  const r = view.response;
  if (!provider || !c.EMAIL_FROM || !recipients.length || !r) return;
  const changed = r.lines.filter((l) => l.status !== "confirmed");
  const names = (id: string) =>
    view.lines.find((l) => l.ingredientId === id)?.name || "Item";
  const summary = r.lines
    .map((l) =>
      l.status === "unavailable"
        ? `${names(l.ingredientId)}: not available`
        : `${names(l.ingredientId)}: ${+l.quantity.toFixed(2)}${l.status === "changed" ? ` (asked for ${+l.requested.toFixed(2)})` : ""}`,
    )
    .join("\n");
  await sendEmail({
    provider,
    idempotencyKey: `supplier-response:${view.supplier}:${r.at}`,
    sender: c.EMAIL_FROM,
    to: recipients,
    subject: `${view.supplier} ${r.updates ? "updated" : "confirmed"} your order · delivery ${r.deliveryDate}`,
    text: `${view.supplier} ${r.updates ? "updated" : "confirmed"} your order.\n\nDelivery: ${r.deliveryDate}${r.deliveryWindow ? ` (${r.deliveryWindow})` : ""}\n${changed.length ? `${changed.length} item(s) changed or unavailable.\n` : ""}\n${summary}${r.note ? `\n\nNote: ${r.note}` : ""}\n\nReview it: ${origin}/admin/business?mode=live&tab=purchasing`,
  });
}
