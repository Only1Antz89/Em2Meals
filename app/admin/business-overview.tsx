"use client";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useOps } from "./ops-context";
import { Panel, GridTable, Metric, OrderTable, Tag } from "./admin-client";
import { Button } from "@/components/ui/button";
import { Pick } from "@/components/form-controls";
import { money } from "@/lib/domain";
import {
  businessReport,
  monthlyTrends,
  previousPeriod,
  type ReportFilter,
} from "@/lib/reporting";
import { exportCSV, updateQuery } from "./report-controls";
type RankRow = {
  id: string;
  name: string;
  count: number;
  value: number;
  detail: string;
  orderIds?: string[];
  purchaseIds?: string[];
};
const pounds = (n: number) =>
  `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
function ChartFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="analytics-chart" role="img" aria-label={title}>
      {children}
    </div>
  );
}
export default function BusinessOverview({
  filter: f,
  params,
}: {
  filter: ReportFilter;
  params: URLSearchParams;
}) {
  const { s, href } = useOps();
  const b = useMemo(() => businessReport(s, f), [s, f]),
    previous = useMemo(() => businessReport(s, previousPeriod(f)), [s, f]),
    trend = useMemo(() => monthlyTrends(s, f), [s, f]);
  const [sort, setSort] = useState("value"),
    [page, setPage] = useState(0);
  const tabs = [
    "customers",
    "suppliers",
    "ingredients",
    "locations",
    "industries",
    "events",
  ];
  const detail = tabs.includes(params.get("detail") || "")
      ? params.get("detail")!
      : "customers",
    focus = params.get("focus") || "";
  const warningTotal = Object.values(b.warnings).reduce((n, x) => n + x, 0);
  const costs = [
    { name: "Ingredients", cost: b.ingredientCost / 100 },
    { name: "Labour", cost: b.labour / 100 },
    { name: "Travel", cost: b.travel / 100 },
    { name: "Operating costs", cost: b.operating / 100 },
    { name: "Stock losses", cost: b.losses / 100 },
  ];
  const comparison = (current: number, prior: number) =>
    prior === 0
      ? `Previous period: ${money(prior)}`
      : `${(((current - prior) / Math.abs(prior)) * 100).toFixed(1)}% vs previous period (${money(prior)})`;
  let rows: RankRow[] = [];
  if (detail === "customers")
    rows = b.customers.map((c) => ({
      id: c.id,
      name: c.name,
      count: c.jobs,
      value: c.revenue,
      detail: `Average ${money(c.average)} · ${c.repeat ? "Repeat" : "First completed booking"} · last ${c.last || "—"} · feedback ${c.feedback?.toFixed(1) || "—"}/5 · waste ${(c.waste / 1000).toFixed(2)} kg`,
      orderIds: c.orders,
    }));
  if (detail === "suppliers")
    rows = b.suppliers.map((c) => ({
      id: c.id,
      name: c.name,
      count: c.orders,
      value: c.spend,
      detail: `${c.ingredients} ingredients · ${c.outstanding} outstanding lines · ${c.overdue} overdue`,
      purchaseIds: c.purchaseIds,
    }));
  if (detail === "ingredients")
    rows = b.ingredients.map((c) => ({
      id: c.id,
      name: c.name,
      count: c.purchased,
      value: c.spend,
      detail: `Purchased ${c.purchased} ${c.unit} · used ${c.used.toFixed(2)} ${c.unit} · consumption ${money(c.consumptionCost)} · price change ${c.priceChange === null ? "not enough comparable history" : c.priceChange.toFixed(1) + "%"} · waste ${(c.waste / 1000).toFixed(2)} kg`,
      purchaseIds: b.purchases
        .filter((p) => p.ingredientId === c.id)
        .map((p) => p.id),
    }));
  if (["locations", "industries", "events"].includes(detail))
    rows = (
      detail === "locations"
        ? b.places
        : detail === "industries"
          ? b.sectors
          : b.events
    ).map((c) => ({
      id: c.name,
      name: c.name,
      count: c.jobs,
      value: c.revenue,
      detail: `${c.miles.toFixed(1)} miles · ${money(c.travel)} travel cost`,
      orderIds: c.orders,
    }));
  rows.sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "value"
        ? b.value - a.value
        : b.count - a.count,
  );
  const selected = rows.find((r) => r.id === focus),
    current = Math.min(page, Math.max(0, Math.ceil(rows.length / 10) - 1));
  return (
    <>
      <div className="analytics-intro">
        <div>
          <span className="eyebrow">BUSINESS OPERATIONS</span>
          <h2>Know where your business is growing.</h2>
          <p>
            {f.from} — {f.to} ·{" "}
            {f.customerId
              ? s.customers.find((c) => c.id === f.customerId)?.company ||
                s.customers.find((c) => c.id === f.customerId)?.name
              : "Whole business"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            exportCSV("em2-business-summary.csv", [
              ["Metric", "Value (£)"],
              ["Invoiced sales excluding VAT", b.salesNet / 100],
              ["Invoice VAT", b.vat / 100],
              ["Invoiced sales including VAT", b.salesGross / 100],
              ["Cash received", b.cashIn / 100],
              ["Cash paid", b.cashOut / 100],
              ["Gross profit (completed jobs)", b.grossProfit / 100],
              ["Operating result before tax", b.netProfit / 100],
              ["Data quality issues", warningTotal],
            ])
          }
        >
          Export internal summary
        </Button>
      </div>
      <div className="metric-grid">
        <Metric
          label="Invoiced sales · excluding VAT"
          value={money(b.salesNet)}
          detail={comparison(b.salesNet, previous.salesNet)}
        />
        <Metric
          label="Invoice totals · including VAT"
          value={money(b.salesGross)}
          detail={`${money(b.vat)} VAT · credits ${money(b.credits)}`}
        />
        <Metric
          label="Cash received"
          value={money(b.cashIn)}
          detail={comparison(b.cashIn, previous.cashIn)}
        />
        <Metric
          label="Outstanding invoices"
          value={money(b.unpaid)}
          detail={`${money(b.overdue)} overdue · as of ${f.to}`}
        />
      </div>
      <Panel
        title="Completed-job profitability"
        action={
          <Tag tone={warningTotal ? "amber" : "green"}>
            {warningTotal ? "Estimated / incomplete costs" : "Recorded costs"}
          </Tag>
        }
      >
        <div className="profit-summary">
          <div>
            <span>Gross profit</span>
            <strong>{money(b.grossProfit)}</strong>
            <small>
              {b.grossMargin === null
                ? "No completed revenue"
                : `${b.grossMargin.toFixed(1)}% gross margin`}
            </small>
          </div>
          <div>
            <span>
              {f.customerId
                ? "Customer result after linked costs"
                : f.service !== "all"
                  ? "Service result before shared overhead"
                  : "Net operating profit · before tax"}
            </span>
            <strong>{money(b.netProfit)}</strong>
            <small>{comparison(b.netProfit, previous.netProfit)}</small>
          </div>
          <div>
            <span>Cash balance change</span>
            <strong>{money(b.cashChange)}</strong>
            <small>
              {money(b.cashIn)} received − {money(b.cashOut)} paid
            </small>
          </div>
        </div>
        <GridTable
          heads={[
            "Completed-job revenue",
            "Ingredients",
            "Direct labour",
            "Direct travel",
            "Operating expenses",
            "Shared portion",
            "Stock losses",
          ]}
          rows={[
            [
              money(b.revenue),
              money(b.ingredientCost),
              b.warnings.missingLabour
                ? `${money(b.labour)} recorded · incomplete`
                : money(b.labour),
              money(b.travel),
              money(b.operating),
              money(b.shared),
              money(b.losses),
            ],
          ]}
        />
        <p className="panel-note">
          Profitability uses completed event dates and incurred operating
          expenses. Sales use invoice issue dates; cash uses payment dates.
          Shared costs are included once, only in the whole-business result.
        </p>
        {warningTotal > 0 && (
          <details className="data-quality" open>
            <summary>Data coverage and estimates</summary>
            <ul>
              {b.warnings.revenueEstimates > 0 && (
                <li>
                  {b.warnings.revenueEstimates} completed jobs use accepted
                  quotes because no invoice is issued.
                </li>
              )}
              {b.warnings.ingredientEstimates > 0 && (
                <li>
                  {b.warnings.ingredientEstimates} jobs use historical
                  ingredient estimates.
                </li>
              )}
              {b.warnings.missingLabour > 0 && (
                <li>
                  {b.warnings.missingLabour} jobs have no labour cost recorded.
                </li>
              )}
              {b.warnings.estimatedLabour > 0 && (
                <li>
                  {b.warnings.estimatedLabour} jobs include estimated labour.
                </li>
              )}
              {b.warnings.estimatedTravel > 0 && (
                <li>
                  {b.warnings.estimatedTravel} jobs have estimated or unrecorded
                  travel.
                </li>
              )}
              {b.warnings.missingFuel > 0 && (
                <li>
                  {b.warnings.missingFuel} jobs have no confirmed fuel cost.
                </li>
              )}
              {b.warnings.unclassified > 0 && (
                <li>
                  {b.warnings.unclassified} legacy finance entries need
                  reconciliation.
                </li>
              )}
              {b.warnings.undatedPurchases > 0 && (
                <li>
                  {b.warnings.undatedPurchases} legacy purchases have no
                  ordering date and are omitted from period purchase rankings.
                </li>
              )}
              {b.warnings.estimatedOperating > 0 && (
                <li>
                  {b.warnings.estimatedOperating} operating costs or journeys
                  are estimates.
                </li>
              )}
              {b.warnings.unknownLossCost > 0 && (
                <li>
                  {b.warnings.unknownLossCost} historical stock losses lack a
                  cost link.
                </li>
              )}
            </ul>
          </details>
        )}
      </Panel>
      <div className="analytics-charts">
        <Panel title="Invoiced sales and cash received">
          <ChartFrame title="Monthly sales excluding VAT and cash received in pounds; table follows">
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <LineChart data={trend}>
                <Legend />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={pounds} width={72} />
                <Tooltip />
                <Line
                  name="Sales ex VAT (£)"
                  type="linear"
                  dataKey="sales"
                  stroke="#244c3b"
                  strokeWidth={3}
                  isAnimationActive={false}
                />
                <Line
                  name="Cash received (£)"
                  type="linear"
                  dataKey="cash"
                  stroke="#b17a36"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
          <details>
            <summary>View chart values</summary>
            <GridTable
              heads={["Month", "Sales ex VAT", "Cash received"]}
              rows={trend.map((t) => [
                t.month,
                money(t.sales * 100),
                money(t.cash * 100),
              ])}
            />
          </details>
        </Panel>
        <Panel title="Private versus corporate">
          <ChartFrame title="Completed jobs by service type; table follows">
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <BarChart data={b.segments}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="service" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  name="Completed jobs"
                  dataKey="jobs"
                  label={{ position: "top" }}
                  fill="#244c3b"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <GridTable
            heads={[
              "Service",
              "Jobs / share",
              "Revenue",
              "Direct costs",
              "Attributable expenses",
              "Contribution",
              "Repeat customers",
            ]}
            rows={b.segments.map((x) => [
              <button
                key="service"
                className="table-link"
                onClick={() => updateQuery({ service: x.service })}
              >
                {x.service}
              </button>,
              `${x.jobs} / ${x.share.toFixed(1)}%`,
              money(x.revenue),
              money(x.direct),
              money(x.operating),
              money(x.contribution),
              x.repeatCustomers,
            ])}
          />
          <p className="panel-note">
            Contribution excludes shared business overheads.
          </p>
        </Panel>
        <Panel title="Where costs go">
          <ChartFrame title="Completed-job direct costs and period operating costs in pounds; table follows">
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <BarChart data={costs} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={pounds} />
                <YAxis type="category" dataKey="name" width={108} />
                <Tooltip />
                <Bar
                  name="Cost (£)"
                  dataKey="cost"
                  fill="#ad7c44"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <details>
            <summary>View cost values</summary>
            <GridTable
              heads={["Category", "Cost"]}
              rows={costs.map((c) => [c.name, money(c.cost * 100)])}
            />
          </details>
        </Panel>
        <Panel title="Measured waste over time">
          <ChartFrame title="Measured waste in kilograms by record month; unmeasured waste is not included">
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis unit=" kg" />
                <Tooltip />
                <Bar
                  name="Measured waste (kg)"
                  dataKey="waste"
                  fill="#6d8c71"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <details>
            <summary>View waste values</summary>
            <GridTable
              heads={["Month", "Measured kg"]}
              rows={trend.map((t) => [t.month, t.waste.toFixed(2)])}
            />
          </details>
          <a
            href={`${href("reports")}&from=${f.from}&to=${f.to}&customer=${encodeURIComponent(f.customerId)}&service=${f.service}`}
          >
            Open waste report →
          </a>
        </Panel>
      </div>
      <Panel title="Customers, suppliers and markets">
        <Pick
          label="Rank by"
          value={sort}
          onChange={(v) => {
            setSort(v);
            setPage(0);
          }}
          options={[
            {
              value: "count",
              label:
                detail === "ingredients"
                  ? "Quantity (within each unit)"
                  : "Bookings / purchase count",
            },
            { value: "value", label: "Revenue / spend" },
            { value: "name", label: "Name" },
          ]}
        />
        {detail === "ingredients" && (
          <p className="panel-note">
            Ingredient quantities have different units. Use spend to compare
            across ingredients.
          </p>
        )}
        <GridTable
          heads={[
            "Name",
            detail === "ingredients" ? "Quantity" : "Count",
            ["suppliers", "ingredients"].includes(detail)
              ? "Purchase spend (gross)"
              : "Net revenue",
            "Details",
          ]}
          rows={rows.slice(current * 10, current * 10 + 10).map((r) => [
            <button
              key="name"
              className="table-link"
              onClick={() => updateQuery({ focus: r.id })}
            >
              {r.name}
            </button>,
            r.count,
            money(r.value),
            r.detail,
          ])}
        />
        <div className="recipe-pagination">
          <Button
            variant="outline"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span>
            {rows.length} records · page {current + 1}
          </span>
          <Button
            variant="outline"
            disabled={(current + 1) * 10 >= rows.length}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
        {selected && (
          <div className="analytics-drilldown">
            <h3>{selected.name} · source records</h3>
            {selected.orderIds && (
              <OrderTable
                orders={s.orders.filter((o) =>
                  selected.orderIds!.includes(o.id),
                )}
              />
            )}{" "}
            {selected.purchaseIds && (
              <GridTable
                heads={["Purchase", "Date", "Ingredient", "Quantity", "Cost"]}
                rows={s.purchases
                  .filter((p) => selected.purchaseIds!.includes(p.id))
                  .map((p) => [
                    p.requestId || p.id,
                    p.at?.slice(0, 10) || "Date unknown",
                    s.ingredients.find((i) => i.id === p.ingredientId)?.name ||
                      "Unknown",
                    p.quantity,
                    money(p.cost),
                  ])}
              />
            )}{" "}
            {detail === "customers" && (
              <a
                href={`${href("reports")}&customer=${encodeURIComponent(selected.id)}&from=${f.from}&to=${f.to}&service=${f.service}`}
              >
                Customer waste and catering recap →
              </a>
            )}
          </div>
        )}
      </Panel>
      <div className="ops-columns">
        <Panel title="Travel performance">
          <GridTable
            heads={[
              "Mileage",
              "Travel time",
              "Fuel",
              "Parking / tolls",
              "Travel cost per completed job",
            ]}
            rows={[
              [
                `${b.actualMiles.toFixed(1)} actual / ${b.estimatedMiles.toFixed(1)} estimated miles`,
                `${b.minutes.toFixed(0)} minutes`,
                b.warnings.missingFuel
                  ? `${money(b.fuel)} recorded · incomplete`
                  : money(b.fuel),
                money(b.extras),
                b.jobs.length
                  ? money(Math.round(b.travel / b.jobs.length))
                  : "No completed jobs",
              ],
            ]}
          />
          <GridTable
            heads={["Order", "Mileage", "Fuel", "Other", "Basis"]}
            rows={b.jobs.map((j) => [
              j.order.reference,
              j.miles.toFixed(1),
              j.missingFuel ? "Unknown / partial" : money(j.fuel),
              money(j.extra),
              `${j.estimatedMileage ? "Estimated miles" : "Actual miles"} · ${j.estimatedTravel ? "Estimated / missing cost" : "Actual cost"}`,
            ])}
          />
        </Panel>
        <Panel title="Pipeline and upcoming work">
          <p>
            {b.enquiries} enquiries / quotes · {b.cancellations} cancelled /
            declined events in period
          </p>
          <p>
            <strong>
              {b.bookings.length} upcoming accepted bookings ·{" "}
              {money(b.bookingValue)} quoted net value
            </strong>
          </p>
          <OrderTable orders={b.bookings} />
          <p className="panel-note">
            Upcoming bookings show all future accepted work for the selected
            customer and service, outside the historical reporting period.
          </p>
        </Panel>
      </div>
    </>
  );
}
