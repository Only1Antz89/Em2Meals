"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { stages, today, type Order, type State } from "@/lib/domain";
import type { MapPoint, VenueSearchResult } from "@/lib/venue-research";
import { AutoSousMarkdown } from "./assistant-display";
import { useOps } from "./ops-context";

const VenueMap = dynamic(() => import("./autosous-venue-map").then((m) => m.VenueMap), {
  ssr: false,
  loading: () => <div className="venue-map-canvas is-loading" />,
});

export type VenueTarget = { kind: "order"; id: string } | { kind: "query"; query: string };

const CLOSED = ["delivered", "cancelled", "declined"];

// Accepted orders (confirmed or further along) with a venue, soonest first.
export function upcomingVenueOrders(s: State, day = today()): Order[] {
  return s.orders
    .filter(
      (o) =>
        !CLOSED.includes(o.status) &&
        stages.indexOf(o.status as (typeof stages)[number]) >= stages.indexOf("confirmed") &&
        o.details.date >= day &&
        (o.details.venue || o.details.address || o.details.postcode),
    )
    .sort((a, b) => a.details.date.localeCompare(b.details.date));
}

// Matches the key the order page uses, so research done in either place
// counts and goes stale when the venue or timing changes.
export function venueResearchKey(o: Order) {
  return JSON.stringify({
    kind: "venue",
    input: {
      name: o.details.venue,
      address: o.details.address,
      date: o.details.date,
      time: o.details.arrivalTime,
      place: o.details.place,
    },
  });
}
export const venueResearched = (o: Order) => o.venueResearch?.key === venueResearchKey(o);

const dayLabel = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

// Researches the next accepted order's venue in the background once per
// browser session, so it's ready when the team needs it.
export function useAutoVenueResearch() {
  const { s, mode, integrations, reload } = useOps();
  const [working, setWorking] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !integrations.gemini) return;
    const limit = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const next = upcomingVenueOrders(s).find(
      (o) => o.details.date <= limit && !venueResearched(o) && (o.details.address || o.details.postcode),
    );
    if (!next) return;
    const key = `autosous-venue-auto:${mode}:${next.id}:${venueResearchKey(next)}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    started.current = true;
    void Promise.resolve()
      .then(() => {
        setWorking(next.id);
        return fetch("/api/admin/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, kind: "venue", id: next.id }),
        });
      })
      .then((r) => (r.ok ? reload() : undefined))
      .catch(() => undefined)
      .finally(() => setWorking(null));
  }, [s, mode, integrations.gemini, reload]);
  return working;
}

// Upcoming accepted orders as chips: researched ones open on the map, others
// offer to research.
export function VenueOffers({
  onPick,
  working,
  active,
  compact = false,
}: {
  onPick: (orderId: string) => void;
  working: string | null;
  active?: string;
  compact?: boolean;
}) {
  const { s } = useOps();
  const orders = upcomingVenueOrders(s).slice(0, compact ? 8 : 4);
  if (!orders.length) return null;
  return (
    <div className={`venue-offers ${compact ? "is-compact" : ""}`}>
      {!compact ? (
        <p className="venue-offers-title">
          <MapPin size={14} /> Venues for your upcoming orders
        </p>
      ) : null}
      <div className="venue-offers-list">
        {orders.map((o) => {
          const done = venueResearched(o);
          return (
            <button
              key={o.id}
              type="button"
              className={`venue-offer ${done ? "is-done" : ""} ${active === o.id ? "is-active" : ""}`}
              onClick={() => onPick(o.id)}
            >
              <strong>{o.details.venue || o.details.postcode || "Venue"}</strong>
              <small>
                {dayLabel(o.details.date)} · {o.reference}
              </small>
              <em>
                {working === o.id ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" /> Researching
                  </>
                ) : done ? (
                  "Research ready"
                ) : (
                  "Research venue"
                )}
              </em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type MapData = { place: MapPoint | null; parking: MapPoint[]; mapError?: string };

export function VenueMode({
  target,
  onTarget,
  onClose,
  working,
}: {
  target: VenueTarget;
  onTarget: (t: VenueTarget) => void;
  onClose: () => void;
  working: string | null;
}) {
  const { s, mode, integrations, reload, href } = useOps();
  const [map, setMap] = useState<MapData>({ place: null, parking: [] });
  const [result, setResult] = useState<VenueSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const order = target.kind === "order" ? s.orders.find((o) => o.id === target.id) : undefined;
  const targetKey = target.kind === "order" ? `order:${target.id}` : `query:${target.query}`;

  const post = useCallback(
    async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
      const r = await fetch(`/api/admin/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, mode }),
      });
      const j = (await r.json().catch(() => ({}))) as T & { error?: string };
      if (!r.ok) throw Error(j.error || `Request failed (${r.status})`);
      return j;
    },
    [mode],
  );

  const researchOrder = useCallback(
    async (id: string, refresh = false) => {
      setResearching(true);
      setError("");
      try {
        await post("research", { kind: "venue", id, refresh });
        await reload();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setResearching(false);
      }
    },
    [post, reload],
  );

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError("");
      setFocus(null);
      try {
        if (target.kind === "order") {
          setResult(null);
          setMap(await post<MapData>("autosous/venue", { orderId: target.id }));
        } else {
          const r = await post<VenueSearchResult & { mapError?: string }>("autosous/venue", {
            query: target.query,
            refresh,
          });
          setResult(r);
          setMap({ place: r.place, parking: r.parking, mapError: r.mapError });
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [post, target],
  );

  // Load the map (and, for a typed venue, the report) when the target
  // changes. Orders without current research are researched now.
  const loadedKey = useRef("");
  useEffect(() => {
    if (loadedKey.current === targetKey) return;
    loadedKey.current = targetKey;
    const researchNow =
      target.kind === "order" && order && !venueResearched(order) && integrations.gemini && working !== order.id;
    void Promise.resolve().then(() => {
      void load();
      if (researchNow && order) void researchOrder(order.id);
    });
  }, [targetKey, load, target.kind, order, integrations.gemini, researchOrder, working]);

  const busy = loading || researching || (order && working === order.id);
  const title =
    target.kind === "order"
      ? order?.details.venue || order?.details.postcode || "Venue"
      : result?.place?.name || target.query;
  const subtitle =
    target.kind === "order" && order
      ? `${order.reference} · ${dayLabel(order.details.date)}${order.details.arrivalTime ? ` · arrive ${order.details.arrivalTime}` : ""} · ${order.details.attendees} guests`
      : map.place?.address || "";

  return (
    <div className={`venue-mode ${collapsed ? "is-collapsed" : ""}`}>
      <VenueMap place={map.place} parking={map.parking} focus={focus} onFocus={setFocus} />
      <div className="venue-mode-top">
        <button type="button" className="venue-back" onClick={onClose}>
          <ArrowLeft size={14} /> Back to chat
        </button>
        <VenueOffers
          compact
          working={working}
          active={target.kind === "order" ? target.id : undefined}
          onPick={(id) => onTarget({ kind: "order", id })}
        />
      </div>
      <aside className="venue-overlay" aria-label="Venue research">
        <header>
          <div>
            <strong>{title}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
          <div className="venue-overlay-actions">
            <button
              type="button"
              aria-label="Refresh research"
              disabled={!!busy || !integrations.gemini}
              onClick={() => (target.kind === "order" ? void researchOrder(target.id, true) : void load(true))}
            >
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              aria-label={collapsed ? "Show the research" : "Show the map"}
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </header>
        <div className="venue-overlay-body">
          {error ? <p className="venue-overlay-error">{error}</p> : null}
          {map.mapError ? <p className="venue-overlay-note">{map.mapError}</p> : null}
          {!map.place && !loading && !map.mapError ? (
            <p className="venue-overlay-note">
              Couldn&apos;t place this venue on the map. Add a postcode to the order for a pin.
            </p>
          ) : null}
          {map.parking.length ? (
            <section className="venue-parking">
              <h4>
                <Car size={13} /> Parking nearby
              </h4>
              <ul>
                {map.parking.map((p, i) => (
                  <li key={`${p.latitude},${p.longitude}`}>
                    <button
                      type="button"
                      className={focus === i ? "is-focused" : ""}
                      onClick={() => setFocus(i)}
                    >
                      <b>P</b>
                      <span>
                        {p.name}
                        {p.address ? <small>{p.address}</small> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {target.kind === "order" ? (
            order?.venueResearch && venueResearched(order) ? (
              <section className="venue-report">
                <AutoSousMarkdown text={order.venueResearch.text} />
                {order.venueResearch.sources.length ? (
                  <div className="autosous-trend-sources">
                    {order.venueResearch.sources.slice(0, 6).map((x) => (
                      <a key={x.url} href={x.url} target="_blank" rel="noreferrer">
                        {x.title} <ExternalLink size={11} />
                      </a>
                    ))}
                  </div>
                ) : null}
                <small className="venue-overlay-note">
                  Researched {new Date(order.venueResearch.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.
                  Public sources: confirm access and parking with the venue.
                </small>
              </section>
            ) : busy ? (
              <p className="venue-overlay-note">
                <RefreshCw size={13} className="animate-spin" /> Reading public records for access, loading and parking…
              </p>
            ) : (
              <p className="venue-overlay-note">
                {integrations.gemini ? "No research yet." : "Venue research needs AutoSous to be set up."}
                {integrations.gemini && order ? (
                  <button type="button" onClick={() => void researchOrder(order.id)}>
                    Research now
                  </button>
                ) : null}
              </p>
            )
          ) : result ? (
            <section className="venue-report">
              <AutoSousMarkdown text={result.text} />
              {result.sources.length ? (
                <div className="autosous-trend-sources">
                  {result.sources.slice(0, 6).map((x) => (
                    <a key={x.url} href={x.url} target="_blank" rel="noreferrer">
                      {x.title} <ExternalLink size={11} />
                    </a>
                  ))}
                </div>
              ) : null}
              <small className="venue-overlay-note">
                Public sources: confirm access, loading and parking with the venue before the day.
              </small>
            </section>
          ) : loading ? (
            <p className="venue-overlay-note">
              <RefreshCw size={13} className="animate-spin" /> Researching {target.query}…
            </p>
          ) : null}
          {order ? (
            <section className="venue-access">
              <h4>Customer access notes</h4>
              <p>{order.details.access || "None supplied."}</p>
              <Link href={href(`orders/${order.id}`)}>
                Open the order <ArrowRight size={12} />
              </Link>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
