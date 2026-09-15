import { Header, Footer } from "../public-shell";
export default function Page() {
  return (
    <>
      <Header />
      <main className="policy">
        <span className="eyebrow">YOUR INFORMATION</span>
        <h1>Privacy at EM² Meals</h1>
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
          When configured, Google Gemini helps the owner review requests and
          Google Maps supports venue and journey planning. Email delivery uses
          SMTP2GO. The owner reviews dietary decisions and outgoing emails.
          Public venue searches do not include guest names or allergy details.
        </p>
        <h2>Corrections and deletion</h2>
        <p>
          Ask the owner to correct or remove your enquiry using the contact
          channel through which they respond. Business contact details and the
          retention schedule must be completed before public launch.
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
