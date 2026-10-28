import { z } from "zod";
import { owner, sameOrigin, jsonBody, errorResponse } from "@/lib/server";
import { rateLimit } from "@/lib/upgrade-server";
import { lookupVehicle } from "@/lib/dvla";
export async function POST(req: Request) {
  try {
    if (!(await owner()))
      return errorResponse(Error("Owner access required"), 403);
    sameOrigin(req);
    const { registration } = z
      .object({ registration: z.string().trim().min(2).max(20) })
      .parse(await jsonBody(req));
    await rateLimit(req, "owner-vehicle-lookup", 60);
    return Response.json({ vehicle: await lookupVehicle(registration) });
  } catch (e) {
    return errorResponse(e);
  }
}
