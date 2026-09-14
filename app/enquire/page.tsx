import { Header, Footer } from "../public-shell";
import EnquiryForm from "./enquiry-form";
export default function Page() {
  return (
    <>
      <Header />
      <main className="enquiry-page">
        <aside>
          <span className="eyebrow">A GOOD MEAL STARTS HERE</span>
          <h1>
            Tell us what
            <br />
            you have
            <br />
            <span className="italic">in mind.</span>
          </h1>
          <p>
            From a table for two to a lunch for the whole team. Share a few
            details and we’ll shape the next steps together.
          </p>
          <div className="enquiry-note">
            LONDON & WITHIN THE M25
            <br />
            <span>Every enquiry is personally reviewed.</span>
          </div>
        </aside>
        <EnquiryForm />
      </main>
      <Footer />
    </>
  );
}
