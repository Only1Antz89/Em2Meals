import {
  owner,
  sameOrigin,
  jsonBody,
  errorResponse,
  config,
  database,
  loadState,
} from "@/lib/server";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    if (!(await owner()))
      return errorResponse(Error("Owner access required"), 403);
    sameOrigin(req);
    const { draftId, confirm } = z
      .object({ draftId: z.string(), confirm: z.literal(true) })
      .parse(await jsonBody(req));
    if (!confirm) throw Error("Review required");
    const c = config();
    if (!c.RESEND_API_KEY || !c.EMAIL_FROM)
      throw Error("Email setup required. The draft remains saved.");
    const { state } = await loadState("live");
    const draft = state.drafts.find((d) => d.id === draftId);
    if (!draft) throw Error("Live draft not found");
    const db = database();
    const at = new Date().toISOString();
    const claim = await db
      .prepare(
        "INSERT OR IGNORE INTO email_deliveries(id,status,updated_at) VALUES(?,'sending',?)",
      )
      .bind(draftId, at)
      .run();
    if (claim.meta.changes !== 1) {
      const existing = await db
        .prepare("SELECT status,provider_id FROM email_deliveries WHERE id=?")
        .bind(draftId)
        .first<any>();
      if (existing?.status === "sent")
        return Response.json({ status: "sent", id: existing.provider_id });
      throw Error(
        "This email has a pending or uncertain send. Check delivery before creating another draft.",
      );
    }
    let r: Response;
    try {
      r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `em2-${draftId}`,
        },
        body: JSON.stringify({
          from: c.EMAIL_FROM,
          to: [draft.to],
          subject: draft.subject,
          text: draft.body,
        }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      await db
        .prepare(
          "UPDATE email_deliveries SET status='uncertain',error=?,updated_at=? WHERE id=?",
        )
        .bind("Network response uncertain", at, draftId)
        .run();
      throw Error(
        "Delivery status is uncertain. Check the email provider before retrying.",
      );
    }
    const result: any = await r.json();
    if (!r.ok) {
      await db
        .prepare(
          "UPDATE email_deliveries SET status='failed',error=?,updated_at=? WHERE id=?",
        )
        .bind(`Provider response ${r.status}`, at, draftId)
        .run();
      throw Error(
        `Email provider rejected the request (${r.status}). The draft is saved.`,
      );
    }
    await db
      .prepare(
        "UPDATE email_deliveries SET status='sent',provider_id=?,updated_at=? WHERE id=?",
      )
      .bind(result.id, at, draftId)
      .run();
    return Response.json({ status: "sent", id: result.id });
  } catch (e) {
    return errorResponse(e);
  }
}
