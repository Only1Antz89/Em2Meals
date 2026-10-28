import { z } from "zod";
import { requireAccess, sameOrigin, jsonBody, errorResponse } from "@/lib/server";
import { searchPlaces } from "@/lib/places";
import { rateLimit } from "@/lib/upgrade-server";
export async function POST(req: Request) {
  try {
    await requireAccess("orders");
    sameOrigin(req);
    const { query } = z
      .object({ query: z.string().trim().min(3).max(200) })
      .parse(await jsonBody(req));
    await rateLimit(req, "owner-places", 100);
    return Response.json({ places: await searchPlaces(query) });
  } catch (e) {
    return errorResponse(e);
  }
}
