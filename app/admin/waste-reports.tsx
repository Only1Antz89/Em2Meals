"use client";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Expand, Link2, Sparkles } from "lucide-react";
import { useOps } from "./ops-context";
import {
  Panel,
  GridTable,
  OrderTable,
  draftFields,
  Metric,
} from "./admin-client";
import { Button } from "@/components/ui/button";
import { money, today } from "@/lib/domain";
import { customerExport, presetDates, wasteReport } from "@/lib/reporting";
import {
  buildWrapped,
  checksDue,
  disposalLabels,
  wasteDisposals,
  type WasteDisposal,
} from "@/lib/wrapped";
import { type Order } from "@/lib/domain";
import { WrappedStoryView } from "@/components/wrapped/wrapped-story";
import { WasteCheckDialog } from "./waste-check";
import { Field } from "@/components/form-controls";
import { ReportControls, useReportFilters, exportCSV } from "./report-controls";
export default function WasteReports() {
  const { s, open, mode } = useOps();
  const { filter, setFilter } = useReportFilters();
  const r = useMemo(() => wasteReport(s, filter), [s, filter]);
  const due = useMemo(() => checksDue(s, filter), [s, filter]);
  const [checking, setChecking] = useState<Order | null>(null);
  const customer = s.customers.find((c) => c.id === filter.customerId);
  const recap = customer ? customerExport(s, filter) : null;
  return (
    <>
      <ReportControls filter={filter} setFilter={setFilter} />
      <h2 className="report-scope">
        {customer
          ? `${customer.company || customer.name} · waste & reports`
          : "Whole-business waste & reports"}
      </h2>
      <p className="panel-note">
        Waste is grouped by record date. Catering performance uses completed
        events in the selected period.
      </p>
      <Panel title="Waste checks to do">
        <p className="panel-note">
          A two-minute check after each event: leftovers per dish, plate waste,
          how many guests ate and where the food went. This feeds the client
          Wrapped.
        </p>
        <GridTable
          heads={["Event date", "Customer / order", "Booked guests", ""]}
          empty="All finished events in this period have a waste check."
          rows={due.slice(0, 8).map((o) => [
            o.details.date,
            `${s.customers.find((c) => c.id === o.customerId)?.company || o.details.name} · ${o.reference}`,
            o.details.attendees,
            <Button key="check" size="sm" onClick={() => setChecking(o)}>
              Check waste
            </Button>,
          ])}
        />
        {due.length > 8 && (
          <p className="panel-note">
            {due.length - 8} more events need a check.
          </p>
        )}
      </Panel>
      <WasteCheckDialog order={checking} onClose={() => setChecking(null)} />
      <div className="metric-grid">
        <Metric
          label="Measured waste"
          value={
            r.waste.length ? `${(r.weight / 1000).toFixed(2)} kg` : "No records"
          }
          detail={`${r.unmeasured} records without measured weight`}
        />
        <Metric
          label="Recorded waste allocation"
          value={money(r.cost)}
          detail="Breakdown of existing costs; not another expense"
        />
        <Metric
          label="Completed occasions"
          value={r.completed.length}
          detail={`${r.portions} portions · event dates`}
        />
        <Metric
          label="Unserved portions"
          value={r.unserved}
          detail={
            r.unservedRate === null
              ? "No completed portions to compare"
              : `${r.unservedRate.toFixed(1)}% of completed-event portions`
          }
        />
      </div>
      <Panel
        title="Waste register"
        action={
          <Button
            onClick={() =>
              open({
                title: "Log other waste",
                action: "waste",
                values: {
                  category: "unserved portions",
                  weightMeasured: "no",
                  unit: "portions",
                  date: today(),
                  orderId: filter.customerId ? r.completed[0]?.id || "" : "",
                },
                fields: [
                  {
                    key: "category",
                    label: "Waste category",
                    options: [
                      "preparation trimmings",
                      "spoilage",
                      "unserved portions",
                      "plate waste",
                    ],
                  },
                  {
                    key: "orderId",
                    label: "Order (optional only for business spoilage)",
                    options: [
                      { value: "", label: "Unassigned business spoilage" },
                      ...s.orders
                        .filter(
                          (o) =>
                            !filter.customerId ||
                            o.customerId === filter.customerId,
                        )
                        .map((o) => ({ value: o.id, label: o.reference })),
                    ],
                  },
                  {
                    key: "ingredientId",
                    label: "Ingredient",
                    options: [
                      { value: "", label: "Not applicable" },
                      ...s.ingredients.map((i) => ({
                        value: i.id,
                        label: i.name,
                      })),
                    ],
                  },
                  {
                    key: "recipeId",
                    label: "Recipe",
                    options: [
                      { value: "", label: "Not applicable" },
                      ...s.recipes.map((i) => ({ value: i.id, label: i.name })),
                    ],
                  },
                  {
                    key: "batchId",
                    label: "Batch (spoilage)",
                    options: [
                      { value: "", label: "Not applicable" },
                      ...s.batches.map((b) => ({
                        value: b.id,
                        label: `${s.ingredients.find((i) => i.id === b.ingredientId)?.name} · ${b.id.slice(0, 8)}`,
                      })),
                    ],
                  },
                  { key: "quantity", label: "Quantity wasted", type: "number" },
                  {
                    key: "unit",
                    label: "Unit",
                    options: ["g", "ml", "each", "portions"],
                  },
                  {
                    key: "weightGrams",
                    label: "Weight (g)",
                    type: "number",
                  },
                  {
                    key: "weightMeasured",
                    label: "Weight was measured (including zero)",
                    options: [
                      { value: "no", label: "Not measured" },
                      { value: "yes", label: "Measured" },
                    ],
                  },
                  {
                    key: "disposal",
                    label: "Where it went",
                    options: [
                      { value: "", label: "Not recorded" },
                      ...wasteDisposals.map((d) => ({
                        value: d,
                        label: disposalLabels[d],
                      })),
                    ],
                  },
                  { key: "date", label: "Waste date", type: "date" },
                  { key: "reason", label: "Observed reason", required: true },
                ],
              })
            }
          >
            Log other waste
          </Button>
        }
      >
        <GridTable
          heads={[
            "Date",
            "Customer / order",
            "Category",
            "Quantity",
            "Weight",
            "Cost allocation",
            "Went to",
            "Reason",
          ]}
          rows={r.waste.map((w) => {
            const o = s.orders.find((o) => o.id === w.orderId);
            return [
              w.date,
              o
                ? `${s.customers.find((c) => c.id === o.customerId)?.company || o.details.name} · ${o.reference}`
                : "Unassigned business stock",
              w.category,
              `${w.quantity} ${w.unit}`,
              (w.weightMeasured ?? w.weightGrams > 0)
                ? `${w.weightGrams} g`
                : "Not measured",
              money(w.cost),
              w.disposal
                ? disposalLabels[w.disposal as WasteDisposal]
                : "Not recorded",
              w.reason,
            ];
          })}
        />
        <p className="panel-note">
          Missing measurements are not zero waste. Unassigned stock losses
          remain in the whole-business view.
        </p>
      </Panel>
      <div className="ops-columns">
        <Panel title="Waste by category">
          <GridTable
            heads={["Category", "Records", "Measured kg", "Cost allocation"]}
            rows={r.categories.map((c) => [
              c.name,
              c.records,
              (c.grams / 1000).toFixed(2),
              money(c.cost),
            ])}
          />
        </Panel>
        <Panel title="Waste by month">
          <GridTable
            heads={["Month", "Records", "Measured kg"]}
            rows={[...new Set(r.waste.map((w) => w.date.slice(0, 7)))]
              .sort()
              .map((month) => {
                const rows = r.waste.filter((w) => w.date.startsWith(month));
                return [
                  month,
                  rows.length,
                  (rows.reduce((n, w) => n + w.weightGrams, 0) / 1000).toFixed(
                    2,
                  ),
                ];
              })}
          />
        </Panel>
      </div>
      <Panel title="Completed order history">
        <OrderTable orders={r.completed} />
      </Panel>
      <div className="ops-columns">
        <Panel title="Most ordered dishes">
          <GridTable
            heads={["Dish", "Portions"]}
            rows={r.popular.map((p) => [p.name, p.quantity])}
          />
        </Panel>
        <Panel title="Customer feedback">
          <p className="panel-note">
            Average:{" "}
            {r.averageFeedback === null
              ? "No feedback"
              : `${r.averageFeedback.toFixed(1)} / 5`}
          </p>
          <GridTable
            heads={["Date", "Rating", "Comment"]}
            rows={r.feedback.map((f) => [f.date, `${f.rating}/5`, f.comment])}
          />
        </Panel>
      </div>
      {customer && recap ? (
        <WrappedPanel recap={recap} />
      ) : (
        <Panel title="Client Wrapped">
          <p className="panel-note">
            Choose a customer above to build their Wrapped: a story-style recap
            of what they ate, what came back and where it went, ready to share
            by link or save as a PDF.
          </p>
          {mode === "sample" &&
            s.customers.some((c) => c.id === "sample-client-harbour") && (
              <div className="inline-actions">
                <Button
                  onClick={() =>
                    setFilter({
                      ...presetDates("twelve-months"),
                      customerId: "sample-client-harbour",
                      service: "all",
                    })
                  }
                >
                  <Sparkles size={15} /> See the example Wrapped
                </Button>
              </div>
            )}
        </Panel>
      )}
    </>
  );
}
function WrappedPanel({ recap }: { recap: ReturnType<typeof customerExport> }) {
  const { s, open, run, busy, mode } = useOps();
  const { filter } = useReportFilters();
  const customer = s.customers.find((c) => c.id === filter.customerId)!;
  const [note, setNote] = useState("");
  const [full, setFull] = useState(false);
  const [error, setError] = useState("");
  const story = useMemo(() => {
    try {
      return buildWrapped(s, filter, { note });
    } catch {
      return null;
    }
  }, [s, filter, note]);
  const shares = (s.wrapped || [])
    .filter((x) => x.customerId === customer.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const link = (id: string) =>
    typeof window === "undefined"
      ? `/wrapped/${id}`
      : `${window.location.origin}/wrapped/${id}`;
  const share = async () => {
    setError("");
    try {
      const next = await run("wrapped-share", {
        customerId: customer.id,
        from: filter.from,
        to: filter.to,
        service: filter.service,
        note,
      });
      const created = (next.wrapped || []).at(-1);
      if (created) {
        try {
          await navigator.clipboard.writeText(link(created.id));
        } catch {
          /* the link is listed below either way */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create the link");
    }
  };
  const email = (url: string) =>
    open({
      title: "Review Wrapped email",
      action: "draft",
      fields: draftFields,
      values: {
        customerId: customer.id,
        to: customer.email,
        subject: `Your ${story?.periodLabel || ""} Wrapped from ${story?.business || "us"}`,
        body: `Hello ${customer.name},\n\nYour ${story?.periodLabel} Wrapped is ready: a quick look back at the food we served your team, the favourites, and how little went to waste.\n\n${url}\n\nIt takes about a minute to tap through, and you can save it as a PDF at the end.\n\nThank you for having us,\n${story?.business}`,
      },
    });
  return (
    <Panel
      title={`Client Wrapped · ${customer.company || customer.name}`}
      action={
        story && story.occasions > 0 ? (
          <Button variant="outline" onClick={() => setFull(true)}>
            <Expand size={15} /> Full screen
          </Button>
        ) : undefined
      }
    >
      {!story || story.occasions === 0 ? (
        <p className="panel-note">
          No completed events for this customer in the selected period. Pick a
          longer period, such as year to date.
        </p>
      ) : (
        <div className="wrapped-admin">
          <WrappedStoryView story={story} variant="embed" />
          <div className="wrapped-admin-side">
            <div className="wrapped-quality">
              <Sparkles size={16} aria-hidden="true" />
              <p>
                <strong>
                  Waste checked at {story.coverage.checked} of{" "}
                  {story.coverage.events} events.
                </strong>{" "}
                {story.coverage.checked < story.coverage.events
                  ? "Unchecked events are left out of the enjoyed and waste slides, so complete their checks first for the fullest story."
                  : "Every event has data behind it."}
              </p>
            </div>
            <Field
              label="Personal note from the chef (optional)"
              value={note}
              onChange={setNote}
              wide
            />
            <p className="panel-note">
              The client sees only what is in the preview: no costs, suppliers
              or internal notes. A link is a frozen copy, so later edits do not
              change it. Create a new link to update.
            </p>
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="inline-actions">
              <Button onClick={share} disabled={busy}>
                <Link2 size={15} /> Create client link
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  exportCSV("em2-customer-recap.csv", [
                    [
                      "Customer",
                      "From",
                      "To",
                      "Occasions",
                      "Guests",
                      "Portions",
                      "Portions enjoyed %",
                      "Measured waste kg",
                      "Waste per guest g",
                      "Unserved portions",
                      "Unmeasured records",
                    ],
                    [
                      recap.customer,
                      recap.from,
                      recap.to,
                      story.occasions,
                      story.guests,
                      story.portions,
                      story.enjoyedRate ?? "",
                      story.measuredWasteKg ?? "",
                      story.wastePerGuestGrams ?? "",
                      recap.unservedPortions,
                      recap.unmeasuredRecords,
                    ],
                    ["Dish", "Portions"],
                    ...recap.popular.map((p) => [p.name, p.quantity]),
                  ])
                }
              >
                Export CSV
              </Button>
            </div>
            {mode === "sample" && (
              <p className="panel-note">
                You are in sample mode. Links only open publicly for live data.
              </p>
            )}
            {shares.length > 0 && (
              <GridTable
                heads={["Shared", "Period", "Status", ""]}
                rows={shares.map((x) => [
                  x.createdAt.slice(0, 10),
                  x.story.periodLabel,
                  x.revokedAt ? "Withdrawn" : "Live",
                  x.revokedAt ? (
                    ""
                  ) : (
                    <div key="actions" className="inline-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigator.clipboard.writeText(link(x.id))
                        }
                      >
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(link(x.id), "_blank")}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => email(link(x.id))}
                      >
                        Email
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Withdraw this link? The client will no longer be able to open it.",
                            )
                          )
                            void run("wrapped-revoke", { id: x.id });
                        }}
                      >
                        Withdraw
                      </Button>
                    </div>
                  ),
                ])}
              />
            )}
          </div>
        </div>
      )}
      {full &&
        story &&
        createPortal(
          <div
            className="wrapped-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Wrapped preview"
          >
            <WrappedStoryView story={story} onClose={() => setFull(false)} />
          </div>,
          document.body,
        )}
    </Panel>
  );
}
