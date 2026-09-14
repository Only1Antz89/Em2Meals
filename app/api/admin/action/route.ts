import {
  owner,
  command,
  errorResponse,
  jsonBody,
  sameOrigin,
  readEnquiries,
} from "@/lib/server";
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
    if (p.command.type === "order" && p.command.payload.enquiryId) {
      if (p.mode !== "live")
        throw Error("Sample data cannot import live enquiries");
      const enquiry = (await readEnquiries()).find(
        (e) => e.id === p.command.payload.enquiryId,
      );
      if (!enquiry) throw Error("Enquiry not found");
      p.command.payload.details = enquiry.details;
    }
    return Response.json(
      await command(
        p.mode,
        { ...p.command, payload: p.command.payload },
        user.email,
        p.revision,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
