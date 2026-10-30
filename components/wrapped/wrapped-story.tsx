"use client";
// Client-facing "Wrapped" story: full-bleed slides that advance on their own,
// with tap, swipe and keyboard controls. Prints as one slide per page.
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Link2,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import type { WrappedStory } from "@/lib/wrapped";
import { CustomerIdentity } from "@/components/customer-identity";
import styles from "./wrapped-story.module.css";

const SLIDE_MS = 7000;
const nf = new Intl.NumberFormat("en-GB");
const dateLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  });

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
}

// Counts up from zero while its slide is showing.
function Count({
  value,
  active,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  active: boolean;
  decimals?: number;
  suffix?: string;
}) {
  const reduced = useReducedMotion();
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active || reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const next = Math.min(1, (now - start) / 1200);
      setT(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setT(0);
    };
  }, [active, reduced]);
  const shown = active && !reduced ? value * (1 - Math.pow(1 - t, 3)) : value;
  const text =
    decimals > 0
      ? shown.toLocaleString("en-GB", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : nf.format(Math.round(shown));
  return (
    <>
      {text}
      {suffix}
    </>
  );
}

type Slide = {
  key: string;
  theme: string;
  // Light backgrounds need dark controls.
  light?: boolean;
  label: string;
  body: (active: boolean) => ReactNode;
};

function change(
  now: number | null,
  before: number | null | undefined,
  lowerIsBetter: boolean,
) {
  if (now === null || before === null || before === undefined || !before)
    return null;
  const diff = lowerIsBetter
    ? Math.round(((before - now) / before) * 100)
    : Math.round((now - before) * 10) / 10;
  if (!diff) return null;
  return { better: diff > 0, size: Math.abs(diff) };
}

function slidesFor(story: WrappedStory): Slide[] {
  const slides: Slide[] = [];
  const firstName = story.customer;
  slides.push({
    key: "intro",
    theme: styles.themeIntro,
    label: "Introduction",
    body: () => (
      <div className={styles.introBody}>
        <p className={styles.kicker}>{story.business}</p>
        <CustomerIdentity name={story.customer} logoUrl={story.customerLogoUrl} />
        <h1 className={styles.giant}>
          Your
          <br />
          {story.periodLabel}
          <br />
          <em>Wrapped</em>
        </h1>
        <p className={styles.lede}>
          Made for <strong>{firstName}</strong>. A look back at what we cooked,
          what you loved, and how little went to waste.
        </p>
        <p className={styles.hint}>Tap to start</p>
      </div>
    ),
  });
  slides.push({
    key: "numbers",
    theme: styles.themeCoral,
    label: "The numbers",
    body: (active) => (
      <div className={styles.stack}>
        <p className={styles.kicker}>Together we fed</p>
        <p className={styles.huge}>
          <Count value={story.guests} active={active} />
        </p>
        <p className={styles.unit}>guests</p>
        <div className={styles.pills}>
          <span>
            <strong>
              <Count value={story.occasions} active={active} />
            </strong>{" "}
            {story.occasions === 1 ? "occasion" : "occasions"}
          </span>
          <span>
            <strong>
              <Count value={story.portions} active={active} />
            </strong>{" "}
            portions
          </span>
          <span>
            <strong>
              <Count value={story.dishCount} active={active} />
            </strong>{" "}
            {story.dishCount === 1 ? "dish" : "different dishes"}
          </span>
        </div>
      </div>
    ),
  });
  if (story.topDishes.length) {
    const max = story.topDishes[0].portions || 1;
    slides.push({
      key: "dishes",
      theme: styles.themeGreen,
      label: "Top dishes",
      body: () => (
        <div className={styles.stack}>
          <p className={styles.kicker}>Your number one dish was</p>
          <h2 className={styles.big}>{story.topDishes[0].name}</h2>
          <ol className={styles.chart}>
            {story.topDishes.map((d, i) => (
              <li
                key={d.name}
                style={
                  {
                    "--w": `${Math.max(8, (d.portions / max) * 100)}%`,
                    "--d": `${i * 120}ms`,
                  } as CSSProperties
                }
              >
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.barName}>{d.name}</span>
                <span className={styles.bar} />
                <span className={styles.barValue}>{nf.format(d.portions)}</span>
              </li>
            ))}
          </ol>
        </div>
      ),
    });
  }
  if (story.enjoyedRate !== null) {
    const rate = story.enjoyedRate;
    const delta = change(rate, story.previous?.enjoyedRate, false);
    slides.push({
      key: "enjoyed",
      theme: styles.themePurple,
      label: "Portions enjoyed",
      body: (active) => (
        <div className={styles.stack}>
          <p className={styles.kicker}>Of everything we served</p>
          <div className={styles.ring} style={{ "--p": rate } as CSSProperties}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="52" />
              <circle
                cx="60"
                cy="60"
                r="52"
                pathLength={100}
                className={active ? styles.ringFill : styles.ringFillStatic}
              />
            </svg>
            <strong>
              <Count value={rate} active={active} decimals={rate % 1 ? 1 : 0} />
              %
            </strong>
          </div>
          <p className={styles.lede}>
            of portions were enjoyed.{" "}
            {story.leftoverPortions
              ? `Only ${nf.format(story.leftoverPortions)} came back as leftovers.`
              : "Not a single portion came back."}
          </p>
          {delta && (
            <p className={styles.badge}>
              {delta.better ? "Up" : "Down"} {delta.size} points on the previous
              period
            </p>
          )}
        </div>
      ),
    });
  }
  // Stretch the month bars so small differences near 100% stay visible.
  const rates = story.months.flatMap((m) =>
    m.enjoyedRate === null ? [] : [m.enjoyedRate],
  );
  const floor = rates.length
    ? Math.max(0, Math.floor((Math.min(...rates) - 10) / 10) * 10)
    : 0;
  const monthHeight = (rate: number | null) =>
    rate === null ? 4 : Math.max(6, ((rate - floor) / (100 - floor)) * 100);
  if (story.measuredWasteKg !== null) {
    const perGuest = story.wastePerGuestGrams;
    const delta = change(perGuest, story.previous?.wastePerGuestGrams, true);
    slides.push({
      key: "waste",
      theme: styles.themeTeal,
      label: "Food waste",
      body: (active) => (
        <div className={styles.stack}>
          <p className={styles.kicker}>Food waste, weighed</p>
          {perGuest !== null ? (
            <>
              <p className={styles.huge}>
                <Count value={perGuest} active={active} />
                <small>g</small>
              </p>
              <p className={styles.unit}>per guest</p>
            </>
          ) : (
            <p className={styles.huge}>
              <Count
                value={story.measuredWasteKg!}
                active={active}
                decimals={1}
              />
              <small>kg</small>
            </p>
          )}
          <p className={styles.lede}>
            {nf.format(story.measuredWasteKg!)} kg in total across the events we
            weighed.
          </p>
          {delta && (
            <p className={styles.badge}>
              {delta.better ? "Down" : "Up"} {delta.size}% on the previous
              period
            </p>
          )}
          {story.months.length > 1 && (
            <>
              <p className={styles.caption}>Portions enjoyed, month by month</p>
              <div className={styles.months}>
                {story.months.map((m) => (
                  <div key={m.month}>
                    <span
                      className={styles.monthBar}
                      style={
                        {
                          "--h": `${monthHeight(m.enjoyedRate)}%`,
                        } as CSSProperties
                      }
                    />
                    <small>{m.label}</small>
                    <small>
                      {m.enjoyedRate === null
                        ? "–"
                        : `${Math.round(m.enjoyedRate)}%`}
                    </small>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ),
    });
  }
  if (
    story.secondLife.rehomedPortions ||
    story.secondLife.divertedRate !== null
  ) {
    slides.push({
      key: "second-life",
      theme: styles.themeLime,
    light: true,
      label: "Second life",
      body: (active) => (
        <div className={styles.stack}>
          <p className={styles.kicker}>Nothing good goes to waste</p>
          {story.secondLife.rehomedPortions > 0 && (
            <>
              <p className={styles.huge}>
                <Count
                  value={story.secondLife.rehomedPortions}
                  active={active}
                />
              </p>
              <p className={styles.unit}>
                leftover{" "}
                {story.secondLife.rehomedPortions === 1
                  ? "portion"
                  : "portions"}{" "}
                still got eaten
              </p>
              <p className={styles.lede}>
                Shared with your team, the people who cooked it, or a local food
                charity.
              </p>
            </>
          )}
          {story.secondLife.divertedRate !== null && (
            <p
              className={
                story.secondLife.rehomedPortions ? styles.badge : styles.big
              }
            >
              {Math.round(story.secondLife.divertedRate)}% of weighed waste
              stayed out of the general bin
            </p>
          )}
        </div>
      ),
    });
  }
  if (story.bestEvent) {
    const best = story.bestEvent;
    slides.push({
      key: "best",
      theme: styles.themeBlue,
      label: "Best event",
      body: (active) => (
        <div className={styles.stack}>
          <p className={styles.kicker}>Your cleanest plates</p>
          <h2 className={styles.big}>{best.name}</h2>
          <p className={styles.lede}>{dateLabel(best.date)}</p>
          <p className={styles.huge}>
            <Count
              value={best.enjoyedRate}
              active={active}
              decimals={best.enjoyedRate % 1 ? 1 : 0}
            />
            %
          </p>
          <p className={styles.unit}>of portions enjoyed</p>
        </div>
      ),
    });
  }
  if (story.feedback.average !== null) {
    const avg = story.feedback.average;
    slides.push({
      key: "feedback",
      theme: styles.themeGold,
    light: true,
      label: "Feedback",
      body: (active) => (
        <div className={styles.stack}>
          <p className={styles.kicker}>You rated us</p>
          <p className={styles.huge}>
            <Count value={avg} active={active} decimals={1} />
            <small>/5</small>
          </p>
          <p className={styles.stars} aria-label={`${avg} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={n <= Math.round(avg) ? styles.on : ""}>
                ★
              </span>
            ))}
          </p>
          {story.feedback.quote && (
            <blockquote className={styles.quote}>
              “{story.feedback.quote}”
            </blockquote>
          )}
        </div>
      ),
    });
  }
  slides.push({
    key: "persona",
    theme: styles.themeMagenta,
    label: "Your persona",
    body: () => (
      <div className={styles.stack}>
        <p className={styles.kicker}>Your food personality is</p>
        <h2 className={styles.giant}>{story.persona.title}</h2>
        <p className={styles.lede}>{story.persona.line}</p>
      </div>
    ),
  });
  if (story.tips.length || story.note) {
    slides.push({
      key: "next",
      theme: styles.themeCream,
    light: true,
      label: "Next time",
      body: () => (
        <div className={styles.stack}>
          <p className={styles.kicker}>For next time</p>
          {story.tips.length > 0 && (
            <ol className={styles.tips}>
              {story.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          )}
          {story.note && (
            <blockquote className={styles.note}>
              {story.note}
              <cite>Your chef at {story.business}</cite>
            </blockquote>
          )}
        </div>
      ),
    });
  }
  if (story.reportedWaste) {
    const waste = story.reportedWaste;
    slides.push({
      key: "reported-waste", theme: styles.themeGreen, label: "All reported waste",
      body: () => <div className={styles.stack}>
        <p className={styles.kicker}>All reported food waste</p>
        <h2 className={styles.big}>{waste.measuredKg.toFixed(2)} kg measured</h2>
        <p className={styles.lede}>{waste.records} records · {waste.unmeasured} without measured weight</p>
        <dl className={styles.grid}>{waste.categories.map((c) => <div key={c.name}><dt>{c.name}</dt><dd>{c.measuredKg.toFixed(2)} kg</dd></div>)}</dl>
        <p className={styles.small}>Waste logged from {story.from} to {story.to}, matching the waste register. {waste.records ? "Missing weights are not zero waste." : "No records does not establish zero waste."} Event performance uses completed-event dates.</p>
      </div>,
    });
  }
  slides.push({
    key: "summary",
    theme: styles.themeSummary,
    label: "Summary",
    body: () => (
      <div className={styles.summary}>
        <p className={styles.kicker}>
          {story.business} · {story.periodLabel} Wrapped
        </p>
        <h2 className={styles.big}>{story.customer}</h2>
        <dl className={styles.grid}>
          <div>
            <dt>Guests fed</dt>
            <dd>{nf.format(story.guests)}</dd>
          </div>
          <div>
            <dt>Occasions</dt>
            <dd>{nf.format(story.occasions)}</dd>
          </div>
          <div>
            <dt>Portions enjoyed</dt>
            <dd>
              {story.enjoyedRate === null
                ? "–"
                : `${Math.round(story.enjoyedRate)}%`}
            </dd>
          </div>
          <div>
            <dt>Waste per guest</dt>
            <dd>
              {story.wastePerGuestGrams === null
                ? "–"
                : `${story.wastePerGuestGrams} g`}
            </dd>
          </div>
          <div className={styles.wide}>
            <dt>Top dish</dt>
            <dd>{story.topDishes[0]?.name || "–"}</dd>
          </div>
          <div className={styles.wide}>
            <dt>Persona</dt>
            <dd>{story.persona.title}</dd>
          </div>
        </dl>
        <p className={styles.small}>
          Waste checked at {story.coverage.checked} of {story.coverage.events}{" "}
          {story.coverage.events === 1 ? "event" : "events"}. “Enjoyed” means a
          portion did not come back as a leftover or plate waste. Weights are
          from our kitchen scales. Prepared {dateLabel(story.generatedAt)}.
        </p>
      </div>
    ),
  });
  return slides;
}

export function WrappedStoryView({
  story,
  variant = "page",
  onClose,
  shareUrl,
}: {
  story: WrappedStory;
  variant?: "page" | "embed";
  onClose?: () => void;
  shareUrl?: string;
}) {
  const slides = slidesFor(story);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(variant === "embed");
  const [held, setHeld] = useState(false);
  const [copied, setCopied] = useState(false);
  const reduced = useReducedMotion();
  const last = slides.length - 1;
  const touchStart = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const go = useCallback(
    (to: number) => setIndex(Math.max(0, Math.min(last, to))),
    [last],
  );
  const running = !paused && !held && !reduced && index < last;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => go(index + 1), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [running, index, go]);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "Escape" && onClose) onClose();
      else return;
    };
    const target = variant === "page" ? window : el;
    target.addEventListener("keydown", onKey as EventListener);
    return () => target.removeEventListener("keydown", onKey as EventListener);
  }, [go, index, onClose, variant]);

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", shareUrl);
    }
  };

  return (
    <div
      className={`${styles.root} ${variant === "embed" ? styles.embed : styles.page}`}
      ref={stageRef}
      tabIndex={variant === "embed" ? 0 : undefined}
      aria-roledescription="carousel"
      aria-label={`${story.customer} ${story.periodLabel} Wrapped`}
    >
      <div
        className={`${styles.phone} ${slides[index]?.light ? styles.light : ""}`}
      >
        <div className={styles.progress} aria-hidden="true">
          {slides.map((s, i) => (
            <span key={s.key}>
              <i
                className={
                  i < index
                    ? styles.done
                    : i === index
                      ? running
                        ? styles.running
                        : styles.current
                      : ""
                }
                style={{ animationDuration: `${SLIDE_MS}ms` }}
              />
            </span>
          ))}
        </div>
        <div className={styles.topBar}>
          <span>
            {index + 1} / {slides.length}
          </span>
          <div>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play" : "Pause"}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {slides.map((slide, i) => (
          <section
            key={slide.key}
            className={`${styles.slide} ${slide.theme} ${i === index ? styles.active : ""}`}
            aria-hidden={i !== index}
            aria-label={`${slide.label}, slide ${i + 1} of ${slides.length}`}
            onPointerDown={() => setHeld(true)}
            onPointerUp={() => setHeld(false)}
            onPointerLeave={() => setHeld(false)}
            onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const start = touchStart.current;
              touchStart.current = null;
              if (start === null) return;
              const dx = e.changedTouches[0].clientX - start;
              if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
            }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button,a")) return;
              const box = e.currentTarget.getBoundingClientRect();
              go(index + (e.clientX - box.left < box.width / 3 ? -1 : 1));
            }}
          >
            <span className={styles.blobA} aria-hidden="true" />
            <span className={styles.blobB} aria-hidden="true" />
            <div className={styles.content}>{slide.body(i === index)}</div>
          </section>
        ))}
        <div className={styles.controls}>
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous slide"
          >
            <ChevronLeft size={18} />
          </button>
          {index === last ? (
            <div className={styles.actions}>
              <button type="button" onClick={() => go(0)}>
                <RotateCcw size={15} /> Replay
              </button>
              {variant === "page" && (
                <button type="button" onClick={() => window.print()}>
                  <Download size={15} /> Save PDF
                </button>
              )}
              {shareUrl && (
                <button type="button" onClick={copy}>
                  <Link2 size={15} /> {copied ? "Copied" : "Copy link"}
                </button>
              )}
            </div>
          ) : (
            <span className={styles.brand}>{story.business}</span>
          )}
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === last}
            aria-label="Next slide"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
