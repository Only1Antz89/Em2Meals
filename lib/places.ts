import { config, database } from "./server";
import { googleJSON } from "./integrations";
import { type Place, placeSchema } from "./operations";
import { ensureOperationsTables } from "./upgrade-server";
export async function searchPlaces(query: string): Promise<Place[]> {
  if (!config().GOOGLE_MAPS_API_KEY)
    throw Error("Google Maps setup required. Enter the venue manually.");
  await ensureOperationsTables();
  const key = `places:${query.trim().toLowerCase()}`;
  const cached = await database()
    .prepare("SELECT data FROM research_cache WHERE id=? AND expires_at>?")
    .bind(key, new Date().toISOString())
    .first<{ data: string }>();
  if (cached) return JSON.parse(cached.data);
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
        "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.location,places.addressComponents",
    },
  );
  const places = (result.places || []).map(
    (p: {
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      location: { latitude: number; longitude: number };
      googleMapsUri?: string;
      addressComponents?: {
        longText: string;
        shortText?: string;
        types: string[];
      }[];
    }) =>
      placeSchema.parse({
        id: p.id,
        name: p.displayName?.text || "Venue",
        address: p.formattedAddress || "",
        latitude: p.location.latitude,
        longitude: p.location.longitude,
        mapUrl: p.googleMapsUri || "",
        postcode:
          p.addressComponents?.find((c) => c.types.includes("postal_code"))
            ?.longText || "",
        locality:
          p.addressComponents?.find(
            (c) =>
              c.types.includes("postal_town") || c.types.includes("locality"),
          )?.longText || "",
      }),
  );
  await database()
    .prepare(
      "INSERT INTO research_cache(id,data,expires_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at",
    )
    .bind(
      key,
      JSON.stringify(places),
      new Date(Date.now() + 86400000).toISOString(),
    )
    .run();
  return places;
}
