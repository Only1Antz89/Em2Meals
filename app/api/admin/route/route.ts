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
        venueDurationMinutes: z.number().int().nonnegative().default(0),
        parkingCost: z.number().int().nonnegative().default(0),
        otherCost: z.number().int().nonnegative().default(0),
        extraCost: z.number().int().nonnegative().optional(),
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
    const destination = `${o.details.address} ${o.details.postcode}`;
    async function calculate(
      origin: string,
      destinationAddress: string,
      departureTime: string,
    ) {
      const result = await googleJSON(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          origin: { address: origin },
          destination: { address: destinationAddress },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          departureTime,
          languageCode: "en-GB",
          units: "IMPERIAL",
        },
        { "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" },
      );
      const route = result.routes?.[0];
      if (!route) throw Error("No driving route found");
      return {
        miles: route.distanceMeters / 1609.344,
        minutes: parseFloat(route.duration) / 60,
      };
    }
    const outbound = await calculate(
      state.settings.kitchen,
      destination,
      p.departure,
    );
    const returnDeparture = new Date(
      Date.parse(p.departure) +
        (outbound.minutes + p.venueDurationMinutes) * 60000,
    ).toISOString();
    const inbound = p.returnTrip
      ? await calculate(destination, state.settings.kitchen, returnDeparture)
      : { miles: 0, minutes: 0 };
    const miles = outbound.miles + inbound.miles;
    const minutes = outbound.minutes + inbound.minutes;
    const at = new Date().toISOString();
    const extraCost =
      p.extraCost ?? Math.round(p.parkingCost + p.otherCost);
    o.route = {
      miles,
      minutes,
      outboundMiles: outbound.miles,
      outboundMinutes: outbound.minutes,
      returnMiles: inbound.miles,
      returnMinutes: inbound.minutes,
      fuelCost: fuelCost(miles, state.settings.mpg, state.settings.fuelPrice),
      source: p.returnTrip
        ? "Google Maps traffic-aware outbound and return routes"
        : "Google Maps traffic-aware route",
      at,
      departure: p.departure,
      returnDeparture: p.returnTrip ? returnDeparture : undefined,
      venueDurationMinutes: p.venueDurationMinutes,
      returnTrip: p.returnTrip,
      parkingCost: p.parkingCost,
      otherCost: p.otherCost,
      extraCost,
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
