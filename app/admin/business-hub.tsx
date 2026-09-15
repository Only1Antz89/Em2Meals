"use client";
import { lazy, Suspense } from "react";
import Business from "./business";
import CostsTravel from "./costs-travel";
import {
  ReportControls,
  useReportFilters,
} from "./report-controls";
const BusinessOverview = lazy(() => import("./business-overview"));
export default function BusinessHub() {
  const { filter, setFilter, params } = useReportFilters();
  const requested = params.get("tab") || "overview";
  const tab = ["overview", "purchasing", "invoices", "costs"].includes(
    requested,
  )
    ? requested
    : "overview";
  return (
    <>
      {["overview", "costs"].includes(tab) && (
        <ReportControls filter={filter} setFilter={setFilter} />
      )}
      <div id="business-panel">
        {tab === "overview" ? (
          <Suspense fallback={<p role="status">Loading business analytics…</p>}>
            <BusinessOverview filter={filter} params={params} />
          </Suspense>
        ) : tab === "costs" ? (
          <CostsTravel filter={filter} />
        ) : (
          <Business tab={tab} />
        )}
      </div>
    </>
  );
}
