import type { Metadata } from "next";
import { loadState } from "@/lib/server";
import { supplierOrderView } from "@/lib/supplier-link";
import SupplierOrderForm from "./supplier-order-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Confirm order",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SupplierOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let view = null;
  try {
    view = /^[A-Za-z0-9_-]{20,100}$/.test(token)
      ? supplierOrderView((await loadState("live")).state, token)
      : null;
  } catch (error) {
    console.error("Unable to load supplier order", error);
  }
  return (
    <main className="supplier-order">
      {view ? (
        <SupplierOrderForm token={token} initial={view} />
      ) : (
        <section className="supplier-order-card">
          <h1>Order link not found</h1>
          <p>
            This link is not valid any more. Please contact the kitchen that
            sent it.
          </p>
        </section>
      )}
    </main>
  );
}
