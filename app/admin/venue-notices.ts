"use client";

import type { VenueTarget } from "./autosous-venues";

export const VENUE_NOTICE = "autosous:venue-notice";
export const VENUE_WATCH = "autosous:venue-watch";
export const VENUE_OPEN = "autosous:venue-open";

export type VenueNotice = {
  id: string;
  mode: string;
  kind: "slow" | "waiting" | "ready" | "failed" | "dismiss";
  label: string;
  target: VenueTarget;
};
export type VenueWatch = { id: string; mode: string; enabled: boolean };

export function publishVenueNotice(notice: VenueNotice) {
  window.dispatchEvent(new CustomEvent<VenueNotice>(VENUE_NOTICE, { detail: notice }));
}
export function watchVenue(detail: VenueWatch) {
  window.dispatchEvent(new CustomEvent<VenueWatch>(VENUE_WATCH, { detail }));
}
export function openVenueNotice(notice: VenueNotice) {
  window.dispatchEvent(new CustomEvent<VenueNotice>(VENUE_OPEN, { detail: notice }));
}
