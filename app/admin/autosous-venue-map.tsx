"use client";

import { useEffect, useRef, useState } from "react";
import type * as LeafletTypes from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint } from "@/lib/venue-research";

const esc = (t: string) =>
  t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function drawMarkers(
  mod: typeof LeafletTypes,
  m: LeafletTypes.Map,
  group: LeafletTypes.LayerGroup,
  venue: MapPoint | null,
  parks: MapPoint[],
  onPark: (index: number) => void,
) {
  group.clearLayers();
  const markers: LeafletTypes.Marker[] = [];
  const pin = (cls: string, label: string) =>
    mod.divIcon({ className: `venue-pin ${cls}`, html: `<span><i>${label}</i></span>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
  const points: [number, number][] = [];
  if (venue) {
    mod
      .marker([venue.latitude, venue.longitude], { icon: pin("is-venue", "★"), zIndexOffset: 1000 })
      .bindPopup(`<strong>${esc(venue.name)}</strong><br>${esc(venue.address)}`)
      .addTo(group);
    points.push([venue.latitude, venue.longitude]);
  }
  parks.forEach((p, i) => {
    markers.push(
      mod
        .marker([p.latitude, p.longitude], { icon: pin("is-parking", "P") })
        .bindPopup(`<strong>${esc(p.name)}</strong>${p.address ? `<br>${esc(p.address)}` : ""}`)
        .on("click", () => onPark(i))
        .addTo(group),
    );
    points.push([p.latitude, p.longitude]);
  });
  // Keep the pins clear of the research card: on the left on wide screens,
  // across the bottom on phones.
  const size = m.getSize();
  const wide = size.x > 700;
  const padding = {
    paddingTopLeft: (wide ? [450, 110] : [30, 130]) as [number, number],
    paddingBottomRight: (wide ? [50, 50] : [30, Math.round(size.y * 0.55)]) as [number, number],
    maxZoom: 17,
  };
  if (points.length) m.fitBounds(mod.latLngBounds(points.length === 1 ? [points[0], points[0]] : points), padding);
  return markers;
}

// OpenStreetMap view for venue research: the venue, nearby car parks, and a
// way to fly to one. Leaflet is loaded in the browser only.
export function VenueMap({
  place,
  parking,
  focus,
  onFocus,
}: {
  place: MapPoint | null;
  parking: MapPoint[];
  focus?: number | null;
  onFocus?: (index: number | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletTypes.Map | null>(null);
  const L = useRef<typeof LeafletTypes | null>(null);
  const layer = useRef<LeafletTypes.LayerGroup | null>(null);
  const markers = useRef<LeafletTypes.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const focusRef = useRef(onFocus);
  useEffect(() => {
    focusRef.current = onFocus;
  }, [onFocus]);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      L.current = mod;
      map.current = mod
        .map(el.current, { zoomControl: false, attributionControl: true })
        .setView([54.5, -2.5], 6);
      mod.control.zoom({ position: "bottomright" }).addTo(map.current);
      mod
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
        .addTo(map.current);
      layer.current = mod.layerGroup().addTo(map.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !L.current || !map.current || !layer.current) return;
    markers.current = drawMarkers(L.current, map.current, layer.current, place, parking, (i) => focusRef.current?.(i));
  }, [ready, place, parking]);

  useEffect(() => {
    const m = map.current;
    if (focus === null || focus === undefined || !m) return;
    const marker = markers.current[focus];
    if (!marker) return;
    // Centre the car park in the part of the map the card doesn't cover.
    const size = m.getSize();
    const offset = size.x > 700 ? [-210, 0] : [0, Math.round(size.y * 0.25)];
    const point = m.project(marker.getLatLng(), 18).add(offset as [number, number]);
    m.flyTo(m.unproject(point, 18), 18, { duration: 0.6 });
    marker.openPopup();
  }, [focus]);

  return <div ref={el} className="venue-map-canvas" role="region" aria-label="Venue map" />;
}
