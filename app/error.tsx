"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Footer, Header } from "./public-shell";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <>
      <Header />
      <main className="status-page" role="alert">
        <span className="service-kicker">Something went wrong</span>
        <h1>We couldn&apos;t load this page.</h1>
        <p>
          Please try again. If you were sending an enquiry, your details have
          not been lost — try once more or contact us directly.
          {error.digest ? ` Reference: ${error.digest}.` : ""}
        </p>
        <div className="status-page__actions">
          <button type="button" className="brand-button" onClick={() => retry()}>
            Try again
          </button>
          <Link href="/" className="menu-print-button">
            Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
