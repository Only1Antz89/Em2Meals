"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form-controls";
import type { Place } from "@/lib/operations";

type GoogleMap = object;
type GoogleMapsRuntime = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: {
        center: { lat: number; lng: number };
        zoom: number;
        mapId: string;
        mapTypeControl: boolean;
        streetViewControl: boolean;
      },
    ) => GoogleMap;
    Marker: new (options: {
      map: GoogleMap;
      position: { lat: number; lng: number };
      title: string;
    }) => object;
  };
};

let mapsLoader: Promise<GoogleMapsRuntime> | undefined;

function loadGoogleMaps(apiKey: string) {
  const scope = window as Window & {
    google?: GoogleMapsRuntime;
    __em2GoogleMapsReady?: () => void;
  };
  const runtime = scope.google;
  if (typeof runtime?.maps?.Map === "function") return Promise.resolve(runtime);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-em2-google-maps="true"]',
    );
    const finish = () => {
      const google = scope.google;
      if (typeof google?.maps?.Map === "function") resolve(google);
      else reject(Error("Google Maps did not load."));
    };
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => reject(Error("Google Maps could not be loaded.")),
        { once: true },
      );
      return;
    }
    scope.__em2GoogleMapsReady = finish;
    const script = document.createElement("script");
    script.dataset.em2GoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=__em2GoogleMapsReady`;
    script.async = true;
    script.addEventListener(
      "error",
      () => reject(Error("Google Maps could not be loaded.")),
      { once: true },
    );
    document.head.appendChild(script);
  });
  return mapsLoader;
}

function VenueMap({ place }: { place: Place }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !container.current) return;
    let active = true;
    const position = { lat: place.latitude, lng: place.longitude };
    loadGoogleMaps(apiKey)
      .then((google) => {
        if (!active || !container.current) return;
        const map = new google.maps.Map(container.current, {
          center: position,
          zoom: 15,
          mapId: "DEMO_MAP_ID",
          mapTypeControl: false,
          streetViewControl: false,
        });
        new google.maps.Marker({
          map,
          position,
          title: place.name,
        });
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Google Maps unavailable.",
          );
      });
    return () => {
      active = false;
    };
  }, [apiKey, place]);

  if (!apiKey) return null;
  return (
    <div className="venue-map-panel">
      <div
        ref={container}
        className="venue-map"
        role="region"
        aria-label={`Map showing ${place.name}`}
      />
      <div className="venue-map-caption">
        <span>
          <b>{place.name}</b>
          {place.address}
        </span>
        {place.mapUrl && (
          <a href={place.mapUrl} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
        )}
      </div>
      {error && <p role="status">{error}</p>}
    </div>
  );
}

export function VenueSearch({
  onSelect,
  admin = false,
}: {
  onSelect: (place: Place) => void;
  admin?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Place[]>([]),
    [selected, setSelected] = useState<Place | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function search() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(admin ? "/api/admin/places" : "/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const j = (await r.json()) as { places: Place[]; error?: string };
      if (!r.ok) throw Error(j.error || "Venue search failed");
      setPlaces(j.places);
      if (!j.places.length)
        setError(
          "No venues found. Try another name or enter the address manually.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="venue-search wide">
      <div className="inline-actions">
        <Field
          label="Search for a public venue"
          value={query}
          onChange={setQuery}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || query.trim().length < 3}
          onClick={search}
        >
          {busy ? "Searching…" : "Find venue"}
        </Button>
      </div>
      {error && <p role="status">{error}</p>}
      <div className="place-results">
        {places.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => {
              onSelect(p);
              setSelected(p);
              setPlaces([]);
            }}
          >
            <b>{p.name}</b>
            <span>{p.address}</span>
          </button>
        ))}
      </div>
      {selected && <VenueMap place={selected} />}
    </div>
  );
}
