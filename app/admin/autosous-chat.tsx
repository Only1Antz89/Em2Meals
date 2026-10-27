"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, MapPin, MessageCircle, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutoSousLink, AutoSousProposal, AutoSousReply } from "@/lib/autosous";
import { AutoSousIcon } from "./autosous-icon";
import { AutoSousMarkdown, AutoSousRateLimitAlert } from "./assistant-display";
import { useOps } from "./ops-context";
import { AutoSousHat } from "./autosous-hat";
import { VenueMode, VenueOffers, useAutoVenueResearch, type VenueTarget } from "./autosous-venues";

type ProposalState = "pending" | "applying" | "applied" | "dismissed";
type Turn = {
  id: string;
  role: "user" | "model";
  text: string;
  proposals?: AutoSousProposal[];
  links?: AutoSousLink[];
  sources?: { title: string; url: string }[];
};

const STARTERS = [
  "What needs my attention this week?",
  "Which upcoming orders are short on ingredients?",
  "Who should I follow up with?",
  "What should I reorder, and from which supplier?",
  "How is the business doing this month?",
  "Which recipes are in the current season's menu?",
];
const HISTORY_TURNS = 20;
const storageKey = (mode: string) => `autosous-chat:${mode}`;

function loadTurns(mode: string): Turn[] {
  try {
    const raw = localStorage.getItem(storageKey(mode));
    const parsed = raw ? (JSON.parse(raw) as Turn[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch {
    return [];
  }
}
function loadStatus(mode: string): Record<string, ProposalState> {
  try {
    const raw = localStorage.getItem(`${storageKey(mode)}:status`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function AutoSousChat() {
  const { api, run, href, integrations, busy, mode } = useOps();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<Record<string, ProposalState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // "ask" sends the box to the chat; "venue" researches a venue on the map.
  const [compose, setCompose] = useState<"ask" | "venue">("ask");
  const [venue, setVenue] = useState<VenueTarget | null>(null);
  const working = useAutoVenueResearch();
  const openVenue = (target: VenueTarget) => {
    setVenue(target);
    setCompose("venue");
  };
  // Paths may carry a tab, e.g. "suppliers?tab=purchasing".
  const to = (path: string) => {
    const [page, query] = path.split("?");
    return href(page) + (query ? `&${query}` : "");
  };

  // The conversation is a per-browser convenience; records live in the
  // workspace, so losing it loses nothing.
  useEffect(() => {
    setTurns(loadTurns(mode));
    setStatus(loadStatus(mode));
    setRestored(true);
  }, [mode]);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(storageKey(mode), JSON.stringify(turns.slice(-40)));
      localStorage.setItem(`${storageKey(mode)}:status`, JSON.stringify(status));
    } catch {}
  }, [turns, status, mode, restored]);
  // The avatar's "Ask AutoSous" links open this page with ?ask=…
  const asked = useRef(false);
  useEffect(() => {
    if (!restored || asked.current || !integrations.gemini) return;
    const url = new URL(window.location.href);
    const venueId = url.searchParams.get("venue");
    if (venueId) {
      asked.current = true;
      url.searchParams.delete("venue");
      window.history.replaceState(null, "", url.toString());
      openVenue({ kind: "order", id: venueId });
      return;
    }
    const question = url.searchParams.get("ask");
    if (!question) return;
    asked.current = true;
    url.searchParams.delete("ask");
    window.history.replaceState(null, "", url.toString());
    void ask(question.slice(0, 2000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, integrations.gemini]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, thinking]);

  async function ask(question: string, base = turns) {
    const text = question.trim();
    if (!text || thinking) return;
    const userTurn: Turn = { id: crypto.randomUUID(), role: "user", text };
    const next = [...base, userTurn];
    setTurns(next);
    setDraft("");
    setError("");
    setThinking(true);
    try {
      let history = next.slice(-HISTORY_TURNS);
      while (history.length && history[0].role !== "user") history = history.slice(1);
      const reply = await api<AutoSousReply>("assistant", {
        messages: history.map((turn) => ({
          role: turn.role,
          // Remind the model what it proposed, so "apply that" style
          // follow-ups make sense without resending the records.
          text:
            turn.role === "model" && turn.proposals?.length
              ? `${turn.text}\n\n(Proposed: ${turn.proposals.map((p) => p.title).join("; ")})`
              : turn.text,
        })),
      });
      setTurns([
        ...next,
        {
          id: crypto.randomUUID(),
          role: "model",
          text: reply.text,
          proposals: reply.proposals,
          links: reply.links,
          sources: reply.sources,
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setThinking(false);
    }
  }

  async function apply(proposal: AutoSousProposal) {
    setStatus((current) => ({ ...current, [proposal.id]: "applying" }));
    setErrors((current) => ({ ...current, [proposal.id]: "" }));
    try {
      await run(proposal.type, proposal.payload);
      setStatus((current) => ({ ...current, [proposal.id]: "applied" }));
    } catch (e) {
      setStatus((current) => ({ ...current, [proposal.id]: "pending" }));
      setErrors((current) => ({ ...current, [proposal.id]: (e as Error).message }));
    }
  }

  const retry = () => {
    const lastUser = turns.findLast((turn) => turn.role === "user");
    if (!lastUser) return;
    void ask(lastUser.text, turns.slice(0, turns.lastIndexOf(lastUser)));
  };

  const submit = () => {
    if (compose === "venue") {
      const query = draft.trim();
      if (query.length < 3) return;
      setDraft("");
      openVenue({ kind: "query", query });
    } else void ask(draft);
  };

  return (
    <div className={`autosous-chat ${compose === "venue" ? "is-venue" : ""}`}>
      {compose === "venue" ? (
        <VenueMode
          target={venue}
          onTarget={setVenue}
          working={working}
          onClose={() => {
            setVenue(null);
            setCompose("ask");
          }}
        />
      ) : !turns.length ? (
        <div className="assistant-intro">
          <AutoSousHat size={132} busy={thinking} className="assistant-intro-hat" />
          <h2>What can I help with in the kitchen today?</h2>
          <p>
            Ask about enquiries, orders, recipes, menus, stock, suppliers,
            customers or how the business is doing. AutoSous reads your records
            and can prepare follow-ups, notes, email drafts, quotes, meal
            lists, draft recipes and menus for you to approve. Nothing changes
            until you press Apply.
          </p>
          <div className="suggestions">
            {STARTERS.map((q) => (
              <Button
                key={q}
                variant="outline"
                disabled={busy || thinking || !integrations.gemini}
                onClick={() => void ask(q)}
              >
                {q}
              </Button>
            ))}
          </div>
          <VenueOffers working={working} onPick={(id) => openVenue({ kind: "order", id })} />
        </div>
      ) : (
        <div className="autosous-thread" aria-live="polite">
          {turns.map((turn) =>
            turn.role === "user" ? (
              <div key={turn.id} className="autosous-turn is-user">
                <p>{turn.text}</p>
              </div>
            ) : (
              <div key={turn.id} className="autosous-turn is-model">
                <div className="autosous-turn-badge">
                  <AutoSousIcon size={16} />
                </div>
                <div className="autosous-turn-body">
                  <AutoSousMarkdown text={turn.text} />
                  {turn.proposals?.map((proposal) => {
                    const state = status[proposal.id] || "pending";
                    if (state === "dismissed") return null;
                    return (
                      <div
                        key={proposal.id}
                        className={`autosous-proposal ${state === "applied" ? "is-applied" : ""}`}
                      >
                        <div className="autosous-proposal-text">
                          <strong>{proposal.title}</strong>
                          {proposal.detail ? <p>{proposal.detail}</p> : null}
                          {errors[proposal.id] ? (
                            <p role="alert" className="error-message">
                              {errors[proposal.id]}
                            </p>
                          ) : null}
                        </div>
                        <div className="autosous-proposal-actions">
                          {state === "applied" ? (
                            <>
                              <span className="autosous-applied">
                                <Check size={14} /> Applied
                              </span>
                              {proposal.link ? (
                                <Link href={to(proposal.link)}>Open</Link>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={state === "applying"}
                                onClick={() =>
                                  setStatus((current) => ({ ...current, [proposal.id]: "dismissed" }))
                                }
                              >
                                <X size={14} /> Dismiss
                              </Button>
                              <Button
                                size="sm"
                                disabled={busy || state === "applying"}
                                onClick={() => void apply(proposal)}
                              >
                                {state === "applying" ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Check size={14} />
                                )}
                                Apply
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {turn.sources?.length ? (
                    <div className="autosous-links autosous-sources">
                      {turn.sources.map((source) => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                          {source.title} <ExternalLink size={11} />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {turn.links?.length ? (
                    <div className="autosous-links">
                      {turn.links.map((item) => (
                        <Link key={item.path} href={to(item.path)}>
                          {item.label} <ArrowRight size={12} />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )}
          {thinking ? (
            <div className="autosous-turn is-model is-thinking">
              <AutoSousHat size={40} busy className="autosous-turn-hat" />
              <p>
                <RefreshCw size={14} className="animate-spin" /> Checking your
                records…
              </p>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      )}
      {error ? (
        <AutoSousRateLimitAlert error={error} busy={thinking} onRetry={retry} />
      ) : null}
      <form
        className="autosous-composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="autosous-question">
          {compose === "venue" ? "Search a venue" : "Ask AutoSous"}
        </label>
        <textarea
          id="autosous-question"
          value={draft}
          maxLength={2000}
          rows={2}
          placeholder={
            !integrations.gemini
              ? "AutoSous setup required: add GEMINI_API_KEY in the deployment settings."
              : compose === "venue"
                ? "Search a venue name, address or postcode…"
                : "Ask AutoSous anything about your kitchen or business…"
          }
          disabled={!integrations.gemini}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="autosous-composer-actions">
          <div className="autosous-compose-switch" role="radiogroup" aria-label="What the box does">
            <button
              type="button"
              role="radio"
              aria-checked={compose === "ask"}
              className={compose === "ask" ? "selected" : ""}
              onClick={() => {
                setCompose("ask");
                setVenue(null);
              }}
            >
              <MessageCircle size={13} /> Ask
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={compose === "venue"}
              className={compose === "venue" ? "selected" : ""}
              onClick={() => setCompose("venue")}
            >
              <MapPin size={13} /> Venue
            </button>
          </div>
          {turns.length && compose === "ask" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={thinking}
              onClick={() => {
                setTurns([]);
                setStatus({});
                setErrors({});
                setError("");
              }}
            >
              <Plus size={14} /> New conversation
            </Button>
          ) : null}
          {compose === "venue" ? (
            <Button disabled={draft.trim().length < 3 || !integrations.gemini}>
              Find venue
              <MapPin size={16} />
            </Button>
          ) : (
            <Button disabled={busy || thinking || !draft.trim() || !integrations.gemini}>
              {thinking ? "Thinking…" : "Ask AutoSous"}
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
