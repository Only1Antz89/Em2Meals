import {
  owner,
  sameOrigin,
  jsonBody,
  errorResponse,
  config,
} from "@/lib/server";
import { googleJSON } from "@/lib/integrations";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    if (!(await owner()))
      return errorResponse(Error("Owner access required"), 403);
    sameOrigin(req);
    const { query } = z
      .object({ query: z.string().min(3).max(300) })
      .parse(await jsonBody(req));
    if (!config().GOOGLE_MAPS_API_KEY)
      throw Error("Google Maps setup required");
    const result = await googleJSON(
      "https://places.googleapis.com/v1/places:searchText",
      {
        textQuery: query,
        regionCode: "GB",
        languageCode: "en-GB",
        maxResultCount: 5,
      },
      {
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
      },
    );
    return Response.json({ places: result.places || [] });
  } catch (e) {
    return errorResponse(e);
  }
}
