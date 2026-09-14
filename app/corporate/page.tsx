import { Header, Footer } from "../public-shell";
import {
  ArrowUpRight,
  MapPin,
  Utensils,
  ClipboardCheck,
  BarChart3,
} from "lucide-react";
export default function Page() {
  return (
    <>
      <Header />
      <main className="corporate-page">
        <section className="service-hero">
          <img
            src="/images/corporate-spread.jpg"
            alt="Appetisers and salads arranged for a catered gathering"
          />
          <div>
            <span className="eyebrow">
              CORPORATE CATERING · LONDON & THE M25
            </span>
            <h1>
              Feed the team.
              <br />
              <span className="italic">Fuel the day.</span>
            </h1>
            <p>
              Breakfast briefings. Working lunches. Big ideas. Thoughtful
              catering that makes bringing people together feel effortless.
            </p>
            <a href="/enquire?service=corporate" className="solid-cta">
              Enquire for your team <ArrowUpRight size={19} />
            </a>
          </div>
        </section>
        <section className="service-grid corporate-services">
          <article>
            <img
              src="/images/breakfast.jpg"
              alt="Croissants and breads arranged on a breakfast buffet"
            />
            <h3>A better start</h3>
            <p>
              Breakfasts for early meetings and mornings worth coming into the
              office for.
            </p>
          </article>
          <article>
            <img
              src="/images/corporate-spread.jpg"
              alt="Fresh bites ready for a shared lunch"
            />
            <h3>Lunch, together</h3>
            <p>
              Office lunches and generous sharing spreads, tailored to your
              headcount and preferences.
            </p>
          </article>
          <article className="event-tile">
            <span className="eyebrow">BIG MOMENTS, WELL FED</span>
            <h3>
              Meetings.
              <br />
              Pitches.
              <br />
              Possibilities.
            </h3>
            <p>
              Considered food for client presentations, team events and
              everything on the agenda.
            </p>
            <a className="text-link" href="/enquire?service=corporate">
              Tell us what’s coming <ArrowUpRight size={18} />
            </a>
          </article>
        </section>
        <section className="corporate-promise">
          <div>
            <span className="eyebrow">THE DETAILS MAKE THE DIFFERENCE</span>
            <h2>
              Good food.
              <br />
              <span className="italic">A well-run day.</span>
            </h2>
          </div>
          <div className="promise-list">
            {[
              [
                MapPin,
                "Across London",
                "Delivery within the M25, with timings and venue access agreed in advance.",
              ],
              [
                Utensils,
                "Made for your team",
                "Flexible menus and a clear conversation about dietary needs and allergies.",
              ],
              [
                ClipboardCheck,
                "Thoughtfully organised",
                "Headcounts, meal requirements and delivery instructions kept together.",
              ],
              [
                BarChart3,
                "A clearer picture",
                "Useful reporting to help you plan the next order and understand measured waste.",
              ],
            ].map(([Icon, title, text]: any) => (
              <article key={title}>
                <Icon size={22} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="report-section">
          <div>
            <span className="eyebrow">MORE INSIGHT WITH EVERY ORDER</span>
            <h2>
              Your catering.
              <br />
              <span className="italic">The bigger picture.</span>
            </h2>
            <p>
              See what your team orders, which dishes are popular and how much
              food waste is recorded. Use the findings to adjust future
              quantities and support your own sustainability reporting.
            </p>
            <p>
              Measured quantities, a clear reporting period and honest context —
              so you can make informed choices.
            </p>
            <a href="/enquire?service=corporate" className="text-link">
              Let’s talk about your team <ArrowUpRight size={18} />
            </a>
          </div>
          <div className="example-report">
            <span className="eyebrow">ILLUSTRATIVE REPORT · SAMPLE DATA</span>
            <h3>Your catering recap</h3>
            <div className="report-metrics">
              <div>
                <strong>30</strong>
                <span>portions prepared</span>
              </div>
              <div>
                <strong>0.5 kg</strong>
                <span>measured waste</span>
              </div>
            </div>
            <p>Most ordered</p>
            <div className="report-bar">
              <span>House burger · seeded</span>
              <b>20</b>
            </div>
            <div className="report-bar smaller">
              <span>House burger · plain</span>
              <b>10</b>
            </div>
            <small>
              2 portions unserved after two attendees were absent. This does not
              establish food preference or carbon savings.
            </small>
          </div>
        </section>
        <section className="corporate-end">
          <h2>What’s on your agenda?</h2>
          <a className="solid-cta" href="/enquire?service=corporate">
            Enquire for your team <ArrowUpRight size={19} />
          </a>
        </section>
      </main>
      <Footer />
    </>
  );
}
