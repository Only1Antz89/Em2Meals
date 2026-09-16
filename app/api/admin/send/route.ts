import {
  owner,
  sameOrigin,
  jsonBody,
  errorResponse,
  config,
  database,
  loadState,
  commitStateAndDelivery,
} from "@/lib/server";
import { draftCurrent } from "@/lib/operations";
import { EmailDeliveryUncertain, sendEmail } from "@/lib/email";
import { z } from "zod";
export async function POST(req: Request) {
  let locked: string | undefined;
  try {
    if (!(await owner()))
      return errorResponse(Error("Owner access required"), 403);
    sameOrigin(req);
    const { draftId, mode } = z
      .object({
        draftId: z.string(),
        confirm: z.literal(true),
        mode: z.enum(["live", "sample"]).default("live"),
      })
      .parse(await jsonBody(req));
    const c = config();
    if (!c.SMTP2GO_API_KEY || !c.EMAIL_FROM)
      throw Error("Email setup required. The draft remains saved.");
    if (mode !== "live") throw Error("Sending disabled in sample workspace");
    const { state, revision } = await loadState("live"),
      db = database();
    const draft = state.drafts.find((d) => d.id === draftId);
    if (!draft) throw Error("Live draft not found");
    const delivery = await db
      .prepare("SELECT status,provider_id FROM email_deliveries WHERE id=?")
      .bind(draftId)
      .first<{ status: string; provider_id: string }>();
    if (delivery?.status === "sent")
      return Response.json({ status: "sent", id: delivery.provider_id });
    if (delivery)
      throw Error(
        "This email has a pending, failed or uncertain send. Check delivery before preparing a replacement.",
      );
    if (
      draft.superseded ||
      draft.purchaseConfirmed ||
      !draftCurrent(state, draft)
    )
      throw Error(
        "This request needs updating. Review the current purchasing proposal before sending.",
      );
    const at = new Date().toISOString();
    // Claim a short workspace lease only if the reviewed revision is still current.
    const claim = await db
      .prepare(
        "INSERT INTO workspace_send_locks(workspace_id,draft_id,expires_at) SELECT 'live',?,? WHERE EXISTS (SELECT 1 FROM workspaces WHERE id='live' AND revision=?) ON CONFLICT(workspace_id) DO UPDATE SET draft_id=excluded.draft_id,expires_at=excluded.expires_at WHERE workspace_send_locks.expires_at<?",
      )
      .bind(draftId, new Date(Date.now() + 120000).toISOString(), revision, at)
      .run();
    if (claim.meta.changes !== 1)
      throw Error(
        "Workspace changed or another email is sending. Reload and review again.",
      );
    locked = draftId;
    const sendClaim = await db
      .prepare(
        "INSERT OR IGNORE INTO email_deliveries(id,status,updated_at) VALUES(?,'sending',?)",
      )
      .bind(draftId, at)
      .run();
    if (sendClaim.meta.changes !== 1)
      throw Error("Email already claimed; reload its delivery status");
    try {
      const result = await sendEmail({
        apiKey: c.SMTP2GO_API_KEY,
        sender: c.EMAIL_FROM,
        to: [draft.to],
        subject: draft.subject,
        text: draft.body,
      });
      draft.sentAt = at;
      let nextRevision: number;
      try {
        nextRevision = await commitStateAndDelivery(
          "live",
          state,
          revision,
          { id: draftId, status: "sent", providerId: result.id },
          draftId,
        );
      } catch {
        throw new EmailDeliveryUncertain(
          "Provider accepted the email but its database commit was interrupted",
        );
      }
      return Response.json({
        status: "sent",
        id: result.id,
        state,
        revision: nextRevision,
      });
    } catch (error) {
      if (!(error instanceof EmailDeliveryUncertain)) {
        await db
          .prepare(
            "UPDATE email_deliveries SET status='failed',error=?,updated_at=? WHERE id=?",
          )
          .bind((error as Error).message, at, draftId)
          .run();
        throw error;
      }
      await db
        .prepare(
          "UPDATE email_deliveries SET status='uncertain',error=?,updated_at=? WHERE id=?",
        )
        .bind("Network response uncertain", at, draftId)
        .run();
      throw Error(
        "Delivery status uncertain. Check the email provider before preparing another request.",
      );
    }
  } catch (e) {
    return errorResponse(e);
  } finally {
    if (locked)
      await database()
        .prepare(
          "DELETE FROM workspace_send_locks WHERE workspace_id='live' AND draft_id=?",
        )
        .bind(locked)
        .run();
  }
}
