"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  ChefHat,
  Clock,
  ExternalLink,
  EyeOff,
  Leaf,
  Lightbulb,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Truck,
  X,
} from "lucide-react";
import type { AutoSousAlert } from "@/lib/autosous-alerts";
import type { Briefing, BriefingService } from "@/lib/autosous-briefing";
import { SwipeCard } from "./autosous-swipe";
import type { FoodSafetyItem } from "@/lib/food-safety";
import { AutoSousIcon } from "./autosous-icon";
import { AutoSousMarkdown } from "./assistant-display";
import type { Mascot, MascotMood } from "./autosous-mascot";
import { useOps } from "./ops-context";
import { VENUE_NOTICE, openVenueNotice, watchVenue, type VenueNotice } from "./venue-notices";

type Feed = {
  alerts: AutoSousAlert[];
  briefing: Briefing;
  foodSafety: { news: FoodSafetyItem[]; checkedAt: string; error?: string };
};
type Trends = { text: string; sources: { title: string; url: string }[]; season: string; generatedAt: string };
type Tab = "briefing" | "attention" | "safety" | "ideas";

const HIDE_KEY = "autosous-hidden-alerts";
const SEEN_KEY = "autosous-seen-alerts";
const HINT_KEY = "autosous-swipe-learned";
const today = () => new Date().toISOString().slice(0, 10);
function readMap(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}
function writeMap(key: string, value: Record<string, string>) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function moodFor(alerts: AutoSousAlert[]): MascotMood {
  if (alerts.some((a) => a.severity === "urgent")) return "urgent";
  if (alerts.some((a) => a.severity === "warning")) return "warning";
  if (alerts.some((a) => a.kind !== "idea")) return "info";
  return "calm";
}

export function AutoSousAvatar() {
  const { s, mode, href, integrations } = useOps();
  const [open, setOpen] = useState(false);
  const [venueNotice, setVenueNotice] = useState<VenueNotice | null>(null);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("briefing");
  const [learned, setLearned] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  const buttonSwipe = useRef<{ y: number; swiped: boolean } | null>(null);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState("");
  // Rendered only after the workspace loads in the browser, so local
  // storage can be read during the first render. Hidden alerts come back the
  // next day.
  const [hidden, setHidden] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(readMap(HIDE_KEY)).filter(([, until]) => until >= today()),
    ),
  );
  const [seen, setSeen] = useState<Record<string, string>>(() => readMap(SEEN_KEY));
  const [trends, setTrends] = useState<Trends | null>(null);
  const [trendsState, setTrendsState] = useState<"idle" | "loading" | "error">("idle");
  const [trendsError, setTrendsError] = useState("");
  const [webgl, setWebgl] = useState(() => {
    try {
      const probe = document.createElement("canvas");
      return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
    } catch {
      return false;
    }
  });
  const canvas = useRef<HTMLCanvasElement>(null);
  const mascot = useRef<Mascot | null>(null);
  const previousUrgent = useRef(0);

  useEffect(() => {
    const receive = (event: Event) => {
      const notice = (event as CustomEvent<VenueNotice>).detail;
      if (!notice || notice.mode !== mode) return;
      setVenueNotice((current) => notice.kind === "dismiss" ? (current?.id === notice.id ? null : current) : notice);
      if (notice.kind === "ready") mascot.current?.wave();
    };
    window.addEventListener(VENUE_NOTICE, receive);
    return () => window.removeEventListener(VENUE_NOTICE, receive);
  }, [mode]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/autosous?mode=${mode}`, { cache: "no-store" });
      const j = (await r.json()) as Feed & { error?: string };
      if (!r.ok) throw Error(j.error || "AutoSous alerts are unavailable");
      setFeed(j);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [mode]);

  // Refresh when the workspace changes (debounced), every five minutes, and
  // when the tab regains focus.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 1200);
    return () => clearTimeout(timer);
  }, [s, load]);
  useEffect(() => {
    const interval = setInterval(() => void load(), 5 * 60 * 1000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [load]);

  // Three.js character, loaded on demand. Falls back to the flat icon.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !webgl) return;
    let cancelled = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void Promise.all([import("three"), import("./autosous-mascot")])
      .then(([THREE, { createMascot }]) => {
        if (cancelled) return;
        mascot.current = createMascot(el, THREE, { reducedMotion });
      })
      .catch(() => setWebgl(false));
    const move = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      mascot.current?.pointer(
        (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2),
        (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2),
      );
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener("pointermove", move);
      mascot.current?.destroy();
      mascot.current = null;
    };
  }, [webgl]);

  const alerts = (feed?.alerts || []).filter((a) => !hidden[a.id]);
  const attention = alerts.filter((a) => a.kind !== "idea");
  const ideas = alerts.filter((a) => a.kind === "idea");
  const news = feed?.foodSafety.news || [];
  const unseen = attention.filter((a) => a.severity !== "info" && !seen[a.id]).length;
  const newNews = news.filter((n) => !seen[`news-${n.id}`]).length;
  const badge = unseen + (newNews ? 1 : 0) + (venueNotice?.kind === "ready" || venueNotice?.kind === "failed" ? 1 : 0);
  const mood = moodFor(attention);

  useEffect(() => {
    mascot.current?.setMood(mood);
    const urgent = attention.filter((a) => a.severity === "urgent").length;
    if (urgent > previousUrgent.current) mascot.current?.wave();
    previousUrgent.current = urgent;
  }, [mood, attention]);
  useEffect(() => mascot.current?.setOpen(open), [open]);

  const markSeen = useCallback(
    (ids: string[]) => {
      const next = { ...seen };
      for (const id of ids) next[id] ||= today();
      setSeen(next);
      writeMap(SEEN_KEY, next);
    },
    [seen],
  );
  const show = (next: boolean) => {
    if (next === open) return;
    setOpen(next);
    setDrag(0);
    mascot.current?.wave();
    if (next && feed) {
      markSeen([
        ...attention.map((a) => a.id),
        ...news.map((n) => `news-${n.id}`),
      ]);
    }
  };
  const hide = (id: string) => {
    const next = { ...hidden, [id]: today() };
    setHidden(next);
    writeMap(HIDE_KEY, next);
  };
  const to = (path: string) => {
    const [page, query] = path.split("?");
    return href(page) + (query ? `&${query}` : "");
  };
  const askHref = (question: string) =>
    `${href("assistant")}&ask=${encodeURIComponent(question)}`;
  const go = (url: string) => {
    setOpen(false);
    router.push(url);
  };
  const swiped = () => {
    if (learned) return;
    setLearned(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {}
  };

  const loadTrends = async (refresh = false) => {
    setTrendsState("loading");
    setTrendsError("");
    try {
      const r = await fetch("/api/admin/autosous/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, refresh }),
      });
      const j = (await r.json()) as Trends & { error?: string };
      if (!r.ok) throw Error(j.error || "Trends are unavailable");
      setTrends(j);
      setTrendsState("idle");
    } catch (e) {
      setTrendsError((e as Error).message);
      setTrendsState("error");
    }
  };

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  const icon = (a: AutoSousAlert) =>
    a.kind === "recall" || a.kind === "food-safety" ? (
      <ShieldAlert size={15} />
    ) : a.severity === "info" ? (
      <BellRing size={15} />
    ) : (
      <AlertTriangle size={15} />
    );

  const alertCard = (a: AutoSousAlert) => (
    <SwipeCard
      key={a.id}
      className={`severity-${a.severity}`}
      onOpen={a.path ? () => go(to(a.path!)) : a.ask && integrations.gemini ? () => go(askHref(a.ask!)) : undefined}
      openLabel={a.path ? "Open" : "Ask AutoSous"}
      onDismiss={() => hide(a.id)}
      onSwiped={swiped}
    >
      <span className="autosous-alert-icon-wrap">{icon(a)}</span>
      <div>
        <strong>{a.title}</strong>
        <p>{a.detail}</p>
        <div className="autosous-alert-actions">
          {a.path ? (
            <Link href={to(a.path)} onClick={() => setOpen(false)}>
              Open <ArrowRight size={12} />
            </Link>
          ) : null}
          {a.ask && integrations.gemini ? (
            <Link href={askHref(a.ask)} onClick={() => setOpen(false)}>
              <MessageCircle size={12} /> Ask AutoSous
            </Link>
          ) : null}
          <button type="button" onClick={() => hide(a.id)}>
            <EyeOff size={12} /> Hide today
          </button>
        </div>
      </div>
    </SwipeCard>
  );

  const serviceCard = (x: BriefingService, compact: boolean) => {
    const live = x.alerts.filter((a) => !hidden[a.id]);
    const worst = live.some((a) => a.severity === "urgent") ? "urgent" : live.some((a) => a.severity === "warning") ? "warning" : "fine";
    return (
      <SwipeCard key={x.id} className={`autosous-service is-${worst}`} onOpen={() => go(to(x.path))} openLabel="Open order" onSwiped={swiped}>
        <div className="autosous-service-time">
          {compact ? (
            <>
              <b>{new Date(`${x.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</b>
              <small>{x.date.slice(8)}</small>
            </>
          ) : (
            <>
              <Clock size={12} />
              <b>{x.time || "TBC"}</b>
            </>
          )}
        </div>
        <div className="autosous-service-main">
          <Link href={to(x.path)} onClick={() => setOpen(false)} className="autosous-service-title">
            {x.title}
          </Link>
          <small>
            {x.reference} · {x.guests} guests · {x.status}
          </small>
          {!compact ? (
            <span className="autosous-service-progress" aria-label={`Progress: ${Math.round(x.progress * 100)}%`}>
              <i style={{ width: `${Math.max(6, x.progress * 100)}%` }} />
            </span>
          ) : null}
          <p className="autosous-service-next">
            <ArrowRight size={12} /> {x.nextStep}
          </p>
          {!compact ? (
            <Link
              className="autosous-service-venue"
              href={`${href("assistant")}&venue=${encodeURIComponent(x.id)}`}
              onClick={() => setOpen(false)}
            >
              <MapPin size={11} /> Venue &amp; parking
            </Link>
          ) : null}
          {live.length ? (
            <ul className="autosous-service-alerts">
              {live.slice(0, 3).map((a) => (
                <li key={a.id} className={`severity-${a.severity}`}>
                  {a.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </SwipeCard>
    );
  };

  const briefing = feed?.briefing;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const hint = !learned ? (
    <p className="autosous-swipe-hint">Swipe a card right to open it, or left to hide it for today.</p>
  ) : null;

  const venuePopup = venueNotice ? (
    <section className={`autosous-venue-popup ${open ? "is-inline" : ""}`} aria-label="AutoSous venue update">
      <button type="button" className="autosous-venue-popup-close" aria-label="Dismiss venue update" onClick={() => setVenueNotice(null)}><X size={14} /></button>
      <div role="status">
        <strong>{venueNotice.kind === "ready" ? "Your venue details are ready" : venueNotice.kind === "failed" ? "I couldn’t finish this venue lookup" : venueNotice.kind === "waiting" ? "I’ll let you know when it’s ready" : "This is taking a little longer"}</strong>
        <p>{venueNotice.kind === "ready" ? `I’ve finished gathering information for ${venueNotice.label}.` : venueNotice.kind === "failed" ? `I couldn’t gather the details for ${venueNotice.label}. Return to the venue to try again.` : venueNotice.kind === "waiting" ? `I’m gathering information for ${venueNotice.label}. You can return to chat while I finish.` : `I’m still gathering information for ${venueNotice.label}. Want me to pop up here when it’s ready?`}</p>
      </div>
      {venueNotice.kind === "slow" ? (
        <button type="button" className="autosous-venue-popup-action" onClick={() => {
          watchVenue({ id: venueNotice.id, mode, enabled: true });
          setVenueNotice({ ...venueNotice, kind: "waiting" });
        }}>Let me know</button>
      ) : venueNotice.kind === "ready" || venueNotice.kind === "failed" ? (
        <button type="button" className="autosous-venue-popup-action" onClick={() => {
          openVenueNotice(venueNotice);
          setVenueNotice(null);
          setOpen(false);
        }}>{venueNotice.kind === "ready" ? "View venue details" : "Return to venue"} <ArrowRight size={13} /></button>
      ) : null}
    </section>
  ) : null;

  return (
    <div className={`autosous-avatar ${open ? "is-open" : ""} mood-${mood}`}>
      {!open ? venuePopup : null}
      <section
        className="autosous-avatar-panel"
        aria-label="AutoSous"
        aria-hidden={!open}
        inert={!open}
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
      >
        <header
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            dragStart.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragStart.current === null) return;
            setDrag(Math.max(0, e.clientY - dragStart.current));
          }}
          onPointerUp={() => {
            if (dragStart.current === null) return;
            dragStart.current = null;
            if (drag > 70) show(false);
            else setDrag(0);
          }}
          onPointerCancel={() => {
            dragStart.current = null;
            setDrag(0);
          }}
        >
          <span className="autosous-avatar-grab" aria-hidden="true" />
          <div>
            <strong>AutoSous</strong>
            <span>
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <button type="button" aria-label="Close AutoSous" onClick={() => show(false)}>
            <X size={16} />
          </button>
        </header>
        <nav className="autosous-avatar-tabs" role="tablist">
          {(
            [
              ["briefing", "Briefing"],
              ["attention", `Alerts${attention.length ? ` · ${attention.length}` : ""}`],
              ["safety", `Safety${news.length ? ` · ${news.length}` : ""}`],
              ["ideas", "Ideas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? "selected" : ""}
              onClick={() => {
                setTab(value);
                if (value === "ideas" && !trends && trendsState === "idle" && integrations.gemini)
                  void loadTrends();
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="autosous-avatar-body">
          {open ? venuePopup : null}
          {error ? <p className="autosous-avatar-empty">{error}</p> : null}
          {!feed && !error ? (
            <p className="autosous-avatar-empty">
              <RefreshCw size={14} className="animate-spin" /> Checking your kitchen…
            </p>
          ) : null}
          {briefing && tab === "briefing" ? (
            <div className="autosous-brief">
              <p className="autosous-brief-summary">
                <strong>{greeting}, chef.</strong> {briefing.summary}
              </p>
              {hint}
              {briefing.onThePass.filter((a) => !hidden[a.id]).length ? (
                <section>
                  <h4 className="is-urgent">Sort these first</h4>
                  <ul className="autosous-alert-list">
                    {briefing.onThePass.filter((a) => !hidden[a.id]).slice(0, 6).map(alertCard)}
                  </ul>
                </section>
              ) : null}
              {briefing.days.map((d) =>
                d.services.length || d.deliveries.length ? (
                  <section key={d.id}>
                    <h4>{d.label}</h4>
                    {d.services.length ? (
                      <ul className="autosous-alert-list">{d.services.map((x) => serviceCard(x, d.id === "week"))}</ul>
                    ) : null}
                    {d.deliveries.length ? (
                      <ul className="autosous-brief-lines">
                        {d.deliveries.map((l) => (
                          <li key={l.id}>
                            <Truck size={14} />
                            <div>
                              <Link href={to(l.path || "suppliers")} onClick={() => setOpen(false)}>
                                Due in: {l.title}
                              </Link>
                              <small>{l.detail}</small>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ) : null,
              )}
              {briefing.prep && briefing.prep.dishes.length ? (
                <section>
                  <h4>{briefing.prep.label}</h4>
                  <ul className="autosous-prep">
                    {briefing.prep.dishes.map((dish) => (
                      <li key={dish.recipeId}>
                        <ChefHat size={14} />
                        <span>
                          <b>{dish.portions} ×</b> {dish.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {briefing.useFirst.filter((l) => !hidden[l.id]).length ? (
                <section>
                  <h4>Use first</h4>
                  <ul className="autosous-alert-list">
                    {briefing.useFirst
                      .filter((l) => !hidden[l.id])
                      .map((l) => (
                        <SwipeCard
                          key={l.id}
                          className="severity-info"
                          onOpen={() => go(l.ask && integrations.gemini ? askHref(l.ask) : to(l.path || "inventory/storage-expiry"))}
                          openLabel={l.ask && integrations.gemini ? "Get an idea" : "Open"}
                          onDismiss={() => hide(l.id)}
                          onSwiped={swiped}
                        >
                          <span className="autosous-alert-icon-wrap">
                            <Leaf size={15} />
                          </span>
                          <div>
                            <strong>{l.title}</strong>
                            <p>{l.detail}</p>
                            <div className="autosous-alert-actions">
                              <Link href={to(l.path || "inventory/storage-expiry")} onClick={() => setOpen(false)}>
                                Open <ArrowRight size={12} />
                              </Link>
                              {l.ask && integrations.gemini ? (
                                <Link href={askHref(l.ask)} onClick={() => setOpen(false)}>
                                  <MessageCircle size={12} /> Get an idea
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </SwipeCard>
                      ))}
                  </ul>
                </section>
              ) : null}
              {briefing.keepAnEye.filter((a) => !hidden[a.id]).length ? (
                <section>
                  <h4>Keep an eye on</h4>
                  <ul className="autosous-alert-list">
                    {briefing.keepAnEye.filter((a) => !hidden[a.id]).map(alertCard)}
                  </ul>
                </section>
              ) : null}
              {attention.length ? (
                <button type="button" className="autosous-brief-more" onClick={() => setTab("attention")}>
                  See all {attention.length} alerts <ArrowRight size={12} />
                </button>
              ) : null}
            </div>
          ) : null}
          {feed && tab === "attention" ? (
            attention.length ? (
              <>
                {hint}
                <ul className="autosous-alert-list">{attention.slice(0, 40).map(alertCard)}</ul>
              </>
            ) : (
              <p className="autosous-avatar-empty">
                Nothing needs your attention right now. I&apos;ll let you know
                when stock is going out of date, an order needs updating or a
                message comes in.
              </p>
            )
          ) : null}
          {feed && tab === "safety" ? (
            <>
              {attention.filter((a) => a.kind === "food-safety").length ? (
                <p className="autosous-avatar-warning">
                  <ShieldAlert size={14} /> Some alerts mention ingredients you
                  stock. They are listed under Alerts.
                </p>
              ) : null}
              {news.length ? (
                <ul className="autosous-news-list">
                  {news.map((n) => (
                    <li key={n.id}>
                      <a href={n.url} target="_blank" rel="noreferrer">
                        <strong>{n.title}</strong>
                        <ExternalLink size={12} />
                      </a>
                      <small>
                        {n.kind === "allergy" ? "Allergy alert" : "Food alert"}
                        {n.published ? ` · ${new Date(n.published).toLocaleDateString("en-GB")}` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="autosous-avatar-empty">
                  {feed.foodSafety.error || "No new Food Standards Agency alerts this week."}
                </p>
              )}
              <p className="autosous-avatar-note">
                From the Food Standards Agency. Checked{" "}
                {new Date(feed.foodSafety.checkedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.
              </p>
            </>
          ) : null}
          {feed && tab === "ideas" ? (
            <>
              {ideas.map((a) => (
                <div key={a.id} className="autosous-idea">
                  <Lightbulb size={15} />
                  <div>
                    <strong>{a.title}</strong>
                    <p>{a.detail}</p>
                    {a.ask && integrations.gemini ? (
                      <Link href={askHref(a.ask)} onClick={() => setOpen(false)}>
                        Ask AutoSous for recipes <ArrowRight size={12} />
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
              <div className="autosous-trends">
                <div className="autosous-trends-head">
                  <strong>This week in food & catering</strong>
                  {trends ? (
                    <button type="button" disabled={trendsState === "loading"} onClick={() => void loadTrends(true)}>
                      <RefreshCw size={12} className={trendsState === "loading" ? "animate-spin" : ""} /> Refresh
                    </button>
                  ) : null}
                </div>
                {!integrations.gemini ? (
                  <p className="autosous-avatar-empty">Trends need AutoSous to be set up.</p>
                ) : trendsState === "loading" && !trends ? (
                  <p className="autosous-avatar-empty">
                    <RefreshCw size={14} className="animate-spin" /> Reading this week&apos;s food news…
                  </p>
                ) : trendsState === "error" ? (
                  <p className="autosous-avatar-empty">
                    {trendsError}{" "}
                    <button type="button" onClick={() => void loadTrends()}>
                      Try again
                    </button>
                  </p>
                ) : trends ? (
                  <>
                    <AutoSousMarkdown text={trends.text} />
                    {trends.sources.length ? (
                      <div className="autosous-trend-sources">
                        {trends.sources.slice(0, 5).map((x) => (
                          <a key={x.url} href={x.url} target="_blank" rel="noreferrer">
                            {x.title} <ExternalLink size={11} />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
        <footer>
          <Link href={href("assistant")} onClick={() => setOpen(false)}>
            <MessageCircle size={14} /> Chat with AutoSous
          </Link>
        </footer>
      </section>
      <button
        type="button"
        className="autosous-avatar-button"
        aria-expanded={open}
        aria-label={`AutoSous${badge ? `, ${badge} new alert${badge === 1 ? "" : "s"}` : ""}`}
        title="Tap or swipe up for your briefing"
        onPointerDown={(e) => {
          buttonSwipe.current = { y: e.clientY, swiped: false };
        }}
        onPointerMove={(e) => {
          const b = buttonSwipe.current;
          if (!b || b.swiped) return;
          const dy = e.clientY - b.y;
          if (dy < -24) {
            b.swiped = true;
            show(true);
          } else if (dy > 24) {
            b.swiped = true;
            show(false);
          }
        }}
        onClick={() => {
          const swipedNow = buttonSwipe.current?.swiped;
          buttonSwipe.current = null;
          if (!swipedNow) show(!open);
        }}
      >
        <canvas ref={canvas} aria-hidden="true" style={{ display: webgl ? undefined : "none" }} />
        {!webgl ? <AutoSousIcon size={34} /> : null}
        {badge ? <span className="autosous-avatar-badge">{badge > 9 ? "9+" : badge}</span> : null}
      </button>
    </div>
  );
}
