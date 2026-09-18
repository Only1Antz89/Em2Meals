import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, HeartHandshake, Leaf, MapPin } from "lucide-react";
import { Footer, Header } from "../public-shell";

export const metadata: Metadata = {
  title: "About Us | Fork Goodness Baked",
  description:
    "At Fork Goodness Baked we take pride in tailoring our food and service to meet client's needs. Serving London and the South East.",
};

const values = [
  {
    icon: HeartHandshake,
    title: "Tailored to your needs",
    description:
      "Every menu, occasion and dietary detail is shaped around you, with care given to allergies, preferences and personal tastes.",
  },
  {
    icon: Leaf,
    title: "Fresh & fine ingredients",
    description:
      "We work closely with trusted local suppliers to source the freshest, finest seasonal produce for exceptional dishes.",
  },
  {
    icon: MapPin,
    title: "London & the South East",
    description:
      "An independent business bringing people together through good food savoured right down to the last forkful.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Header active="about" />
      <main className="service-page service-page--about">
        <section className="service-page-hero">
          <div className="service-page-hero__copy">
            <span className="service-kicker">About us · Fork Goodness Baked</span>
            <h1>Tailored food, exceptional moments.</h1>
            <p>
              At Fork Goodness Baked we take pride in tailoring our food and
              service to meet client&apos;s needs. We are passionate about food
              and we work with our suppliers sourcing the freshest and finest
              ingredients to deliver exceptional dishes.
            </p>
            <Link href="/enquire" className="brand-button">
              Plan your food <ArrowUpRight aria-hidden="true" size={19} />
            </Link>
          </div>
          <div className="service-page-hero__image">
            <Image
              src="/images/em2-hero-chef.png"
              alt="A chef finishing an artisanal dish at the kitchen pass"
              fill
              priority
              sizes="(max-width: 800px) 100vw, 58vw"
            />
          </div>
        </section>

        <section className="service-offer">
          <header>
            <span className="section-index">01</span>
            <h2>Our Story &amp; Purpose</h2>
            <p>
              We are an independent business operating in London and the South
              East bringing people together through good food which is savoured
              right down to the last forkful.
            </p>
          </header>
          <div className="service-offer__list">
            {values.map((v) => {
              const Icon = v.icon;
              return (
                <article key={v.title}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <Icon aria-hidden="true" size={22} style={{ color: "var(--brand-burgundy, #8b3a3a)" }} />
                    <h3 style={{ margin: 0 }}>{v.title}</h3>
                  </div>
                  <p>{v.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="service-editorial">
          <div className="service-editorial__image">
            <Image
              src="/images/desserts.jpg"
              alt="Handcrafted artisanal desserts, fresh berry tart and chocolate cake on ceramic plates"
              fill
              sizes="(max-width: 800px) 100vw, 48vw"
            />
          </div>
          <div className="service-editorial__copy">
            <span className="section-index">02</span>
            <h2>Passionate about quality.</h2>
            <p>
              Whether it is a candlelit celebration at home or an all-day corporate
              gathering, our approach combines thoughtful culinary craft with calm,
              dependable service behind the scenes.
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" size={18} /> Seasonal, peak-fresh ingredients
              </li>
              <li>
                <Check aria-hidden="true" size={18} /> Full consideration for allergies &amp; dietary requirements
              </li>
              <li>
                <Check aria-hidden="true" size={18} /> Transparent, unhurried, attentive service
              </li>
            </ul>
          </div>
        </section>

        <section className="service-final-cta">
          <p>London &amp; the South East · Private Dining · Corporate Catering</p>
          <h2>Bring people together around good food.</h2>
          <Link href="/enquire" className="brand-button brand-button--light">
            Start your enquiry <ArrowUpRight aria-hidden="true" size={19} />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
