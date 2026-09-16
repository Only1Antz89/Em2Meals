import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Footer, Header } from "./public-shell";
import { HeroAtmosphere } from "./hero-atmosphere";

export default function Home() {
  return (
    <div className="marketing-home">
      <Header variant="overlay" />
      <main>
        <section className="editorial-hero">
          <Image
            className="editorial-hero__image"
            src="/images/em2-hero-chef.png"
            alt="A Black woman chef finishing a plated meal at the kitchen pass"
            fill
            priority
            sizes="100vw"
          />
          <div className="editorial-hero__shade" aria-hidden="true" />
          <HeroAtmosphere />
          <div className="editorial-hero__content">
            <h1>Food worth gathering for.</h1>
            <span className="editorial-rule" aria-hidden="true" />
            <p>
              Private dining for meaningful occasions. Corporate catering for
              productive days. Thoughtfully made in London.
            </p>
            <Link className="primary-cta" href="/enquire">
              Make an enquiry <ArrowUpRight aria-hidden="true" size={20} />
            </Link>
            <div className="hero-service-links" aria-label="Explore our services">
              <Link href="/private-chef">
                Private dining <ArrowUpRight aria-hidden="true" size={17} />
              </Link>
              <Link href="/corporate">
                Corporate catering <ArrowUpRight aria-hidden="true" size={17} />
              </Link>
            </div>
          </div>
        </section>

        <section className="service-chapters" id="services">
          <header className="chapter-heading">
            <h2>Two ways to gather.</h2>
            <p>
              One kitchen, two distinct services. Choose the experience that
              fits the room.
            </p>
          </header>

          <article className="service-chapter service-chapter--private" id="private-service">
            <div className="service-chapter__media">
              <Image
                src="/images/em2-private-chef.png"
                alt="A Black private chef serving dinner to hosts in their London home"
                fill
                sizes="(max-width: 800px) 100vw, 52vw"
              />
            </div>
            <div className="service-chapter__copy">
              <span className="service-chapter__label">For homes &amp; celebrations</span>
              <h3>Private dining</h3>
              <p>
                Personal, unhurried and shaped around your guests. We bring the
                restaurant experience to your table while you stay present for
                the occasion.
              </p>
              <ul>
                <li>Menus designed around you</li>
                <li>In-home preparation and service</li>
                <li>Dinners, celebrations and intimate events</li>
              </ul>
              <Link className="chapter-link" href="/private-chef">
                Explore private dining <ArrowUpRight aria-hidden="true" size={18} />
              </Link>
            </div>
          </article>

          <article className="service-chapter service-chapter--corporate" id="corporate-service">
            <div className="service-chapter__media">
              <Image
                src="/images/em2-corporate-team.png"
                alt="Black catering professionals arranging a working lunch in a London office"
                fill
                sizes="(max-width: 800px) 100vw, 52vw"
              />
            </div>
            <div className="service-chapter__copy">
              <span className="service-chapter__label">For workplaces &amp; teams</span>
              <h3>Corporate catering</h3>
              <p>
                Clear, reliable and built around the agenda. Food that arrives
                ready for the team, with the practical details handled.
              </p>
              <ul>
                <li>Breakfasts and working lunches</li>
                <li>Headcounts and dietary needs organised</li>
                <li>Meetings, client days and team events</li>
              </ul>
              <Link className="chapter-link" href="/corporate">
                Explore corporate catering <ArrowUpRight aria-hidden="true" size={18} />
              </Link>
            </div>
          </article>
        </section>

        <section className="home-story" id="story">
          <div className="home-story__title">
            <span className="story-mark" aria-hidden="true">EM²</span>
            <h2>
              Emma’s square meals.
              <br />
              <em>Anything but ordinary.</em>
            </h2>
          </div>
          <div className="home-story__body">
            <p>
              Some meals hold a milestone. Others give a working day its
              rhythm. Both deserve food made with purpose.
            </p>
            <p>
              EM² Meals is a Black-owned, independent London business bringing
              people together through generous food and considered service.
            </p>
            <span className="location-line">
              <MapPin aria-hidden="true" size={17} /> London
            </span>
          </div>
        </section>

        <section className="closing-invitation">
          <div>
            <h2>Let’s make the next meal matter.</h2>
            <p>
              Tell us who is gathering, when and what the moment needs. We will
              shape the food and service around it.
            </p>
            <Link className="primary-cta primary-cta--burgundy" href="/enquire">
              Start your enquiry <ArrowUpRight aria-hidden="true" size={20} />
            </Link>
          </div>
          <nav aria-label="Choose a service">
            <Link href="/private-chef">
              Private dining <ArrowUpRight aria-hidden="true" size={18} />
            </Link>
            <Link href="/corporate">
              Corporate catering <ArrowUpRight aria-hidden="true" size={18} />
            </Link>
          </nav>
        </section>
      </main>
      <Footer />
    </div>
  );
}
