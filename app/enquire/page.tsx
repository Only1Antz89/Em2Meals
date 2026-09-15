import { Header, Footer } from "../public-shell";
import EnquiryForm from "./enquiry-form";
export default function Page() {
  return (
    <>
      <Header />
      <main className="enquiry-page">
        <aside>
          <span className="eyebrow">START A CONVERSATION</span>
          <h1>
            Tell us about
            <br />
            the table you
            <br />
            <span className="italic">are planning.</span>
          </h1>
          <p>
            A dinner at home or lunch for the whole team—share the essentials
            and we will come back to you with the right next step.
          </p>
          <div className="enquiry-note">
            LONDON
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
