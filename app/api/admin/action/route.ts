import {
  owner,
  command,
  errorResponse,
  jsonBody,
  sameOrigin,
  readEnquiries,
  loadState,
  deleteRawEnquiries,
} from "@/lib/server";
import { linkedEnquiryIds } from "@/lib/privacy";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    const user = await owner();
    if (!user) return errorResponse(Error("Owner access required"), 403);
    sameOrigin(req);
    const p = z
      .object({
        mode: z.enum(["live", "sample"]),
        revision: z.number().int(),
        command: z.object({
          id: z.string().uuid(),
          type: z.string(),
          payload: z.any(),
        }),
      })
      .parse(await jsonBody(req));
    if (p.command.type === "analysis") throw Error("Use the analysis endpoint");
    if (p.command.type === "order" && p.command.payload?.enquiryId) {
      if (p.mode !== "live")
        throw Error("Sample data cannot import live enquiries");
      const enquiry = (await readEnquiries()).find(
        (e) => e.id === p.command.payload.enquiryId,
      );
      if (!enquiry) throw Error("Enquiry not found");
      p.command.payload.details = enquiry.details;
    }
    // Erasure and enquiry deletion also remove the original website
    // submission, once the workspace change has been committed.
    const privacy =
      p.mode === "live" &&
      ["customer-erase", "order-delete"].includes(p.command.type)
        ? linkedEnquiryIds(
            (await loadState("live")).state,
            p.command.type,
            p.command.payload,
          )
        : null;
    const result = await command(
      p.mode,
      { ...p.command, payload: p.command.payload },
      user.email,
      p.revision,
    );
    if (privacy) await deleteRawEnquiries(privacy);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
