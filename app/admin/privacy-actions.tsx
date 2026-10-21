"use client";
import { useState } from "react";
import { ShieldX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Order, State } from "@/lib/domain";
import {
  erasureBlockers,
  orderDeleteBlockers,
  retainedInvoices,
} from "@/lib/privacy";
import { useOps } from "./ops-context";

// Right-to-erasure: anonymises the customer, their enquiries and drafts.
export function EraseCustomerData({ customer }: { customer: State["customers"][number] }) {
  const { s, run, reload, busy, mode } = useOps();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  if (customer.erasedAt) return null;
  const blockers = erasureBlockers(s, customer.id);
  const invoices = retainedInvoices(s, customer.id);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <ShieldX size={15} /> Erase personal data
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          setConfirmText("");
          setError("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase {customer.company || customer.name}&apos;s personal data?</AlertDialogTitle>
            <AlertDialogDescription>
              Use this for a data erasure request. Contact details, notes,
              enquiry text, dietary details, venue details, activity and
              follow-ups are removed for good. Open enquiries are declined.
              {mode === "live" && " The original website submissions are deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {blockers.length > 0 ? (
            <p role="alert" className="error-message">
              Complete or cancel {blockers.map((o) => o.reference).join(", ")} first.
              Accepted orders keep allergy and stock commitments until they
              are finished.
            </p>
          ) : (
            <>
              {invoices.length > 0 && (
                <p className="panel-note">
                  {invoices.length} issued invoice{invoices.length === 1 ? " is" : "s are"} kept
                  unchanged because accounting records must be retained.
                </p>
              )}
              <label className="field">
                <span>Type ERASE to confirm</span>
                <Input
                  aria-label="Type ERASE to confirm"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep data</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy || blockers.length > 0 || confirmText !== "ERASE"}
              onClick={async () => {
                try {
                  await run("customer-erase", { customerId: customer.id });
                  await reload();
                  setOpen(false);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Erase data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Removes an unworked enquiry entirely (spam, duplicates, tests).
export function DeleteEnquiry({ order }: { order: Order }) {
  const { s, run, href, busy } = useOps();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  if (orderDeleteBlockers(s, order).length) return null;
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Trash2 size={15} /> Delete enquiry
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {order.reference}?</AlertDialogTitle>
            <AlertDialogDescription>
              For spam, duplicates and test enquiries. The enquiry and its
              original website submission are removed permanently. A customer
              record with no other history is removed too. To keep a record,
              decline the enquiry instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep enquiry</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                try {
                  await run("order-delete", { orderId: order.id });
                  window.location.assign(href("orders"));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Delete permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
