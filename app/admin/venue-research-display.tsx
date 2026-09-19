"use client";

import React, { useState } from "react";
import {
  Building2,
  MapPin,
  Truck,
  DoorOpen,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RotateCw,
  Navigation,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/domain";

export type VenueResearchResult = {
  text: string;
  sources?: { title: string; url: string }[];
  venue?: string;
  address?: string;
  postcode?: string;
  reference?: string;
};

type Section = {
  title: string;
  kind: "overview" | "access" | "loading" | "checklist" | "catering" | "general";
  paragraphs: string[];
  items: { label?: string; text: string }[];
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
      nodes.push(
        <strong key={key++} className="venue-strong">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(
        <code key={key++} className="venue-code">
          {match[3]}
        </code>,
      );
    } else if (match[4]) {
      nodes.push(
        <em key={key++} className="venue-em">
          {match[4]}
        </em>,
      );
    }
    remaining = remaining.substring(matchIndex + match[0].length);
  }
  return nodes;
}

function parseVenueReport(rawText: string): {
  intro: string;
  sections: Section[];
  disclaimer: string;
} {
  const lines = rawText.split("\n");
  let intro = "";
  let disclaimer = "";
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for Disclaimer
    if (/^(\*|_)?(Disclaimer|Important Notice|Advisory|Please note):/i.test(line)) {
      disclaimer = line.replace(/^(\*|_)?(Disclaimer|Important Notice|Advisory|Please note):\s*/i, "").replace(/(\*|_)$/, "");
      continue;
    }

    // Check for Headings
    if (/^#{1,4}\s+/.test(line)) {
      const heading = line.replace(/^#{1,4}\s+/, "").trim();
      const lower = heading.toLowerCase();

      let kind: Section["kind"] = "general";
      if (lower.includes("overview") || lower.includes("about") || lower.includes("summary")) {
        kind = "overview";
      } else if (lower.includes("access") || lower.includes("pedestrian") || lower.includes("entry")) {
        kind = "access";
      } else if (lower.includes("loading") || lower.includes("delivery") || lower.includes("vehicle") || lower.includes("bay") || lower.includes("parking")) {
        kind = "loading";
      } else if (lower.includes("confirm") || lower.includes("check") || lower.includes("action") || lower.includes("verify")) {
        kind = "checklist";
      } else if (lower.includes("catering") || lower.includes("facility") || lower.includes("kitchen") || lower.includes("prep")) {
        kind = "catering";
      }

      currentSection = {
        title: heading.replace(/\*\*/g, ""),
        kind,
        paragraphs: [],
        items: [],
      };
      sections.push(currentSection);
      continue;
    }

    // Check for list items: "*", "-", "•", or "1."
    const bulletMatch = line.match(/^([*•-]\s+|\d+\.\s+)(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[2].trim();
      // Check if it has a bold label, e.g. "**Public Access:** Text..."
      const kvMatch = content.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
      const item = kvMatch
        ? { label: kvMatch[1].trim(), text: kvMatch[2].trim() }
        : { text: content };

      if (currentSection) {
        currentSection.items.push(item);
      } else {
        // Create an initial section if none exists yet
        currentSection = {
          title: "Venue Details",
          kind: "overview",
          paragraphs: [],
          items: [item],
        };
        sections.push(currentSection);
      }
      continue;
    }

    // Regular text paragraph
    if (currentSection) {
      currentSection.paragraphs.push(line);
    } else {
      if (!intro) intro = line;
      else intro += " " + line;
    }
  }

  return { intro, sections, disclaimer };
}

export function VenueResearchDisplay({
  result,
  order,
  onRefresh,
  busy,
}: {
  result: VenueResearchResult;
  order?: Order | null;
  onRefresh?: () => void;
  busy?: boolean;
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

  const venueName =
    order?.details?.venue || result.venue || "Venue";
  const venueAddress =
    order?.details?.address || result.address || "";
  const venuePostcode =
    order?.details?.postcode || result.postcode || "";
  const fullAddress = [venueAddress, venuePostcode].filter(Boolean).join(", ");
  const orderRef = order?.reference || result.reference;

  const mapsQuery = encodeURIComponent(
    [venueName, venueAddress, venuePostcode].filter(Boolean).join(" "),
  );

  const { intro, sections, disclaimer } = parseVenueReport(result.text || "");

  const getSectionIcon = (kind: Section["kind"]) => {
    switch (kind) {
      case "overview":
        return <Building2 size={16} className="text-slate-700" />;
      case "access":
        return <DoorOpen size={16} className="text-emerald-700" />;
      case "loading":
        return <Truck size={16} className="text-blue-700" />;
      case "checklist":
        return <CheckCircle2 size={16} className="text-amber-700" />;
      case "catering":
        return <Info size={16} className="text-purple-700" />;
      default:
        return <Building2 size={16} className="text-slate-700" />;
    }
  };

  return (
    <div className="venue-research-card">
      {/* Top Header */}
      <div className="venue-research-header">
        <div className="venue-research-brand">
          <div className="venue-research-icon-badge">
            <Building2 size={20} />
          </div>
          <div>
            <div className="venue-research-title-row">
              <span className="venue-research-title">
                Public Venue Intelligence & Recon
              </span>
              <span className="venue-research-badge-live">
                <span className="venue-pulse-dot" />
                Live Grounded Search
              </span>
            </div>
            <p className="venue-research-subtitle">
              {venueName}
              {orderRef ? ` · ${orderRef}` : ""}
            </p>
          </div>
        </div>

        <div className="venue-research-actions">
          {mapsQuery && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noreferrer"
              className="venue-maps-btn"
              title="Open location in Google Maps"
            >
              <Navigation size={13} />
              <span>View Map</span>
            </a>
          )}
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={busy}
              className="venue-refresh-btn"
            >
              <RotateCw size={13} className={busy ? "animate-spin" : ""} />
              <span>{busy ? "Updating…" : "Refresh"}</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="venue-copy-btn"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Recon</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Quick Venue Context Ribbon */}
      <div className="venue-quick-ribbon">
        <div className="venue-ribbon-item">
          <span className="venue-ribbon-label">Venue</span>
          <span className="venue-ribbon-value">{venueName}</span>
        </div>
        {fullAddress && (
          <div className="venue-ribbon-item">
            <span className="venue-ribbon-label">Location / Address</span>
            <span className="venue-ribbon-value">{fullAddress}</span>
          </div>
        )}
        {order?.details?.date && (
          <div className="venue-ribbon-item">
            <span className="venue-ribbon-label">Event Date</span>
            <span className="venue-ribbon-value">{order.details.date}</span>
          </div>
        )}
        {order?.details?.arrivalTime && (
          <div className="venue-ribbon-item">
            <span className="venue-ribbon-label">Arrival Window</span>
            <span className="venue-ribbon-value">
              {order.details.arrivalTime}
            </span>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="venue-research-body">
        {intro && (
          <div className="venue-intro-banner">
            <p>{parseInline(intro)}</p>
          </div>
        )}

        <div className="venue-sections-grid">
          {sections.map((section, sIdx) => {
            const isChecklist = section.kind === "checklist";
            return (
              <div
                key={sIdx}
                className={`venue-section-card kind-${section.kind} ${
                  isChecklist ? "is-checklist-card" : ""
                }`}
              >
                <div className="venue-section-header">
                  <div className="venue-section-icon-wrap">
                    {getSectionIcon(section.kind)}
                  </div>
                  <h4>{section.title}</h4>
                  {isChecklist && (
                    <span className="venue-checklist-badge">Verify Before Arrival</span>
                  )}
                </div>

                {section.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="venue-section-paragraph">
                    {parseInline(p)}
                  </p>
                ))}

                {section.items.length > 0 && (
                  <div className="venue-section-items">
                    {section.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className={`venue-item-row ${
                          isChecklist ? "is-checklist-item" : ""
                        }`}
                      >
                        {isChecklist ? (
                          <CheckCircle2
                            size={16}
                            className="venue-check-icon text-amber-600 flex-shrink-0"
                          />
                        ) : (
                          <div className="venue-bullet-dot flex-shrink-0" />
                        )}
                        <div className="venue-item-content">
                          {item.label && (
                            <strong className="venue-item-label">
                              {parseInline(item.label)}:
                            </strong>
                          )}{" "}
                          <span className="venue-item-text">
                            {parseInline(item.text)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Advisory / Disclaimer Banner */}
        {disclaimer ? (
          <div className="venue-advisory-banner">
            <ShieldAlert size={18} className="venue-advisory-icon" />
            <div className="venue-advisory-content">
              <strong>Public Reconnaissance Advisory</strong>
              <p>{parseInline(disclaimer)}</p>
            </div>
          </div>
        ) : (
          <div className="venue-advisory-banner">
            <AlertTriangle size={18} className="venue-advisory-icon" />
            <div className="venue-advisory-content">
              <strong>Public Reconnaissance Advisory</strong>
              <p>
                Information gathered from public online listings. Access protocols,
                loading bay permits, gate access, and parking restrictions can vary by
                event. Always confirm operational logistics directly with the venue
                management prior to dispatch.
              </p>
            </div>
          </div>
        )}

        {/* Verified Grounded Sources */}
        {result.sources && result.sources.length > 0 && (
          <div className="venue-sources-section">
            <span className="venue-sources-title">
              Verified Public Search Sources ({result.sources.length})
            </span>
            <div className="venue-sources-grid">
              {result.sources.map((s, idx) => (
                <a
                  key={idx}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="venue-source-card"
                >
                  <span className="venue-source-title">{s.title || s.url}</span>
                  <ExternalLink size={13} className="venue-source-icon" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
