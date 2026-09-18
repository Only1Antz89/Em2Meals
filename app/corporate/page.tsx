import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ClipboardCheck, UsersRound } from "lucide-react";
import { Footer, Header } from "../public-shell";

const services = [
  [
    "Breakfasts",
    "Kick start your day right by fueling your guests with the right nutrition to keep them focused for the day.",
  ],
  [
    "Working lunches",
    "Whether it is a sandwich lunch or buffet let us help you by ensuring guests are nourished and engaged.",
  ],
  [
    "Meetings / events",
    "Let us work with you to cater for client days, team meetings and company gatherings.",
  ],
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
              src="/images/corporate-catering-hero.jpg"
              alt="A Black-led catering team arranging breakfast and lunch in a London office"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 58vw"
            />
          </div>
        </section>

        <section className="service-offer">
          <header>
            <span className="section-index">01</span>
            <h2>Good food added to the agenda.</h2>
            <p>
              Tell us about your event and we will work together with you
              ensuring your guests enjoy every last forkful.
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
              Reliable catering begins with calm organisation. Let us work with
              you to keep the details practical and professional.
            </p>
          </div>
          <div className="corporate-operations__grid">
            <article>
              <CalendarDays aria-hidden="true" />
              <h3>Planned to time</h3>
              <p>Delivery windows agreed in advance.</p>
            </article>
            <article>
              <UsersRound aria-hidden="true" />
              <h3>Made with you in mind</h3>
              <p>
                We tailor our food and services to each client and event. With
                special care and consideration taken for guests with allergies,
                specific dietary requirements and intolerances.
              </p>
            </article>
            <article>
              <ClipboardCheck aria-hidden="true" />
              <h3>Ordering</h3>
              <p>
                Order with ease by completing the enquiry form and one of our
                team will get back to you.
              </p>
            </article>
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
