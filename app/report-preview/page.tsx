"use client";

import {
  CalendarDays,
  Check,
  Download,
  Leaf,
  MessageCircleMore,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const favourites = [
  { name: "Grilled lemon chicken", detail: "Herb marinade", portions: 68 },
  { name: "Summer garden salad", detail: "House dressing", portions: 54 },
  { name: "Berry Eton mess", detail: "Vanilla cream", portions: 42 },
];

export default function CustomerReportPreview() {
  return (
    <main className="customer-report-page">
      <nav className="customer-report-nav" aria-label="Report actions">
        <Link className="customer-report-brand" href="/">
          <Image src="/brand/fork-goodness-baked-mark.svg" alt="" width={34} height={34} />
          <span>Fork Goodness Baked</span>
        </Link>
        <div>
          <span className="customer-report-sample">Sample report</span>
          <button type="button" onClick={() => window.print()}>
            <Download size={15} aria-hidden="true" /> Save as PDF
          </button>
        </div>
      </nav>

      <article className="customer-report-document">
        <header className="customer-report-hero">
          <div className="customer-report-hero-copy">
            <p className="customer-report-overline">Your catering report</p>
            <h1>A season of good food,<br />shared well.</h1>
            <p className="customer-report-lede">
              Prepared for <strong>Northbank Studio</strong>, with a clear view
              of the lunches we served, what your team loved, and where we can
              make the next one even better.
            </p>
            <div className="customer-report-period">
              <CalendarDays size={17} aria-hidden="true" />
              1 June — 31 August 2026
            </div>
          </div>
          <div className="customer-report-hero-mark" aria-hidden="true">
            <span>SUMMER</span>
            <strong>’26</strong>
          </div>
        </header>

        <section className="customer-report-stats" aria-label="Report summary">
          <div><strong>4</strong><span>team lunches</span></div>
          <div><strong>186</strong><span>guests catered</span></div>
          <div><strong>4.9</strong><span>average rating</span></div>
          <div><strong>98%</strong><span>portions enjoyed</span></div>
        </section>

        <section className="customer-report-section customer-report-impact">
          <div className="customer-report-section-heading">
            <p>At a glance</p>
            <h2>Thoughtful catering,<br />measurable impact.</h2>
          </div>
          <div className="customer-report-impact-grid">
            <article>
              <span className="customer-report-icon"><Leaf size={20} /></span>
              <strong>1.8 kg</strong>
              <h3>Measured food waste</h3>
              <p>Down 22% from your first lunch, helped by tighter headcounts and portion planning.</p>
            </article>
            <article>
              <span className="customer-report-icon"><UsersRound size={20} /></span>
              <strong>42%</strong>
              <h3>Plant-forward choices</h3>
              <p>Nearly half of all portions ordered were vegetarian or centred on seasonal produce.</p>
            </article>
            <article>
              <span className="customer-report-icon"><Sparkles size={20} /></span>
              <strong>100%</strong>
              <h3>Dietaries covered</h3>
              <p>Every recorded allergy and dietary requirement was reviewed before service.</p>
            </article>
          </div>
        </section>

        <section className="customer-report-section customer-report-favourites">
          <div className="customer-report-section-heading">
            <p>Your team’s favourites</p>
            <h2>The dishes that<br />kept disappearing.</h2>
          </div>
          <div className="customer-report-favourite-list">
            {favourites.map((item, index) => (
              <div key={item.name} className="customer-report-favourite-row">
                <span>0{index + 1}</span>
                <div><h3>{item.name}</h3><p>{item.detail}</p></div>
                <strong>{item.portions}<small> portions</small></strong>
              </div>
            ))}
          </div>
        </section>

        <section className="customer-report-quote">
          <MessageCircleMore size={26} aria-hidden="true" />
          <blockquote>
            “The team loved the lunch. Everything felt fresh and generous,
            and the dietary options were handled brilliantly.”
          </blockquote>
          <p>— Alex Morgan, Northbank Studio</p>
        </section>

        <section className="customer-report-section customer-report-next">
          <div className="customer-report-section-heading">
            <p>Looking ahead</p>
            <h2>A little smarter<br />next time.</h2>
          </div>
          <div className="customer-report-next-list">
            {[
              "Keep the grilled lemon chicken in the regular rotation.",
              "Add one more substantial vegetarian main for larger lunches.",
              "Confirm final headcount 48 hours ahead to reduce leftovers further.",
            ].map((item) => (
              <div key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></div>
            ))}
          </div>
        </section>

        <footer className="customer-report-footer">
          <div>
            <Image src="/brand/fork-goodness-baked-mark.svg" alt="" width={34} height={34} />
            <strong>Fork Goodness Baked</strong>
          </div>
          <p>Prepared 17 September 2026 · Sample data for preview purposes</p>
        </footer>
      </article>
    </main>
  );
}
