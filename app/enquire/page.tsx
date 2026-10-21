import type { Metadata } from "next";
import { Header, Footer } from "../public-shell";
import EnquiryForm from "./enquiry-form";

export const metadata: Metadata = {
  title: "Make an Enquiry | Fork Goodness Baked",
  description:
    "Tell us about your private dinner, celebration or corporate event and we will plan the food with you.",
};

export default function Page() {
  return (
    <>
      <Header />
      <main className="enquiry-page">
        <aside>
          <span className="eyebrow">START A CONVERSATION</span>
          <h1>
            Tell us
            <br />
            <span className="italic">more.</span>
          </h1>
          <p>
            A dinner at home or lunch etc—share the essentials by completing the
            enquiry form so we can work with you to plan the food served at your
            event.
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
