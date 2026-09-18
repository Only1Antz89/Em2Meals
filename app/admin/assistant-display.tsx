"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Calendar,
  ExternalLink,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Info,
  Clock,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Source = {
  title: string;
  url: string;
};

export type AssistantResult = {
  text: string;
  sources?: Source[];
};

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/;

  let key = 0;
  while (remaining) {
    const match = remaining.match(regex);
    if (!match) {
      nodes.push(remaining);
      break;
    }
    const matchIndex = match.index ?? 0;
    if (matchIndex > 0) {
      nodes.push(remaining.substring(0, matchIndex));
    }
    if (match[2]) {
      nodes.push(<strong key={key++} className="autosous-strong">{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<code key={key++} className="autosous-code">{match[3]}</code>);
    } else if (match[4]) {
      nodes.push(<em key={key++} className="autosous-em">{match[4]}</em>);
    }
    remaining = remaining.substring(matchIndex + match[0].length);
  }
  return nodes;
}

type Block =
  | { type: "order_header"; ref: string; date?: string; status?: string; raw: string }
  | { type: "action_heading"; title: string }
  | { type: "heading"; text: string }
  | { type: "key_value_list"; items: { label: string; value: string; note?: string }[] }
  | { type: "list"; items: string[] }
  | { type: "ordered_list"; items: string[] }
  | { type: "note"; text: string }
  | { type: "divider" }
  | { type: "paragraph"; text: string };

function parseMarkdownToBlocks(text: string): Block[] {
  const rawLines = text.split("\n");
  const blocks: Block[] = [];
  let currentRawList: { isOrdered: boolean; items: string[] } | null = null;

  function flushList() {
    if (!currentRawList) return;
    const { isOrdered, items } = currentRawList;
    currentRawList = null;

    if (isOrdered) {
      blocks.push({ type: "ordered_list", items });
      return;
    }

    // Check if majority of items match "**Key:** Value"
    const parsedKV: { label: string; value: string; note?: string }[] = [];
    let kvCount = 0;

    for (const item of items) {
      const match = item.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
      if (match) {
        kvCount++;
        const label = match[1].trim();
        let value = match[2].trim();
        let note: string | undefined;

        const noteMatch = value.match(/\((approx\.[^)]+)\)/i);
        if (noteMatch) {
          note = noteMatch[1];
          value = value.replace(/\((approx\.[^)]+)\)/i, "").trim();
        }

        parsedKV.push({ label, value, note });
      } else {
        parsedKV.push({ label: item, value: "" });
      }
    }

    if (kvCount >= Math.max(1, Math.floor(items.length / 2))) {
      blocks.push({ type: "key_value_list", items: parsedKV });
    } else {
      blocks.push({ type: "list", items });
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      flushList();
      continue;
    }

    if (line === "---" || line === "***") {
      flushList();
      blocks.push({ type: "divider" });
      continue;
    }

    if (/^###?\s+/.test(line)) {
      flushList();
      const headingRaw = line.replace(/^###?\s+/, "");

      // Check if it represents an Order heading
      const orderMatch = headingRaw.match(/(?:Order(?:\s+Reference)?:\s*|\bOrder\s+)([A-Z0-9-]+)/i);
      if (orderMatch) {
        const ref = orderMatch[1];
        const dateMatch = headingRaw.match(/Date:\s*([^\s|)]+)/i);
        const statusMatch = headingRaw.match(/Status:\s*`?([^`)|]+)`?/i);
        blocks.push({
          type: "order_header",
          ref,
          date: dateMatch?.[1],
          status: statusMatch?.[1]?.trim(),
          raw: headingRaw,
        });
        continue;
      }

      // Check for action headings
      if (/suggested actions|action items|priority categories|actions/i.test(headingRaw)) {
        blocks.push({ type: "action_heading", title: headingRaw.replace(/\*\*/g, "") });
        continue;
      }

      blocks.push({ type: "heading", text: headingRaw });
      continue;
    }

    if (/^[*•-]\s+/.test(line)) {
      const itemText = line.replace(/^[*•-]\s+/, "");
      if (!currentRawList || currentRawList.isOrdered) {
        flushList();
        currentRawList = { isOrdered: false, items: [] };
      }
      currentRawList.items.push(itemText);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const itemText = line.replace(/^\d+\.\s+/, "");
      if (!currentRawList || !currentRawList.isOrdered) {
        flushList();
        currentRawList = { isOrdered: true, items: [] };
      }
      currentRawList.items.push(itemText);
      continue;
    }

    flushList();

    if (/^\*\(?(Note|Please note):/i.test(line) || /^\(Note:/i.test(line)) {
      const cleanNote = line
        .replace(/^\*\(/, "(")
        .replace(/\)\*$/, ")")
        .replace(/^\*/, "")
        .replace(/\*$/, "");
      blocks.push({ type: "note", text: cleanNote });
      continue;
    }

    blocks.push({ type: "paragraph", text: line });
  }

  flushList();
  return blocks;
}

function statusTone(status?: string): "amber" | "green" | "blue" | "neutral" {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (s.includes("needed") || s.includes("alert") || s.includes("shortage")) return "amber";
  if (s.includes("confirmed") || s.includes("ready") || s.includes("completed")) return "green";
  if (s.includes("quote") || s.includes("enquiry")) return "blue";
  return "neutral";
}

export function AutoSousFormattedAnswer({
  result,
  question,
}: {
  result: AssistantResult;
  question?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!result?.text) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const blocks = parseMarkdownToBlocks(result.text || "");

  return (
    <div className="autosous-response-card">
      <div className="autosous-response-header">
        <div className="autosous-brand">
          <div className="autosous-icon-badge">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="autosous-title-row">
              <span className="autosous-title">AutoSous Operational Intelligence</span>
              <span className="autosous-badge-live">Live</span>
            </div>
            {question && <p className="autosous-query-echo">&ldquo;{question}&rdquo;</p>}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="autosous-copy-btn"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald-600" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>

      <div className="autosous-response-body">
        {blocks.map((block, idx) => {
          switch (block.type) {
            case "order_header": {
              const tone = statusTone(block.status);
              return (
                <div key={idx} className="autosous-order-header-card">
                  <div className="autosous-order-meta">
                    <span className="autosous-ref-pill">{block.ref}</span>
                    {block.date && (
                      <span className="autosous-date-pill">
                        <Calendar size={13} />
                        {block.date}
                      </span>
                    )}
                    {block.status && (
                      <span className={`autosous-status-pill status-${tone}`}>
                        {block.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            }
            case "action_heading":
              return (
                <div key={idx} className="autosous-action-header">
                  <Lightbulb size={18} className="autosous-action-icon" />
                  <h4>{block.title}</h4>
                </div>
              );
            case "heading":
              return (
                <h4 key={idx} className="autosous-heading">
                  {parseInline(block.text)}
                </h4>
              );
            case "key_value_list":
              return (
                <div key={idx} className="autosous-kv-grid">
                  {block.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="autosous-kv-row">
                      <span className="autosous-kv-label">
                        {parseInline(item.label)}
                      </span>
                      <div className="autosous-kv-value-wrap">
                        {item.value && (
                          <span className="autosous-kv-value-pill">
                            {parseInline(item.value)}
                          </span>
                        )}
                        {item.note && (
                          <span className="autosous-kv-note">
                            {item.note}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            case "list":
              return (
                <ul key={idx} className="autosous-bullet-list">
                  {block.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="autosous-bullet-item">
                      <span className="autosous-bullet-marker" />
                      <span>{parseInline(item)}</span>
                    </li>
                  ))}
                </ul>
              );
            case "ordered_list":
              return (
                <ol key={idx} className="autosous-ordered-list">
                  {block.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="autosous-ordered-item">
                      <span className="autosous-ordered-number">{itemIdx + 1}</span>
                      <span>{parseInline(item)}</span>
                    </li>
                  ))}
                </ol>
              );
            case "note":
              return (
                <div key={idx} className="autosous-note-card">
                  <Info size={16} className="autosous-note-icon" />
                  <p className="autosous-note-text">{parseInline(block.text)}</p>
                </div>
              );
            case "divider":
              return <hr key={idx} className="autosous-divider" />;
            case "paragraph":
            default:
              return (
                <p key={idx} className="autosous-paragraph">
                  {parseInline(block.text)}
                </p>
              );
          }
        })}
      </div>

      {result.sources && result.sources.length > 0 && (
        <div className="autosous-sources-section">
          <span className="autosous-sources-title">Verified Public Sources</span>
          <div className="autosous-sources-grid">
            {result.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="autosous-source-card"
              >
                <span className="autosous-source-title">{s.title}</span>
                <ExternalLink size={13} className="autosous-source-icon" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AutoSousRateLimitAlert({
  error,
  onRetry,
  busy,
}: {
  error: string;
  onRetry: () => void;
  busy?: boolean;
}) {
  const isRateLimit = /rate limit/i.test(error);

  return (
    <div className={`autosous-alert-banner ${isRateLimit ? "is-rate-limit" : "is-error"}`}>
      <div className="autosous-alert-content">
        <div className="autosous-alert-icon">
          {isRateLimit ? <Clock size={18} /> : <AlertCircle size={18} />}
        </div>
        <div className="autosous-alert-text">
          <strong className="autosous-alert-title">
            {isRateLimit ? "AutoSous rate limit reached" : "AutoSous Notice"}
          </strong>
          <p className="autosous-alert-desc">{error}</p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onRetry}
        disabled={busy}
        className="autosous-retry-btn"
      >
        <RotateCw size={13} className={busy ? "animate-spin" : ""} />
        <span>{busy ? "Retrying…" : "Retry query"}</span>
      </Button>
    </div>
  );
}
