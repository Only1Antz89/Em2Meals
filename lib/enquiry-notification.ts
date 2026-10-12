import type { Enquiry } from "./domain";
import { sendEmail } from "./email";
import { config } from "./server";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Tell the owner a website enquiry arrived. Internal notification only: it
// carries the minimum needed to triage (no dietary or guest details) and links
// to the dashboard. Customers are never emailed automatically.
export async function notifyOwnerOfEnquiry({
  reference,
  details,
  origin,
}: {
  reference: string;
  details: Enquiry;
  origin: string;
}) {
  const c = config();
  const recipients = String(c.OWNER_EMAILS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!c.SMTP2GO_API_KEY || !c.EMAIL_FROM || !recipients.length)
    return { status: "not-configured" as const };
  const service = details.service === "corporate" ? "Corporate catering" : "Private dining";
  const rows: [string, string][] = [
    ["Reference", reference],
    ["Name", details.name],
    ["Company", details.company || "—"],
    ["Service", service],
    ["Occasion", details.eventType],
    ["Date", details.date || "To confirm"],
    ["Guests", String(details.attendees)],
    ["Email", details.email],
    ["Phone", details.phone],
  ];
  const link = `${origin}/admin/orders?mode=live`;
  await sendEmail({
    apiKey: c.SMTP2GO_API_KEY,
    sender: c.EMAIL_FROM,
    to: recipients,
    subject: `New enquiry ${reference} · ${service}`,
    text: `A new website enquiry is waiting for review.\n\n${rows
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n")}\n\nReview it: ${link}`,
    html: `<p>A new website enquiry is waiting for review.</p><table>${rows
      .map(
        ([label, value]) =>
          `<tr><th align="left" style="padding:2px 12px 2px 0">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
      )
      .join("")}</table><p><a href="${escapeHtml(link)}">Review the enquiry</a></p>`,
  });
  return { status: "sent" as const };
}
