"use client";
import { useMemo } from "react";
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
import { customerExport, wasteReport } from "@/lib/reporting";
import { ReportControls, useReportFilters, exportCSV } from "./report-controls";
export default function WasteReports() {
  const { s, open } = useOps();
  const { filter, setFilter } = useReportFilters();
  const r = useMemo(() => wasteReport(s, filter), [s, filter]);
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
                title: "Record measured waste",
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
                  { key: "date", label: "Waste date", type: "date" },
                  { key: "reason", label: "Observed reason", required: true },
                ],
              })
            }
          >
            Log waste
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
      {recap && (
        <Panel title="Customer-facing catering recap">
          <div id="customer-recap" className="recap-card">
            <span className="eyebrow">FORK GOODNESS BAKED · YOUR CATERING RECAP</span>
            <h2>{recap.customer}</h2>
            <p>
              {recap.from} to {recap.to} ·{" "}
              {recap.service === "all" ? "All services" : recap.service}
            </p>
            <div className="report-metrics">
              <div>
                <strong>{recap.occasions}</strong>
                <span>occasions catered</span>
              </div>
              <div>
                <strong>{recap.portions}</strong>
                <span>portions prepared</span>
              </div>
              <div>
                <strong>{recap.measuredWasteKg.toFixed(2)} kg</strong>
                <span>measured waste</span>
              </div>
              <div>
                <strong>
                  {recap.feedback === null ? "—" : recap.feedback.toFixed(1)}
                </strong>
                <span>feedback / 5</span>
              </div>
            </div>
            <h3>Most ordered</h3>
            {recap.popular.map((p) => (
              <p key={p.name}>
                {p.name} · {p.quantity} portions
              </p>
            ))}
            <p>
              {recap.unservedPortions} unserved portions from completed events.{" "}
              {recap.unmeasuredRecords} waste records lack measured weight.
            </p>
            <small>
              Waste totals use waste-record dates; catering totals use event
              dates. Recorded leftovers do not establish customer preference.
            </small>
          </div>
          <div className="inline-actions">
            <Button variant="outline" onClick={() => window.print()}>
              Print customer recap
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
                    "Portions",
                    "Measured waste kg",
                    "Unmeasured records",
                    "Unserved portions",
                  ],
                  [
                    recap.customer,
                    recap.from,
                    recap.to,
                    recap.occasions,
                    recap.portions,
                    recap.measuredWasteKg,
                    recap.unmeasuredRecords,
                    recap.unservedPortions,
                  ],
                  ["Dish", "Portions"],
                  ...recap.popular.map((p) => [p.name, p.quantity]),
                ])
              }
            >
              Export customer CSV
            </Button>
            <Button
              onClick={() =>
                open({
                  title: "Review customer recap email",
                  action: "draft",
                  fields: draftFields,
                  values: {
                    customerId: customer!.id,
                    to: customer!.email,
                    subject: `Your Fork Goodness Baked recap · ${recap.from} to ${recap.to}`,
                    body: `Hello ${customer!.name},\n\nYour catering recap for ${recap.from} to ${recap.to}:\n${recap.occasions} completed occasions, ${recap.portions} portions.\n${recap.measuredWasteKg.toFixed(2)} kg measured waste (${recap.unmeasuredRecords} records unmeasured).\n${recap.unservedPortions} unserved portions from completed events.\n\nMost ordered:\n${recap.popular.map((p) => `${p.name}: ${p.quantity} portions`).join("\n")}\n\nFeedback: ${recap.feedback === null ? "None recorded" : recap.feedback.toFixed(1) + "/5"}.\nWaste uses record dates; catering uses event dates. These are recorded measurements, not a full waste audit.\n\nFork Goodness Baked`,
                  },
                })
              }
            >
              Prepare recap email
            </Button>
          </div>
        </Panel>
      )}
    </>
  );
}
