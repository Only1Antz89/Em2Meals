import { ArrowUpRight, ArrowRight, MapPin } from "lucide-react";
import { Header, Footer } from "./public-shell";
export default function Home() {
  return (
    <>
      <Header />
      <main>
        <section className="split-home">
          <a href="/private-chef" className="entry private-entry">
            <div className="entry-photo private-photo" />
            <div className="entry-content">
              <span className="eyebrow">01 / PRIVATE CHEF & EVENTS</span>
              <h1>
                For the
                <br />
                unforgettable<span className="italic"> occasions.</span>
              </h1>
              <p>
                Extraordinary food. Thoughtful hosting.
                <br />
                Your moment, beautifully taken care of.
              </p>
              <span className="hero-link">
                Plan your occasion <ArrowUpRight size={22} />
              </span>
            </div>
            <span className="entry-foot">
              BESPOKE MENUS · PRIVATE DINING · CELEBRATIONS
            </span>
          </a>
          <a href="/corporate" className="entry corporate-entry">
            <div className="entry-photo corporate-photo" />
            <div className="entry-content">
              <span className="eyebrow">02 / CORPORATE CATERING</span>
              <h2>
                Good food.
                <br />
                Great company.
                <br />
                <span className="italic">Better days.</span>
              </h2>
              <p>
                From the first meeting to the last bite.
                <br />
                Catering that works as hard as your team.
              </p>
              <span className="hero-link">
                Enquire for your team <ArrowUpRight size={22} />
              </span>
            </div>
            <span className="entry-foot">
              BREAKFASTS · OFFICE LUNCHES · MEETINGS & EVENTS
            </span>
          </a>
        </section>
        <div className="coverage-strip">
          <span>
            <MapPin size={16} /> Made in London. Shared across the M25.
          </span>
          <span>Two ways to gather. One love of good food.</span>
        </div>
        <section className="brand-story">
          <span className="eyebrow">A PLACE AT EVERY TABLE</span>
          <h2>
            Emma’s square meals.
            <br />
            <span className="italic">Anything but ordinary.</span>
          </h2>
          <div>
            <p>
              Some meals mark a milestone. Others make an ordinary Tuesday a
              little better. We bring the same care to both.
            </p>
            <p>
              EM² Meals brings people together around generous, considered food
              — in your home, at your celebration or with your whole team.
            </p>
            <a className="text-link" href="/enquire">
              Let’s make something delicious <ArrowRight size={18} />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
