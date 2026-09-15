"use client";
import { useOps, type Edit } from "./ops-context";
import { Panel, GridTable, Tag } from "./admin-client";
import { Button } from "@/components/ui/button";
import { type State, money, today } from "@/lib/domain";
import {
  costTypes,
  inPeriod,
  type ReportFilter,
  type Journey,
} from "@/lib/reporting";
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
        label: "Labour hours (optional; total cost entered above)",
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
          fuel: j.fuelCost === null ? "" : String(j.fuelCost / 100),
          paymentDate:
            s.finance.find((f) => f.journeyId === j.id)?.paymentDate || "",
        }
      : {
          date: today(),
          orderId: "",
          service: "shared",
          status: "actual",
          fuel: "",
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
          ...s.orders.map((o) => ({ value: o.id, label: o.reference })),
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
      { key: "fuel", label: "Fuel cost (£; blank if unknown)" },
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
export default function CostsTravel({ filter: f }: { filter: ReportFilter }) {
  const { s, open } = useOps();
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
  return (
    <>
      <Panel
        title="Costs & labour"
        action={
          <Button onClick={() => open(expenseEditor(s))}>
            Record expense / labour
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
          rows={finance
            .filter((x) => x.type === "expense")
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
                <span key="journey">Edit journey below</span>
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
          Shared overheads affect only the whole-business result. Order-linked
          costs inherit private/corporate attribution. Record supplier payments
          as ingredients: consumption is already costed through stock movements.
        </p>
      </Panel>
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
            j.miles,
            j.minutes,
            j.fuelCost === null ? "Unknown" : money(j.fuelCost),
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
          Actual journeys replace the order’s route estimate. Journey costs
          create one linked expense record; don’t re-enter the same receipt as a
          separate expense. Multiple actual journeys are added together.
        </p>
      </Panel>
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
  );
}
