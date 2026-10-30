"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { VenueTarget } from "./autosous-venues";
import { useOps } from "./ops-context";
import { publishVenueNotice, VENUE_WATCH, type VenueWatch } from "./venue-notices";

function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <span>{seconds}s elapsed{seconds >= 20 ? " · Still waiting for the venue services" : ""}</span>;
}

export function VenueLookupProgress({ busy, ready, label, phase, target }: {
  busy: boolean;
  ready: boolean;
  label: string;
  phase: string;
  target: VenueTarget | null;
}) {
  const { mode } = useOps();
  const id = useId();
  const [enabled, setEnabled] = useState(false);
  const wasBusy = useRef(false);

  useEffect(() => {
    const watch = (event: Event) => {
      const detail = (event as CustomEvent<VenueWatch>).detail;
      if (detail?.id === id && detail.mode === mode) setEnabled(detail.enabled);
    };
    window.addEventListener(VENUE_WATCH, watch);
    return () => window.removeEventListener(VENUE_WATCH, watch);
  }, [id, mode]);

  // Offer help through the corner avatar only after a genuinely slow lookup.
  useEffect(() => {
    if (!busy || !target || enabled) return;
    const timer = window.setTimeout(() => {
      publishVenueNotice({ id, mode, kind: "slow", label, target });
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [busy, enabled, id, mode, label, target]);

  useEffect(() => {
    if (!wasBusy.current && busy && target) {
      publishVenueNotice({ id, mode, kind: "dismiss", label, target });
    }
    if (wasBusy.current && !busy && target) {
      publishVenueNotice({ id, mode, kind: enabled ? (ready ? "ready" : "failed") : "dismiss", label, target });
    }
    wasBusy.current = busy;
  }, [busy, ready, enabled, id, mode, label, target]);

  useEffect(() => {
    return () => {
      if (target) publishVenueNotice({ id, mode, kind: "dismiss", label, target });
    };
  }, [id, mode, label, target]);

  function toggleAlert() {
    if (!target) return;
    setEnabled(!enabled);
    publishVenueNotice({ id, mode, kind: enabled ? "dismiss" : "waiting", label, target });
  }

  return (
    <div className="venue-lookup-status">
      {busy ? (
        <div className="venue-lookup-progress">
          <strong role="status">{phase}</strong>
          <div role="progressbar" aria-label="Venue lookup in progress" aria-valuetext={phase} className="venue-progress-track"><span /></div>
          <Elapsed />
          {target ? (
            <>
              <button type="button" aria-pressed={enabled} onClick={toggleAlert}>
                {enabled ? "Turn off completion alert" : "Ask AutoSous to let me know"}
              </button>
              <small>{enabled ? "AutoSous will pop up in the corner when your venue details are ready." : "You can return to chat while I gather the venue details."}</small>
            </>
          ) : null}
        </div>
      ) : ready ? <p role="status">Venue lookup complete. Review the details below.</p> : null}
    </div>
  );
}
