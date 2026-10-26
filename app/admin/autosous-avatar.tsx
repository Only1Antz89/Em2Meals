"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  ExternalLink,
  EyeOff,
  Lightbulb,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import type { AutoSousAlert } from "@/lib/autosous-alerts";
import type { FoodSafetyItem } from "@/lib/food-safety";
import { AutoSousIcon } from "./autosous-icon";
import { AutoSousMarkdown } from "./assistant-display";
import type { Mascot, MascotMood } from "./autosous-mascot";
import { useOps } from "./ops-context";

type Feed = {
  alerts: AutoSousAlert[];
  foodSafety: { news: FoodSafetyItem[]; checkedAt: string; error?: string };
};
type Trends = { text: string; sources: { title: string; url: string }[]; season: string; generatedAt: string };
type Tab = "attention" | "safety" | "ideas";

const HIDE_KEY = "autosous-hidden-alerts";
const SEEN_KEY = "autosous-seen-alerts";
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
  const [tab, setTab] = useState<Tab>("attention");
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
  const badge = unseen + (newNews ? 1 : 0);
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
  const toggle = () => {
    const next = !open;
    setOpen(next);
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

  return (
    <div className={`autosous-avatar ${open ? "is-open" : ""} mood-${mood}`}>
      <section
        className="autosous-avatar-panel"
        aria-label="AutoSous alerts"
        aria-hidden={!open}
        inert={!open}
      >
        <header>
          <div>
            <strong>AutoSous</strong>
            <span>
              {attention.length
                ? `${attention.length} thing${attention.length === 1 ? "" : "s"} to look at`
                : "All caught up"}
            </span>
          </div>
          <button type="button" aria-label="Close AutoSous alerts" onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </header>
        <nav className="autosous-avatar-tabs" role="tablist">
          {(
            [
              ["attention", `Needs attention${attention.length ? ` · ${attention.length}` : ""}`],
              ["safety", `Food safety${news.length ? ` · ${news.length}` : ""}`],
              ["ideas", "Ideas & trends"],
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
          {error ? <p className="autosous-avatar-empty">{error}</p> : null}
          {!feed && !error ? (
            <p className="autosous-avatar-empty">
              <RefreshCw size={14} className="animate-spin" /> Checking your kitchen…
            </p>
          ) : null}
          {feed && tab === "attention" ? (
            attention.length ? (
              <ul className="autosous-alert-list">
                {attention.slice(0, 40).map((a) => (
                  <li key={a.id} className={`severity-${a.severity}`}>
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
                  </li>
                ))}
              </ul>
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
                  stock. They are listed under Needs attention.
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
        onClick={toggle}
      >
        <canvas ref={canvas} aria-hidden="true" style={{ display: webgl ? undefined : "none" }} />
        {!webgl ? <AutoSousIcon size={34} /> : null}
        {badge ? <span className="autosous-avatar-badge">{badge > 9 ? "9+" : badge}</span> : null}
      </button>
    </div>
  );
}
