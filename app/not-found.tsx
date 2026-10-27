import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Footer, Header } from "./public-shell";

export const metadata: Metadata = {
  title: "Page not found | Fork Goodness Baked",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="status-page">
        <span className="service-kicker">Page not found</span>
        <h1>This table isn&apos;t set.</h1>
        <p>
          The page you were looking for has moved or no longer exists. Our
          seasonal menu and services are a click away.
        </p>
        <div className="status-page__actions">
          <Link href="/" className="brand-button">
            Back to home <ArrowUpRight aria-hidden="true" size={19} />
          </Link>
          <Link href="/menu" className="menu-print-button">
            See the menu
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
