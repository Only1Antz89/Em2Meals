import { visibleState } from "@/lib/access";
import { VENUE_SYSTEM } from "@/lib/venue-research";
import {
  requireAccess,
  sameOrigin,
  jsonBody,
  loadState,
  errorResponse,
} from "@/lib/server";
import { gemini } from "@/lib/integrations";
import { chatSchema, runAutoSous } from "@/lib/autosous";
import { rateLimit } from "@/lib/upgrade-server";
import { z } from "zod";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireAccess("view");
    sameOrigin(req);
    const p = z
      .object({
        mode: z.enum(["sample", "live"]),
        question: z.string().min(1).max(2000).optional(),
        messages: chatSchema.optional(),
        venueOrderId: z.string().optional(),
      })
      .parse(await jsonBody(req));
    await rateLimit(req, "assistant", 120);
    const s = visibleState((await loadState(p.mode)).state, user.role);
    if (p.venueOrderId) {
      const o = s.orders.find((x) => x.id === p.venueOrderId);
      if (!o) throw Error("Order not found");
      const venueAddress = [o.details.address, o.details.postcode]
        .filter(Boolean)
        .join(", ");
      const orderContext = [
        `Venue Name: ${o.details.venue}`,
        venueAddress ? `Address / Location: ${venueAddress}` : "",
        o.details.date ? `Event Date: ${o.details.date}` : "",
        o.details.arrivalTime ? `Estimated Arrival: ${o.details.arrivalTime}` : "",
        `Order Reference: ${o.reference}`,
        o.details.access ? `Known Booking Access Notes: ${o.details.access}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const prompt = `Conduct catering delivery recon and access research for this booking:\n${orderContext}\n\nSearch public web records for this venue and provide structured, operational guidance for the catering and delivery team.`;

      const r = await gemini(prompt, VENUE_SYSTEM, undefined, true);
      return Response.json({
        ...r,
        venue: o.details.venue,
        address: o.details.address,
        postcode: o.details.postcode,
        reference: o.reference,
      });
    }
    const messages = p.messages || (p.question ? [{ role: "user" as const, text: p.question }] : null);
    if (!messages) throw Error("Ask AutoSous a question");
    return Response.json(await runAutoSous(s, messages, user.email), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const status =
      (typeof e === "object" &&
      e !== null &&
      "status" in e &&
      typeof (e as { status: unknown }).status === "number"
        ? (e as { status: number }).status
        : undefined) ||
      (e instanceof Error && /rate limit/i.test(e.message)
        ? 429
        : e instanceof Error && /(unavailable|setup required)/i.test(e.message)
          ? 503
          : 400);
    return errorResponse(e, status);
  }
}
