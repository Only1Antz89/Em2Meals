import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Footer, Header } from "../public-shell";

const occasions = [
  ["Private dining", "A menu designed for your table, prepared and served in your home."],
  ["Celebrations", "Birthdays, anniversaries and gatherings with food that feels personal."],
  ["Intimate events", "A composed food experience for the people and setting you have in mind."],
];

export default function Page() {
  return (
    <>
      <Header active="private" />
      <main className="service-page service-page--private">
        <section className="service-page-hero">
          <div className="service-page-hero__copy">
            <span className="service-kicker">Private dining · London</span>
            <h1>Made around your table.</h1>
            <p>
              A private chef experience shaped around your guests, your home
              and the atmosphere you want to create.
            </p>
            <Link href="/enquire?service=private" className="brand-button">
              Plan your occasion <ArrowUpRight aria-hidden="true" size={19} />
            </Link>
          </div>
          <div className="service-page-hero__image">
            <Image
              src="/images/private-dining-hero.jpg"
              alt="A Black private chef serving a candlelit dinner in a London home"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 55vw"
            />
          </div>
        </section>

        <section className="service-offer">
          <header>
            <span className="section-index">01</span>
            <h2>Your occasion, thoughtfully composed.</h2>
            <p>
              We begin with how you want the gathering to feel, then build the
              menu and service around it.
            </p>
          </header>
          <div className="service-offer__list">
            {occasions.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="service-editorial">
          <div className="service-editorial__image">
            <Image
              src="/images/food-prep.jpg"
              alt="Fresh vibrant vegetables being washed under running water in the kitchen"
              fill
              sizes="(max-width: 800px) 100vw, 48vw"
            />
          </div>
          <div className="service-editorial__copy">
            <span className="section-index">02</span>
            <h2>You host. We take care of the food.</h2>
            <p>
              From the first menu conversation to the final plate, the details
              are handled with calm, attentive service. You stay present with
              your guests while we focus on the kitchen.
            </p>
            <ul>
              <li><Check aria-hidden="true" size={18} /> A menu shaped around your tastes</li>
              <li><Check aria-hidden="true" size={18} /> Dietary requirements discussed clearly</li>
              <li><Check aria-hidden="true" size={18} /> Preparation, service and kitchen reset agreed in advance</li>
            </ul>
            <small>Photography illustrates our service style.</small>
          </div>
        </section>

        <section className="service-process">
          <div>
            <span className="section-index">03</span>
            <h2>From idea to table.</h2>
          </div>
          <ol>
            <li><span>01</span><div><h3>Share the occasion</h3><p>Tell us the date, location, guest count and what you have in mind.</p></div></li>
            <li><span>02</span><div><h3>Shape the menu</h3><p>We refine the food, dietary needs and practical details with you.</p></div></li>
            <li><span>03</span><div><h3>Enjoy with your guests</h3><p>We arrive prepared and deliver the experience.</p></div></li>
          </ol>
        </section>

        <section className="service-final-cta">
          <p>Private dining · Celebrations · Intimate events</p>
          <h2>Bring the restaurant experience home.</h2>
          <Link href="/enquire?service=private" className="brand-button brand-button--light">
            Start your enquiry <ArrowUpRight aria-hidden="true" size={19} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
