"use client";
import { OrderStock, OrderVenue } from "./operations-panels";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Field, Notes, Pick } from "@/components/form-controls";
import { Panel, GridTable, Tag, draftFields } from "./admin-client";
import { useOps } from "./ops-context";
import { money, recipeCost, needs, stages, type Order } from "@/lib/domain";
export default function OrderPanel({ orderId }: { orderId: string }) {
  const { s, run, api, href, busy, open, integrations } = useOps();
  const o = s.orders.find((x) => x.id === orderId);
  const [error, setError] = useState(""),
    [analysisError, setAnalysisError] = useState(""),
    [cancel, setCancel] = useState(false),
    [edit, setEdit] = useState<Order | null>(null),
    [review, setReview] = useState<any[] | null>(null),
    [reviewConfirmed, setReviewConfirmed] = useState(false);
  if (!o)
    return (
      <Panel title="Order not found">
        <a href={href("orders")}>Back to orders</a>
      </Panel>
    );
  const order = o;
  const safe = async (fn: () => Promise<any>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const suggestedMeals =
    (
      o.analysis as
        | { meals?: { recipeId?: string; quantity?: number | null }[] }
        | undefined
    )?.meals || [];
  const editable = ["enquiry", "quote"].includes(o.status);
  const required = needs(s, o);
  const quote = o.quotes.at(-1);
  const net = quote?.net || 0;
  const cost =
    o.costSnapshot?.total ??
    o.items.reduce(
      (sum, l) =>
        sum +
        Math.round(recipeCost(s, s.recipes.find((r) => r.id === l.recipeId)!)) *
          l.quantity,
      0,
    );
  const next =
    o.status === "confirmed" || o.status === "ingredients needed"
      ? "ingredients ready"
      : stages[stages.indexOf(o.status as any) + 1];
  return (
    <>
      <a className="back-link" href={href("orders")}>
        ← Enquiries & orders
      </a>
      <div className="order-title">
        <div>
          <span className="eyebrow">{o.reference}</span>
          <h2>{o.details.company || o.details.name}</h2>
          <p>
            {o.details.eventType} · {o.details.attendees} guests ·{" "}
            {o.details.date || "Date to confirm"}
          </p>
        </div>
        <Tag>{o.status}</Tag>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="order-actions">
        {editable && (
          <>
            <Button
              variant="outline"
              onClick={() => setEdit(structuredClone(o))}
            >
              Edit order & meals
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setReview(o.details.requirements.map((r) => ({ ...r })));
                setReviewConfirmed(false);
              }}
            >
              Review dietary requirements
            </Button>
            <Button
              onClick={() =>
                open({
                  title: "Prepare quote",
                  action: "quote",
                  values: {
                    orderId: o.id,
                    net:
                      (quote?.priceMode === "inclusive"
                        ? quote.total
                        : quote?.net) || 0,
                    priceMode:
                      quote?.priceMode || s.settings.priceMode || "exclusive",
                    notes: "",
                  },
                  fields: [
                    {
                      key: "net",
                      label: "Quote amount (£)",
                      type: "money",
                    },
                    {
                      key: "priceMode",
                      label: "Price entry",
                      options: [
                        { value: "exclusive", label: "Add VAT" },
                        { value: "inclusive", label: "Includes VAT" },
                      ],
                    },
                    {
                      key: "notes",
                      label: "Menu, service and quote notes",
                      type: "textarea",
                    },
                  ],
                })
              }
            >
              Prepare quote
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                safe(() => run("stage", { orderId: o.id, status: "declined" }))
              }
            >
              Decline enquiry
            </Button>
            {o.status === "quote" && (
              <Button
                disabled={busy}
                onClick={() =>
                  safe(() =>
                    run("stage", { orderId: o.id, status: "confirmed" }),
                  )
                }
              >
                Record acceptance
              </Button>
            )}
          </>
        )}
        {!editable &&
          !["delivered", "cancelled", "declined"].includes(o.status) && (
            <Button
              disabled={busy}
              onClick={() =>
                safe(() => run("stage", { orderId: o.id, status: next }))
              }
            >
              Mark {next}
            </Button>
          )}
        {!["cancelled", "declined", "delivered"].includes(o.status) && (
          <Button variant="ghost" onClick={() => setCancel(true)}>
            Cancel order
          </Button>
        )}
      </div>
      <div className="stage-track">
        {stages.map((status, i) => (
          <div
            className={i <= stages.indexOf(o.status as any) ? "reached" : ""}
            key={status}
          >
            <span>{i + 1}</span>
            <small>{status}</small>
          </div>
        ))}
      </div>
      <div className="ops-columns">
        <Panel title="The occasion">
          <dl className="settings-list">
            <div>
              <dt>Contact</dt>
              <dd>
                {o.details.name} · {o.details.email}
                <br />
                {o.details.phone}
              </dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>
                {o.details.venue || "To confirm"}
                <br />
                {o.details.address} {o.details.postcode}
              </dd>
            </div>
            <div>
              <dt>Timing</dt>
              <dd>
                Food arrival: {o.details.arrivalTime || "To confirm"}
                <br />
                Event start: {o.details.eventTime || "To confirm"}
              </dd>
            </div>
            <div>
              <dt>Requested food</dt>
              <dd>{o.details.requests || "To discuss"}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{o.details.access || "To confirm"}</dd>
            </div>
            <div>
              <dt>Outstanding details</dt>
              <dd>{o.details.unknownDetails || "None recorded"}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Quote & order economics">
          <div className="order-cost">
            <div>
              <span>Latest quote before VAT</span>
              <strong>{quote ? money(net) : "Not quoted"}</strong>
            </div>
            <div>
              <span>
                Ingredient cost{" "}
                {o.costSnapshot ? "(confirmed snapshot)" : "(estimate)"}
              </span>
              <strong>{money(cost)}</strong>
            </div>
            <div>
              <span>Contribution before labour, travel & overhead</span>
              <strong>{quote ? money(net - cost) : "—"}</strong>
            </div>
          </div>
          <GridTable
            heads={["Version", "Net", "VAT rate", "VAT amount", "Total"]}
            rows={o.quotes.map((q) => [
              q.version,
              money(q.net),
              `${q.vatRate}%`,
              money(q.total - q.net),
              money(q.total),
            ])}
          />
          {quote && (
            <div className="panel-note">
              <p>{quote.notes}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  open({
                    title: "Review quote email",
                    action: "draft",
                    fields: draftFields,
                    values: {
                      customerId: o.customerId,
                      to: o.details.email,
                      subject: `Fork Goodness Baked quote ${o.reference} · version ${quote.version}`,
                      body: `Hello ${o.details.name},\n\nThank you for your enquiry. Here is our quote for ${o.details.eventType} on ${o.details.date || "a date to confirm"}:\n\n${o.items.map((i) => `${s.recipes.find((r) => r.id === i.recipeId)?.name} · ${s.recipes.find((r) => r.id === i.recipeId)?.variant}: ${i.quantity} portions`).join("\n")}\n\n${quote.notes}\n\nBefore VAT: ${money(quote.net)}\nVAT: ${money(quote.total - quote.net)} (${quote.vatRate}%)\nTotal: ${money(quote.total)}\n\nPlease reply to confirm the details and discuss any outstanding dietary or access requirements. Your booking is subject to our confirmation.\n\nFork Goodness Baked`,
                    },
                  })
                }
              >
                Prepare quote email
              </Button>
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Meals & ingredient breakdown">
        <GridTable
          heads={["Dish / variant", "Quantity", "Per portion", "Total"]}
          rows={o.items.map((item) => {
            const r = s.recipes.find((r) => r.id === item.recipeId)!;
            const snap = o.costSnapshot?.items.find((i) => i.recipeId === r.id);
            const unit = snap?.unitCost ?? Math.round(recipeCost(s, r));
            return [
              <details key="cell-0">
                <summary>
                  <b>{snap?.name || `${r.name} · ${r.variant}`}</b>
                </summary>
                <ul className="ingredient-breakdown">
                  {(
                    snap?.lines ||
                    r.lines.map((l) => {
                      const i = s.ingredients.find(
                        (i) => i.id === l.ingredientId,
                      )!;
                      return {
                        name: i.name,
                        ingredientId: i.id,
                        quantity: l.quantity / i.yield,
                        cost:
                          ((l.quantity / i.yield) * i.packCost) /
                          i.packQuantity,
                      };
                    })
                  ).map((l, i) => (
                    <li key={i}>
                      {l.name} · {Math.round(l.quantity * 100) / 100}{" "}
                      {s.ingredients.find((i) => i.id === l.ingredientId)?.unit}{" "}
                      · {money(Math.round(l.cost))}
                    </li>
                  ))}
                </ul>
              </details>,
              item.quantity,
              money(unit),
              money(unit * item.quantity),
            ];
          })}
        />
      </Panel>
      <Panel
        title="Dietary requirements & named meals"
        action={
          <Tag tone={o.allergyReviewed ? "green" : "amber"}>
            {o.allergyReviewed ? "Owner reviewed" : "Review required"}
          </Tag>
        }
      >
        <p className="panel-note">
          {o.details.dietary ||
            "No general requirements supplied. Confirm with the customer."}
        </p>
        <GridTable
          heads={["Guest reference", "Requirement", "Assigned meal", "Review"]}
          rows={o.details.requirements.map((r) => [
            r.reference,
            r.requirements,
            s.recipes.find((x) => x.id === r.meal)?.variant || "Unassigned",
            r.reviewed ? "Reviewed" : "Pending",
          ])}
        />
        <p className="panel-note">
          Check ingredient labels and cross-contact arrangements. A meal
          assignment does not itself establish allergen safety.
        </p>
      </Panel>
      <div className="ops-columns">
        <Panel title="Ingredients required">
          <GridTable
            heads={["Ingredient", "Gross quantity", "Reserved"]}
            rows={Object.entries(required).map(([id, quantity]) => [
              s.ingredients.find((i) => i.id === id)?.name,
              `${Math.round(quantity * 100) / 100} ${s.ingredients.find((i) => i.id === id)?.unit}`,
              o.consumed
                ? "Consumed"
                : `${Math.round(o.reservations.filter((r) => s.batches.find((b) => b.id === r.batchId)?.ingredientId === id).reduce((v, r) => v + r.quantity, 0) * 100) / 100}`,
            ])}
          />
        </Panel>
        <Panel
          title="Gemini enquiry review"
          action={
            <Button
              size="sm"
              disabled={busy || !integrations.gemini}
              title={
                !integrations.gemini
                  ? "Configure GEMINI_API_KEY in environment to enable analysis"
                  : undefined
              }
              onClick={() => {
                setAnalysisError("");
                safe(async () => {
                  try {
                    await api("analysis", { orderId: o.id });
                  } catch (e) {
                    setAnalysisError((e as Error).message);
                    throw e;
                  }
                });
              }}
            >
              {busy ? "Working…" : "Analyse request"}
            </Button>
          }
        >
          {analysisError && (
            <p role="alert" className="error-message">
              {analysisError}
            </p>
          )}
          {o.analysis ? (
            <div className="analysis-result">
              <p>{(o.analysis as any).summary}</p>
              <h3>Suggested meals</h3>
              {(o.analysis as any).meals?.map((m: any, i: number) => (
                <p key={i}>
                  <b>{m.name}</b> · {m.quantity ?? "Quantity unclear"}
                  <small className="subtext">Evidence: {m.evidence}</small>
                </p>
              ))}
              {editable &&
                suggestedMeals.some(
                  (m) => m.recipeId && (m.quantity || 0) > 0,
                ) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const matches = new Map<string, number>();
                      for (const m of suggestedMeals)
                        if (
                          m.recipeId &&
                          m.quantity != null &&
                          m.quantity > 0 &&
                          s.recipes.some((r) => r.id === m.recipeId)
                        )
                          matches.set(
                            m.recipeId,
                            (matches.get(m.recipeId) || 0) + m.quantity,
                          );
                      setEdit({
                        ...structuredClone(o),
                        items: [...matches].map(([recipeId, quantity]) => ({
                          recipeId,
                          quantity,
                        })),
                      });
                    }}
                  >
                    Review suggested recipe matches
                  </Button>
                )}
              <h3>Dietary observations</h3>
              {(o.analysis as any).dietary?.map((d: any, i: number) => (
                <p key={i}>
                  {d.reference}: {d.requirement}
                  <small className="subtext">Evidence: {d.evidence}</small>
                </p>
              ))}
              <h3>Questions to resolve</h3>
              <ul>
                {(o.analysis as any).questions?.map((q: string) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="empty-state">
              {integrations.gemini
                ? "Extract suggested meals, quantities and questions from the original request."
                : "Gemini setup required. The original request is saved and available for manual review."}
            </div>
          )}
          <p className="panel-note">
            Suggestions do not change the order or confirm allergies.
          </p>
        </Panel>
      </div>
      <OrderStock order={o} />
      <OrderVenue order={o} />
      <AlertDialog open={cancel} onOpenChange={setCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              Reservations will be released. Ingredients already consumed remain
              recorded and will not be returned to stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                safe(() => run("stage", { orderId: o.id, status: "cancelled" }))
              }
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!review}
        onOpenChange={(v) => {
          if (!v) setReview(null);
        }}
      >
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>Review meal requirements</DialogTitle>
            <DialogDescription>
              Confirm the customer’s requirements, ingredient labels and
              preparation arrangements before accepting the order.
            </DialogDescription>
          </DialogHeader>
          <p>{o.details.dietary || "No general requirements supplied."}</p>
          {review?.map((r, i) => (
            <div key={i} className="review-row">
              <b>
                {r.reference}: {r.requirements}
              </b>
              <Pick
                label="Assigned meal"
                value={r.meal}
                onChange={(v) =>
                  setReview(
                    review.map((x, j) => (i === j ? { ...x, meal: v } : x)),
                  )
                }
                options={o.items.map((item) => {
                  const r = s.recipes.find((x) => x.id === item.recipeId)!;
                  return { value: r.id, label: `${r.name} · ${r.variant}` };
                })}
              />
            </div>
          ))}
          <label className="check-label">
            <Checkbox
              checked={reviewConfirmed}
              onCheckedChange={(v) => setReviewConfirmed(v === true)}
            />{" "}
            I have reviewed the requirements and meal assignments with the
            necessary ingredient and handling information.
          </label>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button
            disabled={!reviewConfirmed || busy}
            onClick={() =>
              safe(async () => {
                await run("allergy-review", {
                  orderId: o.id,
                  requirements: review!.map((r) => ({ ...r, reviewed: true })),
                });
                setReview(null);
              })
            }
          >
            Save owner review
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!edit}
        onOpenChange={(v) => {
          if (!v) setEdit(null);
        }}
      >
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>Edit order details & meals</DialogTitle>
            <DialogDescription>
              Changes require a new dietary review and quote acceptance.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void safe(async () => {
                  await run("order", {
                    orderId: order.id,
                    details: edit.details,
                    items: edit.items,
                  });
                  setEdit(null);
                });
              }}
            >
              <div className="form-grid">
                {[
                  ["name", "Contact name", "text"],
                  ["company", "Company", "text"],
                  ["email", "Email", "email"],
                  ["phone", "Phone", "tel"],
                  ["date", "Event date", "date"],
                  ["attendees", "Attendees", "number"],
                  ["arrivalTime", "Food arrival", "time"],
                  ["eventTime", "Event start", "time"],
                  ["venue", "Venue", "text"],
                  ["address", "Address", "text"],
                  ["postcode", "Postcode", "text"],
                  ["locality", "Locality", "text"],
                ].map(([k, label, type]) => (
                  <Field
                    key={k}
                    label={label}
                    type={type}
                    value={(edit.details as any)[k]}
                    onChange={(v) =>
                      setEdit({
                        ...edit,
                        details: {
                          ...edit.details,
                          [k]: type === "number" ? Number(v) : v,
                        },
                      })
                    }
                  />
                ))}
                {[
                  ["requests", "Requested food / theme"],
                  ["dietary", "Dietary requirements"],
                  ["access", "Building access"],
                  ["unknownDetails", "Outstanding details"],
                ].map(([k, label]) => (
                  <Notes
                    key={k}
                    label={label}
                    value={(edit.details as any)[k]}
                    onChange={(v) =>
                      setEdit({ ...edit, details: { ...edit.details, [k]: v } })
                    }
                  />
                ))}
              </div>
              <h3 className="editor-subtitle">Meals & quantities</h3>
              {edit.items.map((item, i) => (
                <div className="attendee-row" key={i}>
                  <Pick
                    label="Recipe / variant"
                    value={item.recipeId}
                    options={s.recipes.map((r) => ({
                      value: r.id,
                      label: `${r.name} · ${r.variant}`,
                    }))}
                    onChange={(v) =>
                      setEdit({
                        ...edit,
                        items: edit.items.map((x, j) =>
                          i === j ? { ...x, recipeId: v } : x,
                        ),
                      })
                    }
                  />
                  <Field
                    label="Portions"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(v) =>
                      setEdit({
                        ...edit,
                        items: edit.items.map((x, j) =>
                          i === j ? { ...x, quantity: Number(v) } : x,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setEdit({
                        ...edit,
                        items: edit.items.filter((_, j) => i !== j),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setEdit({
                    ...edit,
                    items: [...edit.items, { recipeId: "", quantity: 1 }],
                  })
                }
              >
                Add meal
              </Button>
              <h3 className="editor-subtitle">Guest requirements</h3>
              {edit.details.requirements.map((r, i) => (
                <div className="attendee-row" key={i}>
                  <Field
                    label="Guest reference"
                    value={r.reference}
                    onChange={(v) =>
                      setEdit({
                        ...edit,
                        details: {
                          ...edit.details,
                          requirements: edit.details.requirements.map((x, j) =>
                            i === j ? { ...x, reference: v } : x,
                          ),
                        },
                      })
                    }
                  />
                  <Field
                    label="Requirement"
                    value={r.requirements}
                    onChange={(v) =>
                      setEdit({
                        ...edit,
                        details: {
                          ...edit.details,
                          requirements: edit.details.requirements.map((x, j) =>
                            i === j ? { ...x, requirements: v } : x,
                          ),
                        },
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setEdit({
                        ...edit,
                        details: {
                          ...edit.details,
                          requirements: edit.details.requirements.filter(
                            (_, j) => i !== j,
                          ),
                        },
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setEdit({
                    ...edit,
                    details: {
                      ...edit.details,
                      requirements: [
                        ...edit.details.requirements,
                        {
                          reference: "",
                          requirements: "",
                          meal: "",
                          reviewed: false,
                        },
                      ],
                    },
                  })
                }
              >
                Add guest
              </Button>
              {error && (
                <p role="alert" className="error-message">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <span />
                <Button disabled={busy}>Save order</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
