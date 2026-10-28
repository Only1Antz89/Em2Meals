"use client";
// Post-event waste check: one quick form per event, filled in after service.
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Pick } from "@/components/form-controls";
import { type Order, today } from "@/lib/domain";
import { disposalLabels, wasteDisposals } from "@/lib/wrapped";
import { useOps } from "./ops-context";

const disposalOptions = [
  { value: "", label: "Not recorded" },
  ...wasteDisposals.map((d) => ({ value: d, label: disposalLabels[d] })),
];
const toNumber = (v: string) => (v.trim() === "" ? null : Number(v));

export function WasteCheckDialog({
  order,
  onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>Waste check · {order?.reference}</DialogTitle>
          <DialogDescription>
            Fill this in after service. Leave a weight blank if it was not
            weighed; blank is never counted as zero.
          </DialogDescription>
        </DialogHeader>
        {order && (
          <WasteCheckForm key={order.id} order={order} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WasteCheckForm({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { s, run, busy } = useOps();
  const previous = order.wasteCheck;
  const dishes =
    order.costSnapshot?.items.map((i) => ({
      recipeId: i.recipeId,
      name: i.name,
      quantity: i.quantity,
    })) ||
    order.items.map((i) => ({
      recipeId: i.recipeId,
      name: s.recipes.find((r) => r.id === i.recipeId)?.name || "Dish",
      quantity: i.quantity,
    }));
  const fromCheck = (recipeId: string) =>
    s.waste.find(
      (w) =>
        w.orderId === order.id &&
        w.source === "check" &&
        w.recipeId === recipeId,
    );
  const [rows, setRows] = useState(
    dishes.map((d) => {
      const old = fromCheck(d.recipeId);
      return {
        ...d,
        leftover: String(old?.quantity ?? 0),
        weight: old?.weightMeasured ? String(old.weightGrams) : "",
      };
    }),
  );
  const oldPlate = s.waste.find(
    (w) =>
      w.orderId === order.id &&
      w.source === "check" &&
      w.category === "plate waste",
  );
  const oldLeftover = s.waste.find(
    (w) =>
      w.orderId === order.id &&
      w.source === "check" &&
      w.category === "unserved portions",
  );
  const [guests, setGuests] = useState(
    String(previous?.guests ?? order.details.attendees ?? ""),
  );
  const [plate, setPlate] = useState(
    previous?.plateWasteGrams == null ? "" : String(previous.plateWasteGrams),
  );
  const [date, setDate] = useState(previous?.date || today());
  const [leftoverDisposal, setLeftoverDisposal] = useState<string>(
    oldLeftover?.disposal || "",
  );
  const [plateDisposal, setPlateDisposal] = useState<string>(
    oldPlate?.disposal || "",
  );
  const [notes, setNotes] = useState(previous?.notes || "");
  const [error, setError] = useState("");
  const totalLeft = rows.reduce((n, r) => n + (Number(r.leftover) || 0), 0);
  const totalPortions = rows.reduce((n, r) => n + r.quantity, 0);

  const save = async () => {
    setError("");
    try {
      await run("waste-check", {
        orderId: order.id,
        date,
        guests: toNumber(guests),
        dishes: rows.map((r) => ({
          recipeId: r.recipeId,
          leftover: Number(r.leftover) || 0,
          weightGrams: toNumber(r.weight),
        })),
        plateWasteGrams: toNumber(plate),
        leftoverDisposal,
        plateDisposal,
        notes,
      });
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save the waste check",
      );
    }
  };

  return (
    <form
      className="waste-check"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="form-grid">
        <Field
          label="Guests who ate"
          type="number"
          min={0}
          value={guests}
          onChange={setGuests}
        />
        <Field
          label="Check date"
          type="date"
          value={date}
          onChange={setDate}
          required
        />
      </div>
      <h3 className="editor-subtitle">Leftover portions by dish</h3>
      {rows.length ? (
        <div className="waste-check-dishes">
          <div className="waste-check-head" aria-hidden="true">
            <span>Dish</span>
            <span>Leftover portions</span>
            <span>Leftover weight (g)</span>
          </div>
          {rows.map((r, i) => {
            const set = (patch: Partial<typeof r>) =>
              setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            const left = Number(r.leftover) || 0;
            return (
              <div key={r.recipeId} className="waste-check-row">
                <div>
                  <strong>{r.name}</strong>
                  <small>{r.quantity} prepared</small>
                </div>
                <div className="waste-stepper">
                  <button
                    type="button"
                    aria-label={`One fewer leftover ${r.name}`}
                    onClick={() =>
                      set({ leftover: String(Math.max(0, left - 1)) })
                    }
                  >
                    −
                  </button>
                  <input
                    aria-label={`Leftover portions of ${r.name}`}
                    inputMode="numeric"
                    value={r.leftover}
                    onChange={(e) =>
                      set({ leftover: e.target.value.replace(/[^0-9]/g, "") })
                    }
                  />
                  <button
                    type="button"
                    aria-label={`One more leftover ${r.name}`}
                    onClick={() =>
                      set({ leftover: String(Math.min(r.quantity, left + 1)) })
                    }
                  >
                    +
                  </button>
                </div>
                <input
                  aria-label={`Leftover weight of ${r.name} in grams`}
                  className="waste-weight"
                  inputMode="decimal"
                  placeholder="Not weighed"
                  value={r.weight}
                  onChange={(e) =>
                    set({ weight: e.target.value.replace(/[^0-9.]/g, "") })
                  }
                />
              </div>
            );
          })}
          <p className="panel-note">
            {totalLeft} of {totalPortions} portions came back
            {totalPortions
              ? ` · ${Math.round(((totalPortions - totalLeft) / totalPortions) * 100)}% enjoyed`
              : ""}
          </p>
        </div>
      ) : (
        <p className="panel-note">This order has no dishes to check.</p>
      )}
      <div className="form-grid">
        <Pick
          label="Where did the leftovers go?"
          value={leftoverDisposal}
          onChange={setLeftoverDisposal}
          options={disposalOptions}
        />
        <Field
          label="Plate waste, scraped and weighed (g)"
          type="number"
          min={0}
          value={plate}
          onChange={setPlate}
        />
        <Pick
          label="Where did plate waste go?"
          value={plateDisposal}
          onChange={setPlateDisposal}
          options={disposalOptions}
        />
        <Field label="Notes (internal)" value={notes} onChange={setNotes} />
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {previous ? "Update waste check" : "Save waste check"}
        </Button>
      </div>
    </form>
  );
}
