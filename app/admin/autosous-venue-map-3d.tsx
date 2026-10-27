"use client";

import { useEffect, useRef, useState } from "react";
import type * as MapLibre from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapPoint, StreetRule } from "@/lib/venue-research";

// A tilted 3D map for venue research: 3D buildings, the drive from the
// kitchen drawn on, and pins for the kitchen, the venue and car parks. The
// camera flies in and slowly circles the venue until someone touches the map.
// Vector tiles come from OpenFreeMap (OpenStreetMap data, no key needed).
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";

// Used when the vector style can't load: plain OpenStreetMap tiles.
const FALLBACK_STYLE: MapLibre.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#e9ece6" } },
    { id: "osm", type: "raster", source: "osm" },
  ],
};

type Props = {
  place: MapPoint | null;
  parking: MapPoint[];
  base: MapPoint | null;
  path: [number, number][];
  // Street parking rules, drawn along the kerb in green, amber, blue or red.
  kerb?: StreetRule[];
  focus?: number | null;
  onFocus?: (index: number | null) => void;
};

const KERB_COLOUR: Record<StreetRule["tone"], string> = {
  ok: "#2f9e5b",
  limited: "#e0a443",
  loading: "#2b6cb0",
  no: "#d0453a",
};

const esc = (t: string) =>
  t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function pinElement(kind: "venue" | "parking" | "base", label: string) {
  const el = document.createElement("div");
  el.className = `venue-pin3d is-${kind}`;
  el.innerHTML = `<span>${label}</span>`;
  return el;
}

// Space the overlay card covers, so the camera frames what is left.
function padding(map: MapLibre.Map) {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  return w > 700
    ? { top: 110, left: 450, right: 60, bottom: 60 }
    : { top: 130, left: 30, right: 30, bottom: Math.round(h * 0.55) };
}

// Adds 3D buildings when the style has building data but no extrusion layer.
function ensureBuildings(map: MapLibre.Map) {
  const style = map.getStyle();
  if (style.layers?.some((l) => l.type === "fill-extrusion")) return;
  const source = Object.entries(style.sources || {}).find(([, src]) => src.type === "vector")?.[0];
  if (!source) return;
  try {
    map.addLayer({
      id: "em2-buildings-3d",
      type: "fill-extrusion",
      source,
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#e4ddd0",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.85,
      },
    });
  } catch {
    // The style's building layer has another name; flat buildings are fine.
  }
}

export function VenueMap3D({ place, parking, base, path, kerb = [], focus, onFocus }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre.Map | null>(null);
  const lib = useRef<typeof MapLibre | null>(null);
  const markers = useRef<MapLibre.Marker[]>([]);
  const parkMarkers = useRef<MapLibre.Marker[]>([]);
  const orbit = useRef<number>(0);
  const routeAnim = useRef<number>(0);
  const focusRef = useRef(onFocus);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    focusRef.current = onFocus;
  }, [onFocus]);

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stopOrbit = () => cancelAnimationFrame(orbit.current);

  useEffect(() => {
    let cancelled = false;
    void import("maplibre-gl").then((mod) => {
      const ml = (mod as unknown as { default?: typeof MapLibre }).default || mod;
      if (cancelled || !el.current || map.current) return;
      lib.current = ml;
      let fellBack = false;
      const m = new ml.Map({
        container: el.current,
        style: STYLE_URL,
        center: [-1.9, 52.5],
        zoom: 5.4,
        pitch: 45,
        bearing: -12,
        attributionControl: { compact: true },
        maxPitch: 75,
      });
      map.current = m;
      m.addControl(new ml.NavigationControl({ visualizePitch: true }), "bottom-right");
      m.on("error", (e) => {
        // The vector style itself failed to load: switch to raster tiles.
        if (!fellBack && !m.isStyleLoaded() && /style|fetch|load/i.test(String(e.error?.message || ""))) {
          fellBack = true;
          m.setStyle(FALLBACK_STYLE);
        }
      });
      m.on("style.load", () => {
        ensureBuildings(m);
        setReady(true);
      });
      for (const ev of ["mousedown", "touchstart", "wheel"] as const) m.on(ev, stopOrbit);
    });
    return () => {
      cancelled = true;
      stopOrbit();
      cancelAnimationFrame(routeAnim.current);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Pins, the route and the camera.
  useEffect(() => {
    const m = map.current, ml = lib.current;
    if (!ready || !m || !ml) return;
    for (const mk of [...markers.current, ...parkMarkers.current]) mk.remove();
    markers.current = [];
    parkMarkers.current = [];
    if (base)
      markers.current.push(
        new ml.Marker({ element: pinElement("base", "Kitchen"), anchor: "bottom" })
          .setLngLat([base.longitude, base.latitude])
          .setPopup(new ml.Popup({ offset: 24 }).setHTML(`<strong>Your kitchen</strong><br>${esc(base.address || base.name)}`))
          .addTo(m),
      );
    if (place)
      markers.current.push(
        new ml.Marker({ element: pinElement("venue", "★"), anchor: "bottom" })
          .setLngLat([place.longitude, place.latitude])
          .setPopup(new ml.Popup({ offset: 30 }).setHTML(`<strong>${esc(place.name)}</strong><br>${esc(place.address)}`))
          .addTo(m),
      );
    parking.forEach((p, i) => {
      const element = pinElement("parking", "P");
      if ((p.walkMinutes ?? 0) > 6) element.classList.add("is-far");
      element.addEventListener("click", () => focusRef.current?.(i));
      parkMarkers.current.push(
        new ml.Marker({ element, anchor: "bottom" })
          .setLngLat([p.longitude, p.latitude])
          .setPopup(
            new ml.Popup({ offset: 24 }).setHTML(
              `<strong>${esc(p.name)}</strong>${p.walkMinutes ? `<br>${p.walkMinutes} min walk to the venue` : ""}${p.address ? `<br>${esc(p.address)}` : ""}`,
            ),
          )
          .addTo(m),
      );
    });

    // The route, drawn out from the kitchen.
    const line = (coords: [number, number][]): GeoJSON.Feature => ({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    });
    const source = m.getSource("em2-route") as MapLibre.GeoJSONSource | undefined;
    if (!source) {
      m.addSource("em2-route", { type: "geojson", data: line([]) });
      m.addLayer({
        id: "em2-route-casing",
        type: "line",
        source: "em2-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 },
      });
      m.addLayer({
        id: "em2-route",
        type: "line",
        source: "em2-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#c4473c", "line-width": 5 },
      });
    }
    const src = m.getSource("em2-route") as MapLibre.GeoJSONSource;
    cancelAnimationFrame(routeAnim.current);
    if (path.length > 1 && !reducedMotion()) {
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / 1400);
        src.setData(line(path.slice(0, Math.max(2, Math.ceil(path.length * t)))));
        if (t < 1) routeAnim.current = requestAnimationFrame(step);
      };
      routeAnim.current = requestAnimationFrame(step);
    } else src.setData(line(path));

    // Camera: frame the whole drive, then fly in to the venue and circle it.
    stopOrbit();
    const pad = padding(m);
    const points: [number, number][] = [
      ...(base ? [[base.longitude, base.latitude] as [number, number]] : []),
      ...path,
      ...(place ? [[place.longitude, place.latitude] as [number, number]] : []),
    ];
    if (!place) {
      if (base) m.flyTo({ center: [base.longitude, base.latitude], zoom: 13.5, pitch: 50, bearing: -15, padding: pad, duration: 1800 });
      return;
    }
    const venue: [number, number] = [place.longitude, place.latitude];
    // The close-up: the venue and its car parks, tilted to show the buildings.
    const local: [number, number][] = [venue, ...parking.map((p) => [p.longitude, p.latitude] as [number, number])];
    const localBounds = local.reduce((b, p) => b.extend(p), new ml.LngLatBounds(venue, venue));
    const flyIn = () => {
      const camera = m.cameraForBounds(localBounds, { padding: pad, maxZoom: 17, bearing: -25 });
      m.flyTo({
        center: camera?.center || venue,
        zoom: Math.min(17, Math.max(15.2, (camera?.zoom ?? 16.4) - 0.2)),
        pitch: 62,
        bearing: -25,
        duration: reducedMotion() ? 0 : 2600,
        essential: true,
      });
    };
    if (points.length > 1) {
      const bounds = points.reduce((b, p) => b.extend(p), new ml.LngLatBounds(points[0], points[0]));
      m.fitBounds(bounds, { padding: pad, pitch: 40, bearing: -10, duration: reducedMotion() ? 0 : 1600, maxZoom: 15 });
      m.once("moveend", () => window.setTimeout(flyIn, reducedMotion() ? 0 : 1100));
    } else flyIn();
    if (!reducedMotion()) {
      // Start circling once the fly-in has settled.
      const startOrbit = () => {
        let last = performance.now();
        const spin = (now: number) => {
          m.setBearing(m.getBearing() + ((now - last) / 1000) * 4);
          last = now;
          orbit.current = requestAnimationFrame(spin);
        };
        orbit.current = requestAnimationFrame(spin);
      };
      const onSettle = () => {
        if (m.getPitch() > 58) {
          m.off("moveend", onSettle);
          startOrbit();
        }
      };
      m.on("moveend", onSettle);
      return () => {
        m.off("moveend", onSettle);
        stopOrbit();
      };
    }
  }, [ready, place, parking, base, path]);

  // Street parking rules along the kerb, under the route line.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: kerb
        .filter((r) => r.path.length > 1)
        .map((r) => ({
          type: "Feature",
          properties: {
            colour: KERB_COLOUR[r.tone],
            // Each side drawn along its own kerb.
            offset: r.side === "left side" ? -5 : r.side === "right side" ? 5 : 0,
          },
          geometry: { type: "LineString", coordinates: r.path },
        })),
    };
    const src = m.getSource("em2-kerb") as MapLibre.GeoJSONSource | undefined;
    if (src) src.setData(data);
    else {
      m.addSource("em2-kerb", { type: "geojson", data });
      m.addLayer(
        {
          id: "em2-kerb",
          type: "line",
          source: "em2-kerb",
          minzoom: 14,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ["get", "colour"], "line-width": 5, "line-opacity": 0.85, "line-offset": ["get", "offset"] },
        },
        m.getLayer("em2-route-casing") ? "em2-route-casing" : undefined,
      );
    }
  }, [ready, kerb]);

  // Fly to a car park chosen in the card.
  useEffect(() => {
    const m = map.current;
    const marker = focus === null || focus === undefined ? null : parkMarkers.current[focus];
    if (!m || !marker) return;
    stopOrbit();
    m.flyTo({ center: marker.getLngLat(), zoom: 17.5, pitch: 55, padding: padding(m), duration: 1200 });
    marker.togglePopup();
  }, [focus]);

  return <div ref={el} className="venue-map-canvas" role="region" aria-label="3D venue map" />;
}
