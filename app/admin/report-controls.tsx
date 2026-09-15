"use client";
import { useMemo, useSyncExternalStore } from "react";
import { useOps } from "./ops-context";
import { Field, Pick } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import {
  filtersFromURL,
  presetDates,
  type ReportFilter,
} from "@/lib/reporting";
const eventName = "em2-report-filter";
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(eventName, callback);
  };
}
const snapshot = () => window.location.search;
const serverSnapshot = () => "";
export function updateQuery(values: Record<string, string>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.pushState({}, "", url);
  window.dispatchEvent(new Event(eventName));
}
export function useReportFilters() {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const params = new URLSearchParams(search);
  const filter = useMemo(
    () => filtersFromURL(new URLSearchParams(search)),
    [search],
  );
  const setFilter = (patch: Partial<ReportFilter>) =>
    updateQuery(
      Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [
          k === "customerId" ? "customer" : k,
          String(v),
        ]),
      ),
    );
  return { filter, setFilter, params };
}
export function ReportControls({
  filter,
  setFilter,
}: {
  filter: ReportFilter;
  setFilter: (f: Partial<ReportFilter>) => void;
}) {
  const { s } = useOps();
  return (
    <div className="analytics-controls">
      <Pick
        label="Reporting period"
        value="custom"
        onChange={(v) => {
          if (v !== "custom") setFilter(presetDates(v));
        }}
        options={[
          { value: "custom", label: "Custom / selected dates" },
          { value: "month", label: "Month to date" },
          { value: "last-month", label: "Last month" },
          { value: "year", label: "Year to date" },
          { value: "twelve-months", label: "Last twelve months" },
        ]}
      />
      <Field
        label="From"
        type="date"
        value={filter.from}
        onChange={(from) => setFilter({ from })}
      />
      <Field
        label="To"
        type="date"
        value={filter.to}
        onChange={(to) => setFilter({ to })}
      />
      <Pick
        label="Customer"
        value={filter.customerId}
        onChange={(customerId) => setFilter({ customerId })}
        options={[
          { value: "", label: "Whole business / all customers" },
          ...s.customers.map((c) => ({
            value: c.id,
            label: c.company || c.name,
          })),
        ]}
      />
      <Pick
        label="Service"
        value={filter.service}
        onChange={(service) =>
          setFilter({ service: service as ReportFilter["service"] })
        }
        options={[
          { value: "all", label: "Private & corporate" },
          { value: "private", label: "Private services" },
          { value: "corporate", label: "Corporate catering" },
        ]}
      />
      <Button
        variant="outline"
        onClick={() => setFilter({ customerId: "", service: "all" })}
      >
        Whole business
      </Button>
      {filter.customerId &&
        !s.customers.some((c) => c.id === filter.customerId) && (
          <p role="alert">
            This customer no longer exists. Choose a customer or return to Whole
            business.
          </p>
        )}
    </div>
  );
}
export function exportCSV(name: string, rows: (string | number | null)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            String(v ?? "")
              .replace(/^[=+@-]/, "'$&")
              .replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
