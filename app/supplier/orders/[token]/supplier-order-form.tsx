"use client";
import { useState } from "react";
import type { SupplierOrderView } from "@/lib/supplier-link";

const windows = [
  "Any time",
  "Morning (before 12pm)",
  "Afternoon (12pm–5pm)",
  "Evening (after 5pm)",
];
const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const nice = (date: string) =>
  date
    ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "To confirm";
const amount = (n: number) => +n.toFixed(2);
const localToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
    new Date(),
  );

type Line = { available: boolean; packs: string; price: string; note: string };

function startingLines(view: SupplierOrderView): Line[] {
  return view.lines.map((l) => {
    const answer = view.response?.lines.find(
      (x) => x.ingredientId === l.ingredientId,
    );
    const quantity = answer ? answer.quantity : l.quantity;
    const price = answer && answer.status !== "unavailable" ? answer.cost : l.estimate;
    return {
      available: answer ? answer.status !== "unavailable" : true,
      packs: String(amount((answer?.status === "unavailable" ? l.quantity : quantity) / l.packSize)),
      price: price === null ? "" : (price / 100).toFixed(2),
      note: answer?.note || "",
    };
  });
}

export default function SupplierOrderForm({
  token,
  initial,
}: {
  token: string;
  initial: SupplierOrderView;
}) {
  const [view, setView] = useState(initial);
  const [editing, setEditing] = useState(initial.status === "open");
  const [lines, setLines] = useState(() => startingLines(initial));
  const [deliveryDate, setDeliveryDate] = useState(
    initial.suggestedDate >= localToday() ? initial.suggestedDate : localToday(),
  );
  const [deliveryWindow, setDeliveryWindow] = useState(
    initial.response?.deliveryWindow || "Any time",
  );
  const [contactName, setContactName] = useState(
    initial.response?.contactName || "",
  );
  const [note, setNote] = useState(initial.response?.note || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (index: number, change: Partial<Line>) =>
    setLines(lines.map((l, i) => (i === index ? { ...l, ...change } : l)));
  const late = view.neededBy && deliveryDate > view.neededBy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = {
        deliveryDate,
        deliveryWindow,
        contactName,
        note,
        lines: view.lines.map((l, i) => {
          const line = lines[i];
          const packs = Number(line.packs);
          if (line.available && !(packs > 0))
            throw Error(`Enter how many packs of ${l.name} you can deliver.`);
          if (line.available && (line.price === "" || Number(line.price) < 0))
            throw Error(`Enter the price for ${l.name}.`);
          return {
            ingredientId: l.ingredientId,
            available: line.available,
            quantity: line.available ? amount(packs * l.packSize) : 0,
            cost: line.available ? Math.round(Number(line.price) * 100) : 0,
            note: line.note,
          };
        }),
      };
      const response = await fetch(`/api/supplier/orders/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        view?: SupplierOrderView;
        error?: string;
      };
      if (!response.ok || !result.view)
        throw Error(result.error || "Could not save. Please try again.");
      setView(result.view);
      setEditing(false);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <header className="supplier-order-header">
      <span className="supplier-order-kicker">Order from {view.kitchen}</span>
      <h1>
        {view.supplier ? `Hi ${view.supplier}, ` : ""}
        {view.status === "open"
          ? "can you confirm this order?"
          : "here is this order."}
      </h1>
      <dl className="supplier-order-facts">
        <div>
          <dt>Ordered</dt>
          <dd>{nice(view.requestedOn)}</dd>
        </div>
        <div>
          <dt>Needed by</dt>
          <dd>{nice(view.neededBy)}</dd>
        </div>
        <div>
          <dt>Items</dt>
          <dd>{view.lines.length}</dd>
        </div>
      </dl>
    </header>
  );

  if (view.status === "cancelled" || view.status === "recorded")
    return (
      <section className="supplier-order-card">
        {header}
        <p className="supplier-order-message">
          {view.status === "cancelled"
            ? "The kitchen cancelled or replaced this order. You don't need to do anything."
            : "The kitchen has already recorded your confirmation. Contact them if anything changes."}
        </p>
      </section>
    );

  if (!editing && view.response) {
    const r = view.response;
    return (
      <section className="supplier-order-card">
        {header}
        <p className="supplier-order-message" role="status">
          {saved
            ? "Thanks, the kitchen has your confirmation."
            : view.status === "received"
              ? "The kitchen has received this delivery."
              : "You've confirmed this order."}
        </p>
        <div className="supplier-order-summary">
          <p>
            <strong>Delivery:</strong> {nice(r.deliveryDate)}
            {r.deliveryWindow && r.deliveryWindow !== "Any time"
              ? `, ${r.deliveryWindow.toLowerCase()}`
              : ""}
          </p>
          <ul>
            {r.lines.map((l) => {
              const item = view.lines.find(
                (x) => x.ingredientId === l.ingredientId,
              )!;
              return (
                <li key={l.ingredientId}>
                  <span>{item.name}</span>
                  <span>
                    {l.status === "unavailable"
                      ? "Not available"
                      : `${amount(l.quantity)} ${item.unit} · ${pounds(l.cost)}`}
                  </span>
                </li>
              );
            })}
          </ul>
          {r.note && <p>Note: {r.note}</p>}
        </div>
        {view.status === "confirmed" && (
          <button
            type="button"
            className="supplier-order-secondary"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            Change delivery date or quantities
          </button>
        )}
      </section>
    );
  }

  return (
    <form className="supplier-order-card" onSubmit={submit}>
      {header}
      <ol className="supplier-order-lines">
        {view.lines.map((l, i) => {
          const line = lines[i];
          return (
            <li
              key={l.ingredientId}
              className={line.available ? "" : "is-unavailable"}
            >
              <div className="supplier-order-line-head">
                <div>
                  <strong>{l.name}</strong>
                  <span>
                    Asked for {l.packs} {l.packs === 1 ? "pack" : "packs"} of{" "}
                    {amount(l.packSize)} {l.unit} ({amount(l.quantity)} {l.unit})
                  </span>
                </div>
                <label className="supplier-order-toggle">
                  <input
                    type="checkbox"
                    checked={line.available}
                    onChange={(e) => set(i, { available: e.target.checked })}
                  />
                  Available
                </label>
              </div>
              {line.available ? (
                <div className="supplier-order-inputs">
                  <label>
                    <span>Packs you can send</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      required
                      value={line.packs}
                      onChange={(e) => set(i, { packs: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Price for this line (£, incl. VAT)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      required
                      value={line.price}
                      onChange={(e) => set(i, { price: e.target.value })}
                    />
                  </label>
                  <label className="supplier-order-wide">
                    <span>Note (optional, e.g. a substitute)</span>
                    <input
                      value={line.note}
                      maxLength={500}
                      onChange={(e) => set(i, { note: e.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <label className="supplier-order-wide">
                  <span>Reason or alternative (optional)</span>
                  <input
                    value={line.note}
                    maxLength={500}
                    onChange={(e) => set(i, { note: e.target.value })}
                  />
                </label>
              )}
            </li>
          );
        })}
      </ol>
      <fieldset className="supplier-order-delivery">
        <legend>Delivery</legend>
        <label>
          <span>Delivery date</span>
          <input
            type="date"
            required
            min={localToday()}
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </label>
        <label>
          <span>Time</span>
          <select
            value={deliveryWindow}
            onChange={(e) => setDeliveryWindow(e.target.value)}
          >
            {windows.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        {late && (
          <p className="supplier-order-warning" role="status">
            This is after the kitchen needs it ({nice(view.neededBy)}).
          </p>
        )}
        <label>
          <span>Your name (optional)</span>
          <input
            value={contactName}
            maxLength={120}
            onChange={(e) => setContactName(e.target.value)}
          />
        </label>
        <label className="supplier-order-wide">
          <span>Message to the kitchen (optional)</span>
          <textarea
            value={note}
            maxLength={2000}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="supplier-order-error">
          {error}
        </p>
      )}
      <button className="supplier-order-primary" disabled={busy}>
        {busy
          ? "Sending…"
          : view.response
            ? "Send update"
            : "Confirm order"}
      </button>
      <p className="supplier-order-small">
        The kitchen sees your answer straight away. You can come back to this
        link to change it until the delivery arrives.
      </p>
    </form>
  );
}
