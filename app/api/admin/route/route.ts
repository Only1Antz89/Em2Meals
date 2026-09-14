import {
  owner,
  sameOrigin,
  jsonBody,
  loadState,
  commitState,
  errorResponse,
  config,
} from "@/lib/server";
import { googleJSON } from "@/lib/integrations";
import { fuelCost } from "@/lib/domain";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    const user = await owner();
    if (!user) return errorResponse(Error("Owner access required"), 403);
    sameOrigin(req);
    const p = z
      .object({
        mode: z.enum(["sample", "live"]),
        orderId: z.string(),
        departure: z.string().datetime(),
        returnTrip: z.boolean(),
        extraCost: z.number().int().nonnegative(),
      })
      .parse(await jsonBody(req));
    if (!config().GOOGLE_MAPS_API_KEY)
      throw Error(
        "Google Maps setup required. You can save a manual estimate.",
      );
    const { state, revision } = await loadState(p.mode);
    const o = state.orders.find((x) => x.id === p.orderId);
    if (!o) throw Error("Order not found");
    if (!state.settings.kitchen || !o.details.address)
      throw Error("Enter the kitchen and venue addresses first");
    if (Date.parse(p.departure) < Date.now())
      throw Error("Choose a future departure time");
    const result = await googleJSON(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        origin: { address: state.settings.kitchen },
        destination: { address: `${o.details.address} ${o.details.postcode}` },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        departureTime: p.departure,
        languageCode: "en-GB",
        units: "IMPERIAL",
      },
      { "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" },
    );
    const route = result.routes?.[0];
    if (!route) throw Error("No driving route found");
    const factor = p.returnTrip ? 2 : 1;
    const miles = (route.distanceMeters / 1609.344) * factor;
    const at = new Date().toISOString();
    o.route = {
      miles,
      minutes: (parseFloat(route.duration) / 60) * factor,
      fuelCost: fuelCost(miles, state.settings.mpg, state.settings.fuelPrice),
      source: p.returnTrip
        ? "Google Maps outbound route × 2 (return estimate)"
        : "Google Maps traffic-aware route",
      at,
      departure: p.departure,
      returnTrip: p.returnTrip,
      extraCost: p.extraCost,
    };
    state.audit.push({ at, actor: user.email, action: "route", target: o.id });
    return Response.json({
      state,
      revision: await commitState(p.mode, state, revision),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
