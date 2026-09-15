import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ClipboardCheck, UsersRound } from "lucide-react";
import { Footer, Header } from "../public-shell";

const services = [
  ["Breakfasts", "A polished start for briefings, workshops and early team sessions."],
  ["Working lunches", "Generous, easy-to-serve food planned around your headcount and schedule."],
  ["Meetings & events", "Considered catering for client days, team moments and company gatherings."],
];

export default function Page() {
  return (
    <>
      <Header active="corporate" />
      <main className="service-page service-page--corporate">
        <section className="service-page-hero">
          <div className="service-page-hero__copy">
            <span className="service-kicker">Corporate catering · London</span>
            <h1>Catering that works around the working day.</h1>
            <p>
              Breakfasts, lunches and event food delivered with the clarity,
              timing and care your team needs.
            </p>
            <Link href="/enquire?service=corporate" className="brand-button">
              Enquire for your team <ArrowUpRight aria-hidden="true" size={19} />
            </Link>
          </div>
          <div className="service-page-hero__image">
            <Image
              src="/images/em2-corporate-team.png"
              alt="Black catering professionals arranging a working lunch in a London office"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 58vw"
            />
          </div>
        </section>

        <section className="service-offer">
          <header>
            <span className="section-index">01</span>
            <h2>Good food, fitted to the agenda.</h2>
            <p>
              Tell us who you are feeding and how the day is structured. We
              will help you choose an approach that is practical and inviting.
            </p>
          </header>
          <div className="service-offer__list">
            {services.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="corporate-operations">
          <div className="corporate-operations__heading">
            <span className="section-index">02</span>
            <h2>Professional behind the scenes.</h2>
            <p>
              Reliable catering is as much about organisation as it is about
              flavour. We keep the practical details visible and agreed.
            </p>
          </div>
          <div className="corporate-operations__grid">
            <article><CalendarDays aria-hidden="true" /><h3>Planned to time</h3><p>Delivery windows and venue access agreed before the day.</p></article>
            <article><UsersRound aria-hidden="true" /><h3>Made for the team</h3><p>Headcounts, preferences and dietary needs kept together.</p></article>
            <article><ClipboardCheck aria-hidden="true" /><h3>Clear to reorder</h3><p>Useful order records make repeat catering easier to plan.</p></article>
          </div>
        </section>

        <section className="corporate-menu-band">
          <div className="corporate-menu-band__image">
            <Image
              src="/images/corporate-spread.jpg"
              alt="A fresh sharing lunch prepared for a workplace team"
              fill
              sizes="(max-width: 800px) 100vw, 50vw"
            />
          </div>
          <div>
            <span className="section-index">03</span>
            <h2>Easy to share. Easy to plan.</h2>
            <p>
              From a one-off client meeting to a recurring team lunch, we keep
              the offer flexible and the process straightforward.
            </p>
            <Link href="/enquire?service=corporate" className="text-arrow-link">
              Discuss your next date <ArrowUpRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </section>

        <section className="service-final-cta">
          <p>Breakfasts · Working lunches · Team events</p>
          <h2>Put better food on the agenda.</h2>
          <Link href="/enquire?service=corporate" className="brand-button brand-button--light">
            Start your enquiry <ArrowUpRight aria-hidden="true" size={19} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
