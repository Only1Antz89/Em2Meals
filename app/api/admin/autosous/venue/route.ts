import { z } from "zod";
import { owner, sameOrigin, jsonBody, errorResponse, loadState } from "@/lib/server";
import { rateLimit } from "@/lib/upgrade-server";
import { researchVenue, venueMap } from "@/lib/venue-research";

// Venue mode on the AutoSous page.
// - { query }: research any venue or address, with its map and car parks.
// - { orderId }: map and car parks for an order's venue. The written research
//   for orders is saved on the order by /api/admin/research.
export async function POST(req: Request) {
  try {
    if (!(await owner())) return errorResponse(Error("Owner access required"), 403);
    sameOrigin(req);
    const p = z
      .object({
        mode: z.enum(["live", "sample"]),
        query: z.string().trim().min(3, "Enter a venue name or address").max(300).optional(),
        orderId: z.string().max(200).optional(),
        refresh: z.boolean().optional(),
      })
      .refine((v) => v.query || v.orderId, "Enter a venue name or address")
      .parse(await jsonBody(req));
    await rateLimit(req, "venue-search", 40);
    if (p.orderId) {
      const { state } = await loadState(p.mode);
      const o = state.orders.find((x) => x.id === p.orderId);
      if (!o) throw Error("Order not found");
      const place = o.details.place
        ? {
            name: o.details.place.name,
            address: o.details.place.address,
            latitude: o.details.place.latitude,
            longitude: o.details.place.longitude,
            url: o.details.place.mapUrl,
          }
        : null;
      const map = await venueMap(
        [
          [o.details.venue, o.details.address, o.details.postcode].filter(Boolean).join(", "),
          [o.details.address, o.details.postcode].filter(Boolean).join(", "),
          o.details.postcode,
        ],
        place,
      );
      // Car parks found with Google during the order's research come first.
      const saved = (o.venueResearch?.carParks || []).map((c) => ({
        name: c.name,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
        url: c.mapUrl,
      }));
      return Response.json({ ...map, parking: saved.length ? saved : map.parking });
    }
    return Response.json(await researchVenue(p.query!, p.refresh));
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return errorResponse(e, /rate limit/i.test(message) ? 429 : /unavailable|setup required/i.test(message) ? 503 : 400);
  }
}
