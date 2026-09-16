import { crmCustomers } from "@/lib/crm";
import { EmailDeliveryUncertain, sendEmail } from "@/lib/email";
import { config, database, errorResponse, loadState } from "@/lib/server";

const londonClock = (date = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export async function runDigest(req: Request, now = new Date()) {
  try {
    const c = config();
    if (!c.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${c.CRON_SECRET}`)
      return errorResponse(Error("Digest access denied"), 403);
    const clock = londonClock(now);
    if (clock.hour < 8)
      return Response.json({ status: "before-window", date: clock.date });
    if (!c.SMTP2GO_API_KEY || !c.EMAIL_FROM)
      return errorResponse(Error("SMTP2GO email setup required"), 503);
    const recipients = String(c.OWNER_EMAILS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (!recipients.length)
      return errorResponse(Error("No owner email recipients configured"), 503);

    const { state } = await loadState("live");
    const attention = crmCustomers(state, clock.date).filter(
      (customer) => customer.needsAttention,
    );
    if (!attention.length)
      return Response.json({ status: "nothing-due", date: clock.date });

    const origin = new URL(req.url).origin;
    const lines = attention.map((item) => {
      const name = item.customer.company || item.customer.name;
      const due = item.nextFollowUp?.dueDate
        ? ` · follow-up ${item.nextFollowUp.dueDate}`
        : "";
      return `${name} — ${item.attentionReason}${due}\n${origin}/admin/crm/client/${encodeURIComponent(item.customer.id)}?mode=live`;
    });
    const text = `Em2 Catering Platform CRM — ${attention.length} relationship${attention.length === 1 ? "" : "s"} need attention\n\n${lines.join("\n\n")}`;
    const html = `<h1>Em2 Catering Platform CRM</h1><p>${attention.length} relationship${attention.length === 1 ? "" : "s"} need attention.</p><ul>${attention
      .map((item) => {
        const name = escapeHtml(item.customer.company || item.customer.name);
        const link = `${origin}/admin/crm/client/${encodeURIComponent(item.customer.id)}?mode=live`;
        return `<li><strong>${name}</strong> — ${escapeHtml(item.attentionReason)} <a href="${link}">View client</a></li>`;
      })
      .join("")}</ul>`;
    const db = database();
    const results: { recipient: string; status: string }[] = [];

    for (const recipient of recipients) {
      const id = `${clock.date}:${recipient}`;
      const now = new Date().toISOString();
      const prior = await db
        .prepare("SELECT status FROM crm_digest_deliveries WHERE id=?")
        .bind(id)
        .first<{ status: string }>();
      if (prior && prior.status !== "failed") {
        results.push({ recipient, status: prior.status });
        continue;
      }
      const claim = prior
        ? await db
            .prepare(
              "UPDATE crm_digest_deliveries SET status='sending',error=NULL,attempts=attempts+1,updated_at=? WHERE id=? AND status='failed'",
            )
            .bind(now, id)
            .run()
        : await db
            .prepare(
              "INSERT OR IGNORE INTO crm_digest_deliveries(id,date,recipient,status,attempts,updated_at) VALUES(?,?,?,'sending',1,?)",
            )
            .bind(id, clock.date, recipient, now)
            .run();
      if (claim.meta.changes !== 1) {
        results.push({ recipient, status: "already-claimed" });
        continue;
      }
      try {
        const sent = await sendEmail({
          apiKey: c.SMTP2GO_API_KEY,
          sender: c.EMAIL_FROM,
          to: [recipient],
          subject: `Em2 Catering Platform CRM: ${attention.length} relationship${attention.length === 1 ? "" : "s"} need attention`,
          text,
          html,
        });
        await db
          .prepare(
            "UPDATE crm_digest_deliveries SET status='sent',provider_id=?,updated_at=? WHERE id=?",
          )
          .bind(sent.id, now, id)
          .run();
        results.push({ recipient, status: "sent" });
      } catch (error) {
        const uncertain = error instanceof EmailDeliveryUncertain;
        await db
          .prepare(
            "UPDATE crm_digest_deliveries SET status=?,error=?,updated_at=? WHERE id=?",
          )
          .bind(uncertain ? "uncertain" : "failed", (error as Error).message, now, id)
          .run();
        results.push({ recipient, status: uncertain ? "uncertain" : "failed" });
      }
    }
    const failed = results.some((result) => result.status === "failed");
    return Response.json(
      { status: failed ? "partial" : "processed", date: clock.date, results },
      { status: failed ? 502 : 200 },
    );
  } catch (error) {
    return errorResponse(error, 500);
  }
}
