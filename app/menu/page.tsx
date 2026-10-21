import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Footer, Header } from "../public-shell";
import { MenuDocument } from "@/components/menu/menu-document";
import { readPublishedMenu } from "@/lib/server";
import { PrintMenuButton } from "./print-button";

// Always read the currently published snapshot; publishing takes effect on the
// next visit without a redeploy.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seasonal Menu | Fork Goodness Baked",
  description:
    "Our current seasonal menu for private dining and corporate catering in London and the South East.",
};

async function publishedMenu() {
  try {
    return await readPublishedMenu();
  } catch (error) {
    console.error("Unable to load the published menu", error);
    return null;
  }
}

export default async function MenuPage() {
  const menu = await publishedMenu();
  return (
    <>
      <Header active="menu" />
      <main className="menu-page">
        {menu ? (
          <>
            <MenuDocument menu={menu} />
            <div className="menu-page-actions">
              <Link href="/enquire" className="brand-button">
                Plan your menu with us <ArrowUpRight aria-hidden="true" size={19} />
              </Link>
              <PrintMenuButton />
            </div>
          </>
        ) : (
          <section className="menu-page-empty">
            <span className="service-kicker">Seasonal menu</span>
            <h1>Our seasonal menu is being prepared.</h1>
            <p>
              Every menu is shaped around your occasion. Tell us what you have
              in mind and we&apos;ll suggest dishes from this season&apos;s
              kitchen.
            </p>
            <Link href="/enquire" className="brand-button">
              Make an enquiry <ArrowUpRight aria-hidden="true" size={19} />
            </Link>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
