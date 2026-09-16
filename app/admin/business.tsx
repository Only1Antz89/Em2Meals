"use client";
import { useState } from "react";
import { useOps } from "./ops-context";
import { Panel, GridTable, Tag, Drafts } from "./admin-client";
import { Button } from "@/components/ui/button";
import { Field, Pick, Notes } from "@/components/form-controls";
import { money, today, type State } from "@/lib/domain";
import {
  proposals,
  draftCurrent,
  invoiceText,
  tax,
  type Proposal,
  type Invoice,
} from "@/lib/operations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
function proposalEmail(s: State, p: Proposal) {
  const sup = s.suppliers.find((x) => x.id === p.supplierId);
  return `Hello ${sup?.contactName || sup?.name},\n\nPlease confirm availability and delivery for these ingredients:\n\n${p.lines
    .map((l) => {
      const i = s.ingredients.find((i) => i.id === l.ingredientId)!;
      return `${i.name}: ${l.quantity} ${i.unit} (${l.packs} packs), required ${l.required.toFixed(2)} ${i.unit}; needed by ${l.eventDate}. Orders: ${l.orderIds.map((id) => s.orders.find((o) => o.id === id)?.reference).join(", ")}. Estimated net ${l.cost === null ? "unknown" : money(l.cost)}, VAT ${l.vat === null ? "unknown" : money(l.vat)}.`;
    })
    .join(
      "\n",
    )}\n\nEstimated delivery charge: ${money(p.delivery)}. Estimated total: ${p.total === null ? "incomplete — pricing/VAT to confirm" : money(p.total)}. Please confirm prices, VAT and delivery dates. This request is not yet a confirmed purchase.\n\nThank you,\nFork Goodness Baked`;
}
export default function Business({ tab }: { tab: string }) {
  const { s, run, open, href, busy } = useOps();
  const [error, setError] = useState(""),
    [draft, setDraft] = useState<{
      proposal: Proposal;
      id?: string;
      to: string;
      subject: string;
      body: string;
    } | null>(null),
    [invoice, setInvoice] = useState<Invoice | null>(null),
    [view, setView] = useState<string | null>(null),
    [confirm, setConfirm] = useState<{
      id: string;
      eta: string;
      lines: { ingredientId: string; quantity: number; cost: string }[];
    } | null>(null);
  const buying = proposals(s),
    currentInvoice = s.invoices.find((i) => i.id === view);
  async function action(type: string, p: unknown) {
    setError("");
    try {
      await run(type, p);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function prepare(p: Proposal, id?: string) {
    const sup = s.suppliers.find((x) => x.id === p.supplierId);
    if (!sup) return;
    setDraft({
      proposal: p,
      id,
      to: sup.email,
      subject: `Fork Goodness Baked — ingredient request for ${p.lines.map((l) => l.eventDate).sort()[0]}`,
      body: proposalEmail(s, p),
    });
  }
  return (
    <>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {tab === "purchasing" && (
        <>
          <Panel title="Purchasing for accepted orders">
            <p className="panel-note">
              Combined shortages after reservations and timely confirmed
              deliveries. Tentative enquiries are previewed on their order
              pages.
            </p>
            {buying.map((p) => {
              const sup = s.suppliers.find((x) => x.id === p.supplierId);
              const pending = s.drafts.find(
                (d) =>
                  d.supplierId === p.supplierId &&
                  d.proposal &&
                  !d.superseded &&
                  !d.purchaseConfirmed,
              );
              return (
                <article key={p.supplierId} className="purchase-proposal">
                  <div className="panel-heading">
                    <h3>{sup?.name || "Supplier assignment needed"}</h3>
                    <Button
                      disabled={busy || !sup || !!pending}
                      onClick={() => prepare(p)}
                    >
                      Draft supplier email
                    </Button>
                  </div>
                  <GridTable
                    heads={[
                      "Ingredient / orders",
                      "Needed",
                      "Buy",
                      "Estimated net / VAT",
                      "Order by / delivery",
                    ]}
                    rows={p.lines.map((l) => {
                      const i = s.ingredients.find(
                        (i) => i.id === l.ingredientId,
                      )!;
                      return [
                        <span key="cell-0">
                          {i.name}
                          <small className="subtext">
                            {l.orderIds.map((id) => (
                              <a key={id} href={href(`orders/${id}`)}>
                                {
                                  s.orders.find((o) => o.id === id)?.reference
                                }{" "}
                              </a>
                            ))}
                          </small>
                        </span>,
                        `${+l.required.toFixed(2)} ${i.unit}`,
                        `${l.packs} packs · ${l.quantity} ${i.unit}`,
                        `${l.cost === null ? "Unknown" : money(l.cost)} / ${l.vat === null ? "VAT unknown" : money(l.vat)}`,
                        <span key="cell-4">
                          Order by {l.deadline}
                          <small className="subtext">
                            ETA {l.eta}{" "}
                            <Tag tone={l.eta > l.eventDate ? "red" : ""}>
                              {l.eta > l.eventDate
                                ? "Late for event"
                                : "Estimated"}
                            </Tag>
                          </small>
                        </span>,
                      ];
                    })}
                  />
                  <p>
                    Delivery estimate: {money(p.delivery)} · Minimum order:{" "}
                    {money(p.minimum)} ·{" "}
                    <strong>
                      Total:{" "}
                      {p.total === null
                        ? "Awaiting price/VAT details"
                        : money(p.total)}
                    </strong>
                  </p>
                  {p.minimum >
                    p.lines.reduce((n, l) => n + (l.cost || 0), 0) && (
                    <Tag tone="amber">Minimum order may not be met</Tag>
                  )}
                  {pending && (
                    <p className="panel-note">
                      A request is already open below. Update it or resolve the
                      supplier response before creating another request.
                    </p>
                  )}
                </article>
              );
            })}
            {!buying.length && (
              <p className="empty-state">
                No accepted-order shortages need purchasing.
              </p>
            )}
            <a href={href("suppliers")}>
              Manage supplier options and receive purchases →
            </a>
          </Panel>
          <Panel title="Supplier requests & changes">
            <GridTable
              heads={["Supplier", "Status", "Proposal changes", ""]}
              rows={s.drafts
                .filter((d) => d.proposal && !d.superseded)
                .map((d) => {
                  const p = buying.find((p) => p.supplierId === d.supplierId);
                  const current = draftCurrent(s, d);
                  return [
                    s.suppliers.find((x) => x.id === d.supplierId)?.name,
                    <Tag
                      key="cell-1"
                      tone={
                        d.purchaseConfirmed ? "green" : !current ? "amber" : ""
                      }
                    >
                      {d.purchaseConfirmed
                        ? "Purchase confirmed"
                        : d.sentAt
                          ? "Sent — awaiting supplier"
                          : current
                            ? "Reviewed draft"
                            : "Needs updating"}
                    </Tag>,
                    !current ? (
                      <span>
                        {d.proposal!.lines.map((old) => {
                          const next = p?.lines.find(
                            (l) => l.ingredientId === old.ingredientId,
                          );
                          return (
                            <small className="subtext" key={old.ingredientId}>
                              {
                                s.ingredients.find(
                                  (i) => i.id === old.ingredientId,
                                )?.name
                              }
                              : {old.quantity} → {next?.quantity || 0}
                            </small>
                          );
                        })}
                        {p?.lines
                          .filter(
                            (l) =>
                              !d.proposal!.lines.some(
                                (old) => old.ingredientId === l.ingredientId,
                              ),
                          )
                          .map((l) => (
                            <small key={l.ingredientId} className="subtext">
                              Added:{" "}
                              {
                                s.ingredients.find(
                                  (i) => i.id === l.ingredientId,
                                )?.name
                              }{" "}
                              · {l.quantity}
                            </small>
                          ))}
                        <small className="subtext">
                          Prices, delivery or order links may also have changed;
                          review the full refreshed proposal.
                        </small>
                      </span>
                    ) : (
                      "Matches current demand"
                    ),
                    <div key="cell-3" className="inline-actions">
                      {!d.sentAt && p && !d.purchaseConfirmed && (
                        <Button size="sm" onClick={() => prepare(p, d.id)}>
                          Edit / refresh draft
                        </Button>
                      )}
                      {d.sentAt && !d.purchaseConfirmed && (
                        <Button
                          size="sm"
                          onClick={() =>
                            setConfirm({
                              id: d.id,
                              eta: d
                                .proposal!.lines.map((l) => l.eta)
                                .sort()[0],
                              lines: d.proposal!.lines.map((l) => ({
                                ingredientId: l.ingredientId,
                                quantity: l.quantity,
                                cost:
                                  l.cost === null
                                    ? ""
                                    : String((l.cost + (l.vat || 0)) / 100),
                              })),
                            })
                          }
                        >
                          Record supplier confirmation
                        </Button>
                      )}
                      {!d.purchaseConfirmed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            action("draft-close", { draftId: d.id })
                          }
                        >
                          {d.sentAt
                            ? "Close declined / cancelled request"
                            : "Discard draft"}
                        </Button>
                      )}
                    </div>,
                  ];
                })}
            />
            <p className="panel-note">
              Sent requests are retained. Record only quantities the supplier
              has confirmed. Additional shortages then appear as a new request.
              If a sent request needs replacing, confirm its cancellation with
              the supplier before closing it.
            </p>
          </Panel>
        </>
      )}
      {tab === "invoices" && (
        <>
          <Panel title="Invoices & credit notes">
            <GridTable
              heads={[
                "Document",
                "Order",
                "Status",
                "Net",
                "VAT",
                "Total / paid",
                "",
              ]}
              rows={s.invoices.map((i) => [
                i.number || "Draft invoice",
                s.orders.find((o) => o.id === i.orderId)?.reference,
                i.status,
                money(i.net),
                money(i.vat),
                `${money(i.total)} / ${money(i.paid)}`,
                <div key="cell-6" className="inline-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setView(i.id)}
                  >
                    View
                  </Button>
                  {i.status === "draft" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setInvoice(structuredClone(i))}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          action("invoice-issue", { invoiceId: i.id })
                        }
                      >
                        Issue
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          action("invoice-email", { invoiceId: i.id })
                        }
                      >
                        Draft email
                      </Button>
                      {i.kind === "invoice" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              open({
                                title: "Record invoice payment",
                                action: "invoice-payment",
                                values: { invoiceId: i.id, date: today() },
                                fields: [
                                  {
                                    key: "amount",
                                    label: "Payment (£)",
                                    type: "money",
                                  },
                                  {
                                    key: "reference",
                                    label: "Unique payment reference",
                                    required: true,
                                  },
                                  {
                                    key: "date",
                                    label: "Payment date",
                                    type: "date",
                                  },
                                ],
                              })
                            }
                          >
                            Record payment
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              action("invoice-credit", { invoiceId: i.id })
                            }
                          >
                            Credit note
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>,
              ])}
            />
            <p className="panel-note">
              Accepting an order creates an invoice draft. Complete billing and
              business details before issuing. Issued documents preserve their
              prices and VAT.
            </p>
          </Panel>
        </>
      )}
      <Panel title="Email drafts">
        <Drafts />
      </Panel>
      <Dialog
        open={!!draft}
        onOpenChange={(v) => {
          if (!v) setDraft(null);
        }}
      >
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>Review combined supplier request</DialogTitle>
            <DialogDescription>
              Check quantities, delivery dates, estimates, and the email before
              saving.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await run(draft.id ? "draft-replace" : "procurement-draft", {
                    draftId: draft.id,
                    supplierId: draft.proposal.supplierId,
                    to: draft.to,
                    subject: draft.subject,
                    body: draft.body,
                    fingerprint: draft.proposal.fingerprint,
                  });
                  setDraft(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Field
                label="To"
                type="email"
                required
                value={draft.to}
                onChange={(v) => setDraft({ ...draft, to: v })}
              />
              <Field
                label="Subject"
                required
                value={draft.subject}
                onChange={(v) => setDraft({ ...draft, subject: v })}
              />
              <Notes
                label="Email"
                value={draft.body}
                onChange={(v) => setDraft({ ...draft, body: v })}
              />
              {error && <p role="alert">{error}</p>}
              <Button disabled={busy}>Save reviewed draft</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v) setConfirm(null);
        }}
      >
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>Record supplier confirmation</DialogTitle>
            <DialogDescription>
              Use the agreed quantities and gross costs from the supplier’s
              response.
            </DialogDescription>
          </DialogHeader>
          {confirm && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (confirm.lines.some((l) => l.cost === ""))
                    throw Error("Enter every agreed cost");
                  await run("purchase-confirm", {
                    draftId: confirm.id,
                    eta: confirm.eta,
                    lines: confirm.lines
                      .filter((l) => l.quantity > 0)
                      .map((l) => ({
                        ...l,
                        cost: Math.round(Number(l.cost) * 100),
                      })),
                  });
                  setConfirm(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Field
                label="Confirmed delivery date"
                type="date"
                required
                value={confirm.eta}
                onChange={(eta) => setConfirm({ ...confirm, eta })}
              />
              {confirm.lines.map((l, index) => (
                <div key={l.ingredientId}>
                  <h3>
                    {s.ingredients.find((i) => i.id === l.ingredientId)?.name}
                  </h3>
                  <Field
                    label="Confirmed quantity (base units)"
                    type="number"
                    value={l.quantity}
                    onChange={(q) =>
                      setConfirm({
                        ...confirm,
                        lines: confirm.lines.map((x, j) =>
                          j === index ? { ...x, quantity: Number(q) } : x,
                        ),
                      })
                    }
                  />
                  <Field
                    label="Agreed gross cost (£)"
                    required
                    type="number"
                    step="0.01"
                    value={l.cost}
                    onChange={(cost) =>
                      setConfirm({
                        ...confirm,
                        lines: confirm.lines.map((x, j) =>
                          j === index ? { ...x, cost } : x,
                        ),
                      })
                    }
                  />
                </div>
              ))}
              {error && <p role="alert">{error}</p>}
              <Button disabled={busy}>Record confirmed purchase</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!invoice}
        onOpenChange={(v) => {
          if (!v) setInvoice(null);
        }}
      >
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>Edit invoice draft</DialogTitle>
            <DialogDescription>
              Choose inclusive or exclusive price entry for each line.
            </DialogDescription>
          </DialogHeader>
          {invoice && (
            <InvoiceEditor
              invoice={invoice}
              onChange={setInvoice}
              onSaved={() => setInvoice(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!view}
        onOpenChange={(v) => {
          if (!v) setView(null);
        }}
      >
        <DialogContent className="editor-dialog invoice-dialog">
          <DialogHeader>
            <DialogTitle>
              {currentInvoice?.number || "Invoice draft"}
            </DialogTitle>
            <DialogDescription>
              Print this document or save it as a PDF.
            </DialogDescription>
          </DialogHeader>
          {currentInvoice && (
            <>
              <pre className="invoice-print">
                {currentInvoice.status === "draft"
                  ? "DRAFT — NOT ISSUED\n\n"
                  : ""}
                {invoiceText(s, currentInvoice)}
              </pre>
              <Button onClick={() => window.print()}>Print / save PDF</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function InvoiceEditor({
  invoice: i,
  onChange: set,
  onSaved,
}: {
  invoice: Invoice;
  onChange: (v: Invoice) => void;
  onSaved: () => void;
}) {
  const { run, busy } = useOps();
  const [error, setError] = useState("");
  const fields = [
    ["customer", "Customer"],
    ["email", "Billing email"],
    ["billingAddress", "Billing address"],
    ["businessName", "Business name"],
    ["businessAddress", "Business address"],
    ["vatNumber", "VAT registration number"],
    ["paymentInstructions", "Payment instructions"],
    ["issueDate", "Issue date"],
    ["supplyDate", "Supply date"],
    ["dueDate", "Due date"],
  ] as const;
  const totals = i.lines.map((l) =>
    tax(Math.round(l.amount * l.quantity), l.vatRate, l.priceMode),
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await run("invoice-edit", { ...i, invoiceId: i.id });
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <div className="form-grid">
        {fields.map(([key, label]) => (
          <Field
            key={key}
            label={label}
            type={
              key.endsWith("Date") ? "date" : key === "email" ? "email" : "text"
            }
            value={i[key]}
            onChange={(v) => set({ ...i, [key]: v })}
          />
        ))}
      </div>
      {i.lines.map((l, index) => {
        const change = (v: Partial<typeof l>) =>
          set({
            ...i,
            lines: i.lines.map((x, j) => (j === index ? { ...x, ...v } : x)),
          });
        return (
          <div className="invoice-line" key={index}>
            <Field
              label="Description"
              value={l.description}
              onChange={(description) => change({ description })}
            />
            <div className="form-grid">
              <Field
                label="Quantity"
                type="number"
                step="any"
                value={l.quantity}
                onChange={(v) => change({ quantity: Number(v) })}
              />
              <Field
                label="Unit price (£)"
                type="number"
                step="0.01"
                value={l.amount / 100}
                onChange={(v) =>
                  change({ amount: Math.round(Number(v) * 100) })
                }
              />
              <Pick
                label="Price includes VAT?"
                value={l.priceMode}
                options={[
                  { value: "exclusive", label: "Add VAT" },
                  { value: "inclusive", label: "Includes VAT" },
                ]}
                onChange={(v) =>
                  change({ priceMode: v as "exclusive" | "inclusive" })
                }
              />
              <Field
                label="VAT rate (%)"
                type="number"
                step="any"
                value={l.vatRate}
                onChange={(v) => change({ vatRate: Number(v) })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={i.lines.length === 1}
              onClick={() =>
                set({ ...i, lines: i.lines.filter((_, j) => j !== index) })
              }
            >
              Remove line
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          set({
            ...i,
            lines: [
              ...i.lines,
              {
                description: "",
                quantity: 1,
                amount: 0,
                vatRate: 0,
                priceMode: "exclusive",
              },
            ],
          })
        }
      >
        Add line
      </Button>
      <p>
        Net {money(totals.reduce((n, t) => n + t.net, 0))} · VAT{" "}
        {money(totals.reduce((n, t) => n + t.vat, 0))} · Total{" "}
        {money(totals.reduce((n, t) => n + t.total, 0))}
      </p>
      {error && <p role="alert">{error}</p>}
      <Button disabled={busy}>Save invoice draft</Button>
    </form>
  );
}
