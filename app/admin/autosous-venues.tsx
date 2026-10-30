"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Car,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Gauge,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { stages, today, type Order, type State } from "@/lib/domain";
import type { BuildingDetails, Journey, MapPoint, StreetRule, VenueSearchResult } from "@/lib/venue-research";
import { AutoSousMarkdown } from "./assistant-display";
import { useOps } from "./ops-context";
import { VenueLookupProgress } from "./venue-lookup-progress";

const VenueMap3D = dynamic(() => import("./autosous-venue-map-3d").then((m) => m.VenueMap3D), {
  ssr: false,
  loading: () => <div className="venue-map-canvas is-loading" />,
});
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
          signal: AbortSignal.timeout(90000),
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

type MapData = {
  place: MapPoint | null;
  parking: MapPoint[];
  base?: MapPoint | null;
  journey?: Journey | null;
  building?: BuildingDetails | null;
  streetRules?: StreetRule[];
  mapError?: string;
  parkingError?: string;
};

const clock = (minutesOfDay: number) => {
  const m = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const duration = (minutes: number) => {
  const m = Math.max(1, Math.round(minutes));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
};
const TRAFFIC = {
  light: { label: "Light traffic", tone: "is-light" },
  moderate: { label: "Moderate traffic", tone: "is-moderate" },
  heavy: { label: "Heavy traffic", tone: "is-heavy" },
} as const;
// Time to unload and check in, added before the arrival time.
const BUFFER_MINUTES = 15;

function JourneyCard({ data, order }: { data: MapData; order?: Order }) {
  const { href } = useOps();
  const j = data.journey;
  if (!data.place) return null;
  if (!data.base)
    return (
      <section className="venue-journey is-empty">
        <p className="venue-overlay-note">
          <Link href={href("settings")}>Add your kitchen address in Settings</Link> to see the drive, ETA and traffic.
        </p>
      </section>
    );
  if (!j)
    return (
      <section className="venue-journey is-empty">
        <p className="venue-overlay-note">The drive from your kitchen couldn&apos;t be worked out right now.</p>
      </section>
    );
  const arrive = order?.details.arrivalTime;
  const [h, m] = (arrive || "").split(":").map(Number);
  const leaveBy = arrive && Number.isFinite(h) ? clock(h * 60 + m - j.minutes - BUFFER_MINUTES) : "";
  const traffic = j.traffic ? TRAFFIC[j.traffic] : null;
  return (
    <section className="venue-journey">
      <div className="venue-journey-route">
        <span className="venue-journey-dot is-base" />
        <div>
          <small>From your kitchen</small>
          <b>{data.base.name || data.base.address}</b>
        </div>
      </div>
      <div className="venue-journey-line" aria-hidden="true" />
      <div className="venue-journey-route">
        <span className="venue-journey-dot is-venue" />
        <div>
          <small>To the venue</small>
          <b>{data.place.name}</b>
        </div>
      </div>
      <div className="venue-journey-stats">
        <div>
          <strong>{duration(j.minutes)}</strong>
          <small>{Math.round(j.miles * 10) / 10} miles</small>
        </div>
        {leaveBy ? (
          <div>
            <strong>{leaveBy}</strong>
            <small>leave by, to arrive {arrive}</small>
          </div>
        ) : (
          <div>
            <strong>{clock(new Date().getHours() * 60 + new Date().getMinutes() + j.minutes)}</strong>
            <small>ETA if you leave now</small>
          </div>
        )}
      </div>
      <p className={`venue-traffic ${traffic?.tone || "is-unknown"}`}>
        <Gauge size={13} />
        {traffic
          ? `${traffic.label} right now${j.typicalMinutes ? ` (usually ${duration(j.typicalMinutes)})` : ""}`
          : "Typical journey time. Live traffic needs Google Maps set up."}
      </p>
    </section>
  );
}

// Same as WALKABLE_MINUTES on the server.
const WALKABLE = 6;
const RULE_TONE: Record<StreetRule["tone"], string> = {
  ok: "You can park",
  limited: "Restricted",
  loading: "Loading",
  no: "No parking",
};
const metres = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${Math.round(m / 100) / 10} km`);

// Where to park: car parks by walking time to the door, then what the kerb
// allows on the streets right by the venue.
function ParkingCard({
  parking,
  rules,
  focus,
  onFocus,
  hasPlace,
  error,
}: {
  error?: string;
  parking: MapPoint[];
  rules: StreetRule[];
  focus: number | null;
  onFocus: (i: number) => void;
  hasPlace: boolean;
}) {
  if (!hasPlace) return null;
  const close = parking.filter((p) => (p.walkMinutes ?? 99) <= WALKABLE).length;
  const canStop = rules.filter((r) => r.tone === "ok" || r.tone === "loading");
  return (
    <section className="venue-parking">
      <h4>
        <Car size={13} /> Where to park
      </h4>
      {parking.length ? (
        <>
          <p className="venue-overlay-note">
            {close
              ? `${close} car park${close === 1 ? "" : "s"} within a ${WALKABLE} minute walk. Nearest first.`
              : `Nothing mapped within a ${WALKABLE} minute walk. ${canStop.length ? "Check the street rules below." : "Ask the venue about a loading bay or drop-off point."}`}
          </p>
          <ul>
            {parking.map((p, i) => {
              const near = (p.walkMinutes ?? 99) <= WALKABLE;
              const notes = p.notes?.length ? p.notes : p.address ? [p.address] : [];
              return (
                <li key={`${p.latitude},${p.longitude}`}>
                  <button type="button" className={`${focus === i ? "is-focused" : ""} ${near ? "is-near" : "is-far"}`} onClick={() => onFocus(i)}>
                    <b>P</b>
                    <span>
                      <span className="venue-parking-name">
                        {p.name}
                        {p.walkMinutes ? (
                          <em>
                            {p.walkMinutes} min walk · {metres(p.walkMetres || 0)}
                          </em>
                        ) : null}
                      </span>
                      {notes.map((n) => (
                        <small key={n} className={/may not fit a van/.test(n) ? "is-warning" : ""}>
                          {n}
                        </small>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="venue-overlay-note">{error || "No public car parks mapped within a 15 minute walk."}</p>
      )}
      {rules.length ? (
        <div className="venue-kerb">
          <h5>Street parking by the venue</h5>
          <ul>
            {rules.map((r) => (
              <li key={`${r.street}|${r.side}|${r.rule}|${r.detail}`} className={`is-${r.tone}`}>
                <span className="venue-kerb-dot" title={RULE_TONE[r.tone]} />
                <span>
                  <b>
                    {r.street}
                    {r.side ? <small> ({r.side})</small> : null}
                  </b>
                  <span>
                    {r.rule}
                    {r.detail ? `: ${r.detail}` : ""}
                  </span>
                </span>
                <em>{metres(r.metres)}</em>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <small className="venue-overlay-note">
        Walk times are estimates. Street rules come from OpenStreetMap and can be out of date or missing, so always check the signs.
      </small>
    </section>
  );
}

function BuildingCard({ b }: { b: BuildingDetails | null | undefined }) {
  if (!b) return null;
  const facts = [
    b.kind ? ["Type", b.kind] : null,
    b.levels !== null ? ["Floors", String(b.levels)] : b.heightMetres !== null ? ["Height", `${b.heightMetres} m`] : null,
    b.wheelchair ? ["Wheelchair access", b.wheelchair === "yes" ? "Yes" : b.wheelchair === "limited" ? "Limited" : b.wheelchair === "no" ? "No" : b.wheelchair] : null,
    b.entrances ? ["Entrances mapped", `${b.entrances}${b.stepFreeEntrances ? `, ${b.stepFreeEntrances} step-free` : ""}`] : null,
    b.serviceEntrances ? ["Service or delivery doors", String(b.serviceEntrances)] : null,
    b.openingHours ? ["Opening hours", b.openingHours] : null,
  ].filter((x): x is [string, string] => !!x);
  if (!facts.length && !b.name) return null;
  return (
    <section className="venue-building">
      <h4>
        <Building2 size={13} /> The building{b.name ? `: ${b.name}` : ""}
      </h4>
      <dl>
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {b.website ? (
        <a href={b.website} target="_blank" rel="noreferrer">
          Venue website <ExternalLink size={11} />
        </a>
      ) : null}
      <small className="venue-overlay-note">From OpenStreetMap. Check loading and lift access with the venue.</small>
    </section>
  );
}

// Each target owns its results, so a slow previous response cannot replace
// the current venue or trigger its completion alert.
export function VenueMode(props: {
  target: VenueTarget | null;
  onTarget: (t: VenueTarget) => void;
  onClose: () => void;
  working: string | null;
}) {
  const key = !props.target ? "idle" : props.target.kind === "order" ? `order:${props.target.id}` : `query:${props.target.query}`;
  return <VenueView key={key} {...props} />;
}

function VenueView({
  target,
  onTarget,
  onClose,
  working,
}: {
  target: VenueTarget | null;
  onTarget: (t: VenueTarget) => void;
  onClose: () => void;
  working: string | null;
}) {
  const { s, integrations, reload, href, mode } = useOps();
  const [map, setMap] = useState<MapData>({ place: null, parking: [] });
  const [result, setResult] = useState<VenueSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [webgl] = useState(() => {
    try {
      const probe = document.createElement("canvas");
      return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
    } catch {
      return false;
    }
  });
  const order = target?.kind === "order" ? s.orders.find((o) => o.id === target.id) : undefined;
  const targetKey = !target ? "idle" : target.kind === "order" ? `order:${target.id}` : `query:${target.query}`;

  const requests = useRef(new Set<AbortController>());
  useEffect(() => {
    const active = requests.current;
    return () => { active.forEach((controller) => controller.abort()); active.clear(); };
  }, []);

  const post = useCallback(
    async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
      const controller = new AbortController();
      requests.current.add(controller);
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]);
      try {
        const r = await fetch(`/api/admin/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, mode }),
          signal,
        });
        const j = (await r.json().catch(() => ({}))) as T & { error?: string };
        signal.throwIfAborted();
        if (!r.ok) throw Error(j.error || `Request failed (${r.status})`);
        return j;
      } catch (e) {
        if (e instanceof Error && e.name === "TimeoutError") {
          throw Error("Venue lookup took too long. Use Refresh research to retry, or try a more specific address or postcode.");
        }
        throw e;
      } finally {
        requests.current.delete(controller);
      }
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
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
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
        if (!target) {
          setResult(null);
          const r = await post<{ base: MapPoint | null }>("autosous/venue", { base: true });
          setMap({ place: null, parking: [], base: r.base });
        } else if (target.kind === "order") {
          setResult(null);
          setMap(await post<MapData>("autosous/venue", { orderId: target.id }));
        } else {
          const r = await post<VenueSearchResult & { mapError?: string }>("autosous/venue", {
            query: target.query,
            refresh,
          });
          setResult(r);
          setMap(r);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
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
    let cancelled = false;
    const researchNow =
      target?.kind === "order" && order && !venueResearched(order) && integrations.gemini && working !== order.id;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      loadedKey.current = targetKey;
      void load();
      if (researchNow && order) void researchOrder(order.id);
    });
    return () => { cancelled = true; };
  }, [targetKey, load, target, order, integrations.gemini, researchOrder, working]);

  const busy = loading || researching || (order && working === order.id);
  const title = !target
    ? "Where are we cooking?"
    : target.kind === "order"
      ? order?.details.venue || order?.details.postcode || "Venue"
      : map.place?.name || target.query;
  const subtitle = !target
    ? "Pick an upcoming order, or type a venue in the box below."
    : target.kind === "order" && order
      ? `${order.reference} · ${dayLabel(order.details.date)}${order.details.arrivalTime ? ` · arrive ${order.details.arrivalTime}` : ""} · ${order.details.attendees} guests`
      : map.place?.address || "";
  const path = map.journey?.path || [];

  return (
    <div className={`venue-mode ${collapsed ? "is-collapsed" : ""} ${target ? "" : "is-idle"}`}>
      {webgl ? (
        <VenueMap3D
          place={map.place}
          parking={map.parking}
          base={map.base || null}
          path={path}
          kerb={map.streetRules || []}
          focus={focus}
          onFocus={setFocus}
        />
      ) : (
        <VenueMap place={map.place} parking={map.parking} focus={focus} onFocus={setFocus} />
      )}
      <div className="venue-mode-top">
        <button type="button" className="venue-back" onClick={onClose}>
          <ArrowLeft size={14} /> Back to chat
        </button>
        <VenueOffers
          compact
          working={working}
          active={target?.kind === "order" ? target.id : undefined}
          onPick={(id) => onTarget({ kind: "order", id })}
        />
      </div>
      <aside className="venue-overlay" aria-label="Venue details">
        <header>
          <div>
            <strong>{title}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </div>
          {target ? (
            <div className="venue-overlay-actions">
              <button
                type="button"
                aria-label="Refresh research"
                disabled={!!busy || !integrations.gemini}
                onClick={() =>
                  // For an order, also reload the map, in case a map lookup failed.
                  target.kind === "order" ? void Promise.all([researchOrder(target.id, true), load()]) : void load(true)
                }
              >
                <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                aria-label={collapsed ? "Show the details" : "Show the map"}
                onClick={() => setCollapsed((c) => !c)}
              >
                {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          ) : null}
        </header>
        <div className="venue-overlay-body">
          <VenueLookupProgress
            busy={!!busy}
            ready={!!target && !error && !!(result || map.place || (order && venueResearched(order)))}
            label={title}
            phase={!target ? "Finding your kitchen…" : loading && researching ? "Finding the venue and researching access…" : loading ? "Finding the venue, parking and journey…" : "Researching access, loading and parking…"}
          />
          {error ? <p role="alert" className="venue-overlay-error">{error}</p> : null}
          {!target ? (
            <>
              {upcomingVenueOrders(s).length ? null : (
                <p className="venue-overlay-note">No accepted orders coming up. Search any venue, address or postcode below.</p>
              )}
              {map.base ? (
                <p className="venue-overlay-note">
                  <MapPin size={13} /> Your kitchen: {map.base.address || map.base.name}
                </p>
              ) : !loading ? (
                <p className="venue-overlay-note">
                  <Link href={href("settings")}>Add your kitchen address in Settings</Link> to see drive times from it.
                </p>
              ) : null}
            </>
          ) : (
            <>
              {map.mapError ? <p className="venue-overlay-note">{map.mapError}</p> : null}
              {!map.place && !loading && !map.mapError ? (
                <p className="venue-overlay-note">
                  Couldn&apos;t place this venue on the map. Add a postcode to the order for a pin.
                </p>
              ) : null}
              {loading && !map.place ? (
                <p className="venue-overlay-note">
                  <RefreshCw size={13} className="animate-spin" /> Finding the venue and the drive from your kitchen…
                </p>
              ) : null}
              <JourneyCard data={map} order={order} />
              <ParkingCard
                parking={map.parking}
                rules={map.streetRules || []}
                focus={focus}
                onFocus={setFocus}
                hasPlace={!!map.place}
                error={map.parkingError}
              />
              <BuildingCard b={map.building} />
              {target.kind === "order" ? (
                order?.venueResearch && venueResearched(order) ? (
                  <section className="venue-report">
                    <h4>
                      <FileText size={13} /> Access, loading and parking research
                    </h4>
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
                  <h4>
                    <FileText size={13} /> Access, loading and parking research
                  </h4>
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
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
