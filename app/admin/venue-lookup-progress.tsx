"use client";

import { useEffect, useRef, useState } from "react";

function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <span>{seconds}s elapsed{seconds >= 20 ? " · Still waiting for the venue services" : ""}</span>;
}

export function VenueLookupProgress({ busy, ready, label, phase }: {
  busy: boolean;
  ready: boolean;
  label: string;
  phase: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [note, setNote] = useState("");
  const wasBusy = useRef(false);

  useEffect(() => {
    if (wasBusy.current && !busy && ready && enabled && "Notification" in window && Notification.permission === "granted") {
      try {
        const alert = new Notification("Venue lookup complete", { body: `Details for ${label} are ready to review.` });
        alert.onclick = () => { window.focus(); alert.close(); };
      } catch {
        // The on-page completion message also works without desktop alerts.
      }
    }
    wasBusy.current = busy;
  }, [busy, ready, enabled, label]);

  async function toggleAlert() {
    if (enabled) { setEnabled(false); setNote("Completion alert turned off."); return; }
    if (!("Notification" in window)) {
      setNote("Browser alerts are unavailable here. Your results will appear on this page.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setEnabled(permission === "granted");
      setNote(permission === "granted"
        ? "Alert enabled. Keep this venue page open; you can switch tabs."
        : "Alerts are blocked. Allow notifications in browser settings, or watch this page.");
    } catch {
      setNote("Could not enable browser alerts. Your results will appear on this page.");
    }
  }

  return (
    <div className="venue-lookup-status">
      {busy ? (
        <div className="venue-lookup-progress">
          <strong role="status">{phase}</strong>
          <div role="progressbar" aria-label="Venue lookup in progress" aria-valuetext={phase} className="venue-progress-track"><span /></div>
          <Elapsed />
          <button type="button" aria-pressed={enabled} onClick={toggleAlert}>
            {enabled ? "Turn off completion alert" : "Alert me when complete"}
          </button>
          <small>Keep this venue page open. You can switch to another browser tab while you wait.</small>
        </div>
      ) : ready ? <p role="status">Venue lookup complete. Review the details below.</p> : null}
      {note ? <p role="status">{note}</p> : null}
    </div>
  );
}
