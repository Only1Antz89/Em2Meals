"use client";
import { useOps, type Edit } from "./ops-context";
import { Panel, GridTable, Tag } from "./admin-client";
import { Button } from "@/components/ui/button";
import { type State, money, today } from "@/lib/domain";
import {
  costTypes,
  inPeriod,
  expenseCost,
  type ReportFilter,
  type Journey,
} from "@/lib/reporting";
import { defaultVehicle, fuelTypeLabels, costPerMile } from "@/lib/team-fleet";
import { updateQuery, useReportFilters } from "./report-controls";
import { ShiftsPanel, StaffPanel, VehiclesPanel } from "./team-fleet-panels";
const services = [
  { value: "shared", label: "Shared business" },
  { value: "private", label: "Private services" },
  { value: "corporate", label: "Corporate catering" },
];
export function expenseEditor(
  s: State,
  record?: State["finance"][number],
): Edit {
  return {
    title: record ? "Classify / edit expense" : "Record expense or labour",
    action: "expense",
    values: record
      ? {
          ...record,
          amount: record.amount,
          vatRate: record.net ? ((record.vat || 0) / record.net) * 100 : 0,
          priceMode: "inclusive",
          vatRecoverable: record.recoverableVAT ? "yes" : "no",
          service: record.service || "shared",
          incurredDate: record.incurredDate || record.date,
          paymentDate: record.paymentDate ?? record.date,
          status: record.status || "actual",
          costType: record.costType || "other",
        }
      : {
          service: "shared",
          orderId: "",
          purchaseId: "",
          incurredDate: today(),
          paymentDate: "",
          status: "actual",
          priceMode: "inclusive",
          vatRate: 0,
          vatRecoverable: "no",
          costType: "overhead",
        },
    fields: [
      { key: "description", label: "Description", required: true },
      { key: "costType", label: "Cost category", options: [...costTypes] },
      {
        key: "service",
        label: "Business side (order link takes precedence)",
        options: services,
      },
      {
        key: "orderId",
        label: "Related order",
        options: [
          { value: "", label: "No individual order" },
          ...s.orders.map((o) => ({ value: o.id, label: o.reference })),
        ],
      },
      {
        key: "purchaseId",
        label: "Supplier purchase (ingredient payments)",
        options: [
          { value: "", label: "No purchase link" },
          ...s.purchases.map((p) => ({
            value: p.id,
            label: `${s.suppliers.find((x) => x.id === p.supplierId)?.name} · ${s.ingredients.find((x) => x.id === p.ingredientId)?.name} · ${p.id.slice(0, 8)}`,
          })),
        ],
      },
      { key: "amount", label: "Cost (£)", type: "money" },
      {
        key: "priceMode",
        label: "Price entry",
        options: ["inclusive", "exclusive"],
      },
      { key: "vatRate", label: "VAT rate (%)", type: "number" },
      {
        key: "vatRecoverable",
        label: "Is this VAT recoverable?",
        options: ["no", "yes"],
      },
      { key: "incurredDate", label: "Cost incurred date", type: "date" },
      {
        key: "paymentDate",
        label: "Paid date (blank if unpaid)",
        type: "date",
      },
      {
        key: "status",
        label: "Cost certainty",
        options: ["actual", "estimated"],
      },
      {
        key: "hours",
        label:
          "Labour hours (optional; use Job assignments below to cost staff by the hour)",
        type: "number",
      },
    ],
    transform: (v) => ({ ...v, vatRecoverable: v.vatRecoverable === "yes" }),
  };
}
function journeyEditor(s: State, j?: Journey): Edit {
  return {
    title: j ? "Edit actual / estimated journey" : "Record journey",
    action: "journey",
    values: j
      ? {
          ...j,
          vehicleId: j.vehicleId || "",
          fuel:
            j.fuelCost === null || j.fuelEstimated
              ? ""
              : String(j.fuelCost / 100),
          paymentDate:
            s.finance.find((f) => f.journeyId === j.id)?.paymentDate || "",
        }
      : {
          date: today(),
          orderId: "",
          service: "shared",
          status: "actual",
          fuel: "",
          vehicleId: defaultVehicle(s)?.id || "",
          extraCost: 0,
          paymentDate: "",
          notes: "",
        },
    fields: [
      {
        key: "orderId",
        label: "Related order",
        options: [
          { value: "", label: "No individual order" },
          ...s.orders.map((o) => ({
            value: o.id,
            label: o.route
              ? `${o.reference} · route estimate ${Math.round(o.route.miles)} mi`
              : o.reference,
          })),
        ],
      },
      {
        key: "vehicleId",
        label: "Vehicle",
        options: [
          { value: "", label: "Not recorded" },
          ...s.vehicles
            .filter((v) => v.active || v.id === j?.vehicleId)
            .map((v) => ({
              value: v.id,
              label: `${v.name} (${fuelTypeLabels[v.fuelType]})`,
            })),
        ],
      },
      {
        key: "service",
        label: "Business side (order link takes precedence)",
        options: services,
      },
      { key: "date", label: "Journey date", type: "date" },
      {
        key: "status",
        label: "Journey certainty",
        options: ["actual", "estimated"],
      },
      {
        key: "miles",
        label: "Total miles (including return if driven)",
        type: "number",
      },
      { key: "minutes", label: "Total travel minutes", type: "number" },
      {
        key: "fuel",
        label: "Fuel cost from receipt (£; blank = estimate from vehicle)",
      },
      {
        key: "extraCost",
        label: "Parking, tolls and other travel charges (£)",
        type: "money",
      },
      {
        key: "paymentDate",
        label: "Paid date (blank if unpaid)",
        type: "date",
      },
      { key: "notes", label: "Route / receipt / notes", type: "textarea" },
    ],
    transform: (v) => ({
      ...v,
      fuelCost: v.fuel === "" ? null : Math.round(Number(v.fuel) * 100),
    }),
  };
}
const tabs = [
  ["team", "Team & hours"],
  ["travel", "Vehicles & journeys"],
  ["expenses", "Expenses"],
  ["checks", "Income & checks"],
] as const;
function withView(params: URLSearchParams, view: string) {
  const next = new URLSearchParams(params);
  next.set("view", view);
  return next.toString();
}
const plural = (n: number, one: string, many = one + "s") =>
  `${n} ${n === 1 ? one : many}`;
// Headline figures for the period, one card per tab.
function summary(
  s: State,
  f: ReportFilter,
  matches: (r: { orderId?: string; service?: string }) => boolean,
  finance: State["finance"],
  journeys: Journey[],
) {
  // Upcoming assignments count too, so planned labour is never hidden.
  const shifts = s.shifts.filter(
    (x) =>
      matches(x) &&
      (inPeriod(x.date, f) || (x.date > today() && x.date >= f.from)),
  );
  const worked = shifts.filter((x) => x.status === "worked");
  const planned = shifts.filter((x) => x.status === "planned");
  const workedCost = worked.reduce((n, x) => n + x.cost, 0);
  const plannedCost = planned.reduce((n, x) => n + x.cost, 0);
  const workedHours = worked.reduce((n, x) => n + x.hours, 0);
  const miles = journeys.reduce((n, j) => n + j.miles, 0);
  const travel = journeys.reduce(
    (n, j) => n + (j.fuelCost || 0) + j.extraCost,
    0,
  );
  const other = finance.filter(
    (x) =>
      x.type === "expense" &&
      !x.excluded &&
      !x.shiftId &&
      !x.journeyId &&
      x.costType !== "ingredients",
  );
  const otherCost = other.reduce((n, x) => n + expenseCost(x), 0);
  const unconfirmed = s.shifts.filter(
    (x) => matches(x) && x.status === "planned" && x.date < today(),
  ).length;
  const unlinked = finance.filter(
    (x) => x.type === "income" && !x.invoiceId && !x.excluded && !x.reconciliationNote,
  ).length;
  const legacy = finance.filter(
    (x) => !x.invoiceId && !x.costType && !x.reconciliationNote && !x.excluded,
  ).length;
  const vehicleSetup = s.vehicles.filter(
    (v) => v.active && costPerMile(v) === null,
  ).length;
  const toCheck = unconfirmed + unlinked + legacy + vehicleSetup;
  const checks = [
    unconfirmed && plural(unconfirmed, "shift") + " to confirm",
    unlinked && plural(unlinked, "payment") + " to link",
    legacy && plural(legacy, "old entry", "old entries") + " to classify",
    vehicleSetup && plural(vehicleSetup, "vehicle") + " missing MPG or price",
  ].filter(Boolean);
  return {
    toCheck,
    unconfirmed,
    vehicleSetup,
    cards: [
      {
        tab: "team",
        label: "Labour",
        value: money(workedCost + plannedCost),
        detail: `${Math.round(workedHours * 10) / 10}h worked${plannedCost ? ` · ${money(plannedCost)} still assigned` : ""}`,
        alert: false,
      },
      {
        tab: "travel",
        label: "Travel",
        value: money(travel),
        detail: miles
          ? `${Math.round(miles)} mi · ${plural(journeys.length, "trip")} · ${(travel / miles).toFixed(0)}p a mile`
          : "No journeys recorded",
        alert: false,
      },
      {
        tab: "expenses",
        label: "Other expenses",
        value: money(otherCost),
        detail: plural(other.length, "entry", "entries"),
        alert: false,
      },
      {
        tab: "checks",
        label: "Needs a look",
        value: String(toCheck),
        detail: checks.length ? checks.join(" · ") : "All tidy",
        alert: toCheck > 0,
      },
    ],
  };
}
export default function CostsTravel({ filter: f }: { filter: ReportFilter }) {
  const { s, open } = useOps();
  const { params } = useReportFilters();
  const matches = (r: { orderId?: string; service?: string }) => {
    const o = s.orders.find((o) => o.id === r.orderId);
    return (
      (!f.customerId || o?.customerId === f.customerId) &&
      (f.service === "all" || (o?.details.service || r.service) === f.service)
    );
  };
  const finance = s.finance.filter(
    (x) => matches(x) && inPeriod(x.incurredDate || x.date, f),
  );
  const journeys = s.journeys.filter((j) => matches(j) && inPeriod(j.date, f));
  const tab = tabs.some(([key]) => key === params.get("view"))
    ? params.get("view")!
    : "team";
  const sum = summary(s, f, matches, finance, journeys);
  return (
    <div className="costs-travel">
      <div className="cost-summary" role="list">
        {sum.cards.map((c) => (
          <button
            key={c.tab}
            type="button"
            role="listitem"
            className={"metric cost-card" + (c.tab === tab ? " active" : "") + (c.alert ? " alert" : "")}
            onClick={() => updateQuery({ view: c.tab })}
          >
            <span>{c.label}</span>
            <strong>{c.value}</strong>
            <small>{c.detail}</small>
          </button>
        ))}
      </div>
      <nav className="crm-tabs cost-tabs" aria-label="Costs and travel sections">
        {tabs.map(([key, label]) => (
          <a
            key={key}
            href={`?${withView(params, key)}`}
            className={tab === key ? "active" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              updateQuery({ view: key });
            }}
          >
            {label}
            {key === "checks" && sum.toCheck > 0 && (
              <span className="tab-count">{sum.toCheck}</span>
            )}
          </a>
        ))}
      </nav>
      {tab === "team" && (
        <>
          <ShiftsPanel filter={f} matches={matches} />
          <StaffPanel filter={f} />
        </>
      )}
      {tab === "travel" && (
        <>
          <VehiclesPanel filter={f} />
          <Panel
            title="Actual and estimated journeys"
            action={
              <Button onClick={() => open(journeyEditor(s))}>Record journey</Button>
            }
          >
            <GridTable
              heads={[
                "Date",
                "Order / service",
                "Vehicle",
                "Miles",
                "Minutes",
                "Fuel",
                "Other costs",
                "Status",
                "",
              ]}
              rows={journeys.map((j) => [
                j.date,
                s.orders.find((o) => o.id === j.orderId)?.reference || j.service,
                s.vehicles.find((v) => v.id === j.vehicleId)?.name || "—",
                j.miles,
                j.minutes,
                j.fuelCost === null
                  ? "Unknown"
                  : `${money(j.fuelCost)}${j.fuelEstimated ? " (est.)" : ""}`,
                money(j.extraCost),
                j.status,
                <Button
                  key="edit"
                  variant="outline"
                  onClick={() => open(journeyEditor(s, j))}
                >
                  Edit journey
                </Button>,
              ])}
            />
            <p className="panel-note">
              Actual journeys replace the order’s route estimate. Leave the fuel
              blank to price it from the vehicle’s MPG and fuel price. Journey costs
              create one linked expense record; don’t re-enter the same receipt as a
              separate expense. Multiple actual journeys are added together.
            </p>
          </Panel>
        </>
      )}
      {tab === "expenses" && (
        <>
          <Panel
            title="Expenses"
            action={
              <Button onClick={() => open(expenseEditor(s))}>
                Record expense
              </Button>
            }
          >
            <GridTable
              heads={[
                "Incurred / paid",
                "Description",
                "Business side",
                "Type",
                "Gross cost",
                "VAT recoverable",
                "Status",
                "",
              ]}
              empty="No other expenses in this period."
              rows={finance
                // Staff hours and journeys are managed on their own tabs.
                .filter((x) => x.type === "expense" && !x.shiftId && !x.journeyId)
                .map((x) => [
                  `${x.incurredDate || x.date} / ${(x.paymentDate ?? x.date) || "Unpaid"}`,
                  x.description,
                  s.orders.find((o) => o.id === x.orderId)?.details.service ||
                    x.service ||
                    "Unclassified",
                  x.costType || x.category,
                  money(x.amount),
                  x.recoverableVAT === undefined
                    ? "Unverified"
                    : money(x.recoverableVAT),
                  x.excluded ? "Excluded" : x.status || "Unclassified",
                  x.journeyId ? (
                    <span key="journey">Edit under Vehicles &amp; journeys</span>
                  ) : x.shiftId ? (
                    <span key="shift">Edit under Team &amp; hours</span>
                  ) : (
                    <Button
                      key="edit"
                      variant="outline"
                      onClick={() => open(expenseEditor(s, x))}
                    >
                      Classify / edit
                    </Button>
                  ),
                ])}
            />
            <p className="panel-note">
              Staff hours and journeys are costed on their own tabs, so they
              are not listed here. Shared overheads affect only the whole-business result. Order-linked
              costs inherit private/corporate attribution. Record supplier payments
              as ingredients: consumption is already costed through stock movements.
            </p>
          </Panel>
        </>
      )}
      {tab === "checks" && (
        <>
          {(sum.unconfirmed > 0 || sum.vehicleSetup > 0) && (
            <div className="check-list">
              {sum.unconfirmed > 0 && (
                <p>
                  {plural(sum.unconfirmed, "past shift is", "past shifts are")}{" "}
                  still waiting for hours to be confirmed.{" "}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateQuery({ view: "team" })}
                  >
                    Go to Team &amp; hours
                  </Button>
                </p>
              )}
              {sum.vehicleSetup > 0 && (
                <p>
                  {plural(sum.vehicleSetup, "vehicle has", "vehicles have")} no
                  MPG or fuel price, so trips can’t be priced.{" "}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateQuery({ view: "travel" })}
                  >
                    Go to Vehicles
                  </Button>
                </p>
              )}
            </div>
          )}
          <Panel title="Income and reconciliation">
            <GridTable
              heads={["Date", "Description", "Cash amount", "Link / status", ""]}
              rows={finance
                .filter((x) => x.type === "income")
                .map((x) => [
                  x.date,
                  x.description,
                  money(x.amount),
                  x.excluded
                    ? "Excluded"
                    : x.invoiceId
                      ? s.invoices.find((i) => i.id === x.invoiceId)?.number
                      : x.reconciliationNote || "Needs linking",
                  !x.invoiceId && !x.excluded ? (
                    <Button
                      key="link"
                      variant="outline"
                      onClick={() =>
                        open({
                          title: "Link existing income",
                          action: "income-link",
                          values: {
                            id: x.id,
                            orderId: x.orderId || "",
                            invoiceId: "",
                          },
                          fields: [
                            {
                              key: "invoiceId",
                              label: "Issued invoice (optional)",
                              options: [
                                { value: "", label: "No invoice" },
                                ...s.invoices
                                  .filter(
                                    (i) =>
                                      i.status === "issued" && i.kind === "invoice",
                                  )
                                  .map((i) => ({ value: i.id, label: i.number })),
                              ],
                            },
                            {
                              key: "orderId",
                              label: "Order (if no invoice)",
                              options: [
                                { value: "", label: "No order" },
                                ...s.orders.map((o) => ({
                                  value: o.id,
                                  label: o.reference,
                                })),
                              ],
                            },
                          ],
                        })
                      }
                    >
                      Link income
                    </Button>
                  ) : (
                    "—"
                  ),
                ])}
            />
          </Panel>
          <Panel title="Unreconciled legacy entries">
            <p className="panel-note">
              These records still count as recorded cash. Their treatment in
              profitability needs confirmation. Nothing is automatically linked or
              classified.
            </p>
            <GridTable
              heads={["Date", "Description", "Type", "Amount", ""]}
              rows={finance
                .filter(
                  (x) =>
                    !x.invoiceId &&
                    !x.costType &&
                    !x.reconciliationNote &&
                    !x.excluded,
                )
                .map((x) => [
                  x.date,
                  x.description,
                  x.type,
                  money(x.amount),
                  <div key="actions" className="inline-actions">
                    {x.type === "expense" && (
                      <Button
                        variant="outline"
                        onClick={() => open(expenseEditor(s, x))}
                      >
                        Classify expense
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() =>
                        open({
                          title: "Exclude confirmed duplicate / erroneous entry",
                          action: "finance-exclude",
                          values: { id: x.id },
                          fields: [
                            {
                              key: "reason",
                              label: "Reason this entry should be excluded",
                              required: true,
                            },
                          ],
                        })
                      }
                    >
                      Exclude with reason
                    </Button>
                  </div>,
                ])}
            />
            <Tag>Audit history is retained</Tag>
          </Panel>
        </>
      )}
    </div>
  );
}
