"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutoSousLink, AutoSousProposal, AutoSousReply } from "@/lib/autosous";
import { AutoSousIcon } from "./autosous-icon";
import { AutoSousMarkdown, AutoSousRateLimitAlert } from "./assistant-display";
import { useOps } from "./ops-context";

type ProposalState = "pending" | "applying" | "applied" | "dismissed";
type Turn = {
  id: string;
  role: "user" | "model";
  text: string;
  proposals?: AutoSousProposal[];
  links?: AutoSousLink[];
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

  return (
    <div className="autosous-chat">
      {!turns.length ? (
        <div className="assistant-intro">
          <AutoSousIcon size={36} />
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
              <div className="autosous-turn-badge">
                <AutoSousIcon size={16} />
              </div>
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
          void ask(draft);
        }}
      >
        <label className="sr-only" htmlFor="autosous-question">
          Ask AutoSous
        </label>
        <textarea
          id="autosous-question"
          value={draft}
          maxLength={2000}
          rows={2}
          placeholder={
            integrations.gemini
              ? "Ask AutoSous anything about your kitchen or business…"
              : "AutoSous setup required: add GEMINI_API_KEY in the deployment settings."
          }
          disabled={!integrations.gemini}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(draft);
            }
          }}
        />
        <div className="autosous-composer-actions">
          {turns.length ? (
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
          <Button disabled={busy || thinking || !draft.trim() || !integrations.gemini}>
            {thinking ? "Thinking…" : "Ask AutoSous"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </div>
  );
}
