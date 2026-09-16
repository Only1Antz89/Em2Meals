import { z } from "zod";
import {
  owner,
  sameOrigin,
  jsonBody,
  errorResponse,
  database,
  loadState,
  commitStateAndDelivery,
} from "@/lib/server";
export async function POST(req: Request) {
  try {
    const user = await owner();
    if (!user) return errorResponse(Error("Owner access required"), 403);
    sameOrigin(req);
    const p = z
      .object({
        mode: z.literal("live"),
        draftId: z.string(),
        outcome: z.enum(["sent", "not-sent"]),
        note: z.string().min(5).max(1000),
      })
      .parse(await jsonBody(req));
    const { state, revision } = await loadState("live"),
      db = database();
    const d = state.drafts.find((d) => d.id === p.draftId);
    if (!d) throw Error("Draft not found");
    const at = new Date().toISOString();
    const lock = await db
      .prepare(
        "SELECT draft_id FROM workspace_send_locks WHERE workspace_id='live' AND expires_at>?",
      )
      .bind(at)
      .first();
    if (lock)
      throw Error("An email is currently sending. Wait for its result.");
    const delivery = await db
      .prepare("SELECT status FROM email_deliveries WHERE id=?")
      .bind(d.id)
      .first<{ status: string }>();
    if (
      !delivery ||
      !["sending", "uncertain", "failed"].includes(delivery.status)
    )
      throw Error("No unresolved delivery to reconcile");
    d.deliveryStatus = p.outcome === "sent" ? "sent" : "failed";
    if (p.outcome === "sent") d.sentAt = at;
    state.audit.push({
      at,
      actor: user.email,
      action: `delivery-verified:${p.outcome}:${p.note}`,
      target: d.id,
    });
    const next = await commitStateAndDelivery("live", state, revision, {
      id: d.id,
      status: d.deliveryStatus,
      error: `Owner verification: ${p.note}`,
    });
    return Response.json({ state, revision: next });
  } catch (e) {
    return errorResponse(e);
  }
}
