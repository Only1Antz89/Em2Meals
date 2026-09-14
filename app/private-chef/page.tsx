import { Header, Footer } from "../public-shell";
import { ArrowUpRight } from "lucide-react";
export default function Page() {
  return (
    <>
      <Header />
      <main className="private-page">
        <section className="service-hero">
          <img
            src="/images/private-dining.jpg"
            alt="Gourmet pasta with colourful garnishes on a black plate"
          />
          <div>
            <span className="eyebrow">PRIVATE CHEF & EVENTS · LONDON</span>
            <h1>
              A seat at your table.
              <br />
              <span className="italic">An occasion to remember.</span>
            </h1>
            <p>
              Exceptional food, prepared around you. Bring a private chef into
              your home or let us take care of the food for your next
              celebration.
            </p>
            <a href="/enquire?service=private" className="solid-cta gold">
              Plan your occasion <ArrowUpRight size={19} />
            </a>
          </div>
        </section>
        <section className="service-intro">
          <span className="eyebrow">YOUR OCCASION, YOUR WAY</span>
          <h2>
            All the pleasure.
            <br />
            <span className="italic">Every detail considered.</span>
          </h2>
          <p>
            From an intimate dinner to a room full of your favourite people, we
            shape the menu, preparation and service around the way you want to
            gather.
          </p>
        </section>
        <section className="service-grid">
          <article>
            <span>01</span>
            <h3>Private dining</h3>
            <p>
              A considered menu, cooked and presented in your home. Settle into
              the conversation while we take care of the kitchen.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Celebrations & events</h3>
            <p>
              Milestone birthdays, family gatherings and special evenings. Food
              that feels as personal as the occasion.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>On site or off site</h3>
            <p>
              Choose cooking at your venue or preparation in our kitchen, with
              delivery and finishing arrangements agreed together.
            </p>
          </article>
        </section>
        <section className="chef-section">
          <img
            src="/images/chef.jpg"
            alt="Chef in a red apron preparing fresh herbs in a kitchen"
          />
          <div>
            <span className="eyebrow">CARE YOU CAN TASTE</span>
            <h2>
              In good hands.
              <br />
              <span className="italic">From the first idea.</span>
            </h2>
            <p>
              Our approach brings restaurant-level attention to your own
              setting: thoughtful ingredients, careful preparation and service
              that lets you enjoy being the host.
            </p>
            <p>
              Tell us what you love, who’s coming and how you want the evening
              to feel. We’ll work through the menu, dietary requirements and
              practical details with you.
            </p>
            <small>Photography illustrates our service style.</small>
          </div>
        </section>
        <section className="process">
          <span className="eyebrow">LET’S MAKE IT HAPPEN</span>
          <h2>
            Something special starts
            <br />
            with a conversation.
          </h2>
          <div className="process-steps">
            <p>
              <b>01 / Tell us your plans</b>Share your date, venue, guest count
              and ideas.
            </p>
            <p>
              <b>02 / Make it yours</b>We shape your menu and confirm the
              details.
            </p>
            <p>
              <b>03 / Enjoy the occasion</b>Let the food bring everyone
              together.
            </p>
          </div>
          <a className="solid-cta gold" href="/enquire?service=private">
            Plan your occasion <ArrowUpRight size={19} />
          </a>
        </section>
      </main>
      <Footer />
    </>
  );
}
