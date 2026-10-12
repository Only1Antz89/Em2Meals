import type { Metadata } from "next";
import { Header, Footer } from "../public-shell";

export const metadata: Metadata = {
  title: "Privacy | Fork Goodness Baked",
  description:
    "How Fork Goodness Baked collects, uses and protects the information you share in an enquiry, and how to ask for it to be corrected or erased.",
};

export default function Page() {
  return (
    <>
      <Header />
      <main className="policy">
        <span className="eyebrow">YOUR INFORMATION</span>
        <h1>Privacy at Fork Goodness Baked</h1>
        <p>
          This private pilot collects enquiry contact details, event information
          and any dietary requirements you choose to provide, so the owner can
          respond and organise catering.
        </p>
        <h2>Access and use</h2>
        <p>
          Business records and attendee requirements are restricted to the
          authorised owner. Please use guest references where possible and avoid
          providing information that is not needed to arrange a meal.
        </p>
        <h2>Connected services</h2>
        <p>
          When configured, AutoSous helps the owner review requests and
          Google Maps supports venue and journey planning. Email delivery uses
          SMTP2GO, which also notifies the owner of each new enquiry with your
          name, contact details and event summary (never dietary details). The
          owner reviews dietary decisions and outgoing emails.
          Public venue searches do not include guest names or allergy details.
        </p>
        <h2>Corrections and deletion</h2>
        <p>
          Ask the owner to correct or erase your information using the contact
          channel through which they respond. On request, your contact
          details, enquiry text, dietary and venue details are permanently
          erased; issued invoices are kept only as long as accounting law
          requires. Business contact details and the retention schedule must
          be completed before public launch.
        </p>
        <h2>Browser storage</h2>
        <p>
          The dashboard may remember your sample/live view on this device.
          Business records are stored in the server database. This pilot does
          not include advertising trackers.
        </p>
      </main>
      <Footer />
    </>
  );
}
