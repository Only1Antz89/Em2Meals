"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Notes, Pick } from "@/components/form-controls";
import { type Enquiry, today } from "@/lib/domain";
const initial: Enquiry = {
  service: "private",
  eventType: "",
  attendees: 2,
  date: "",
  eventTime: "",
  arrivalTime: "",
  requests: "",
  dietary: "",
  requirements: [],
  name: "",
  company: "",
  email: "",
  phone: "",
  venue: "",
  address: "",
  postcode: "",
  access: "",
  unknownDetails: "",
};
export default function EnquiryForm() {
  const [data, set] = useState(initial),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reference, setReference] = useState("");
  const key = useRef("");
  const form = useRef<HTMLFormElement>(null);
  const update = (k: keyof Enquiry, v: any) => set((d) => ({ ...d, [k]: v }));
  useEffect(() => {
    key.current = crypto.randomUUID();
    if (new URLSearchParams(location.search).get("service") === "corporate")
      update("service", "corporate");
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (step < 2) {
      if (!data.eventType) {
        setError("Please choose an event type.");
        return;
      }
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          details: data,
          requestKey: key.current,
          website: new FormData(form.current!).get("website") || "",
        }),
      });
      const j: any = await r.json();
      if (!r.ok) throw Error(j.error);
      setReference(j.reference);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to submit. Your details are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (reference)
    return (
      <section className="enquiry-card success-card">
        <Check size={42} />
        <span className="eyebrow">ENQUIRY RECEIVED</span>
        <h2>
          Something delicious
          <br />
          is on the horizon.
        </h2>
        <p>
          Your reference is <strong>{reference}</strong>. We’ll review your
          plans and use the contact details you provided to follow up.
        </p>
        <p>Your booking is not confirmed yet.</p>
        <a className="solid-cta" href="/">
          Back to EM² Meals
        </a>
      </section>
    );
  return (
    <form className="enquiry-card" onSubmit={submit} ref={form}>
      <ol className="form-steps">
        {["Occasion", "Food requirements", "Contact & access"].map((s, i) => (
          <li
            key={s}
            className={i === step ? "active" : i < step ? "done" : ""}
          >
            <span>{i < step ? <Check size={14} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <h2>
        {["The occasion", "A menu for everyone", "The practical details"][step]}
      </h2>
      <p className="form-help">
        {
          [
            "A few details to help us get to know your plans.",
            "Tell us what you love and what your guests need.",
            "Let us know where to find you and how to get in.",
          ][step]
        }
      </p>
      <div className="form-grid">
        {step === 0 && (
          <>
            <Pick
              label="Service"
              value={data.service}
              onChange={(v) => update("service", v)}
              options={[
                { value: "private", label: "Private chef & events" },
                { value: "corporate", label: "Corporate catering" },
              ]}
            />
            <Pick
              label="Type of event"
              value={data.eventType}
              onChange={(v) => update("eventType", v)}
              options={[
                "Private dinner",
                "Celebration",
                "Wedding / reception",
                "Office breakfast",
                "Office lunch",
                "Meeting / pitch",
                "Corporate event",
                "Other",
              ]}
            />
            <Field
              label="Number of attendees"
              type="number"
              min={1}
              required
              value={data.attendees}
              onChange={(v) => update("attendees", Number(v))}
            />
            <Field
              label="Event date (leave blank if unknown)"
              type="date"
              min={today()}
              value={data.date}
              onChange={(v) => update("date", v)}
            />
            <Field
              label="Event start time"
              type="time"
              value={data.eventTime}
              onChange={(v) => update("eventTime", v)}
            />
            <Field
              label="Food arrival time"
              type="time"
              value={data.arrivalTime}
              onChange={(v) => update("arrivalTime", v)}
            />
            <Notes
              label="Requested dishes, theme and service style"
              value={data.requests}
              onChange={(v) => update("requests", v)}
            />
          </>
        )}
        {step === 1 && (
          <>
            <Notes
              label="Dietary requirements and allergies"
              value={data.dietary}
              onChange={(v) => update("dietary", v)}
            />
            <p className="wide form-help">
              Please distinguish allergies from preferences. Add a guest name or
              reference where a specific meal is needed. We’ll confirm these
              details with you.
            </p>
            {data.requirements.map((r, i) => (
              <div className="attendee-row wide" key={i}>
                <Field
                  label="Guest name / reference"
                  required
                  value={r.reference}
                  onChange={(v) =>
                    update(
                      "requirements",
                      data.requirements.map((x, j) =>
                        j === i ? { ...x, reference: v } : x,
                      ),
                    )
                  }
                />
                <Field
                  label="Allergy / meal requirement"
                  value={r.requirements}
                  onChange={(v) =>
                    update(
                      "requirements",
                      data.requirements.map((x, j) =>
                        j === i ? { ...x, requirements: v } : x,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Remove guest ${i + 1}`}
                  onClick={() =>
                    update(
                      "requirements",
                      data.requirements.filter((_, j) => i !== j),
                    )
                  }
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update("requirements", [
                  ...data.requirements,
                  {
                    reference: "",
                    requirements: "",
                    meal: "",
                    reviewed: false,
                  },
                ])
              }
            >
              <Plus size={16} /> Add guest requirement
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Field
              label="Your name"
              required
              value={data.name}
              onChange={(v) => update("name", v)}
            />
            <Field
              label="Company"
              value={data.company}
              onChange={(v) => update("company", v)}
            />
            <Field
              label="Email"
              type="email"
              required
              value={data.email}
              onChange={(v) => update("email", v)}
            />
            <Field
              label="Phone number"
              type="tel"
              required
              value={data.phone}
              onChange={(v) => update("phone", v)}
            />
            <Field
              label="Venue"
              value={data.venue}
              onChange={(v) => update("venue", v)}
            />
            <Field
              label="Postcode"
              value={data.postcode}
              onChange={(v) => update("postcode", v)}
            />
            <Field
              label="Venue address"
              wide
              value={data.address}
              onChange={(v) => update("address", v)}
            />
            <Notes
              label="Building access, accessibility, loading, parking and permits"
              value={data.access}
              onChange={(v) => update("access", v)}
            />
            <Notes
              label="Anything still to confirm?"
              value={data.unknownDetails}
              onChange={(v) => update("unknownDetails", v)}
            />
            <p className="wide form-help">
              We use these details to respond and plan your catering. Please
              share only the guest information needed for meal requirements.{" "}
              <a href="/privacy">Privacy information</a>
            </p>
            <label className="honeypot" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="form-actions">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
        ) : (
          <small>* Required fields</small>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : step === 2 ? "Send enquiry" : "Continue"}
          <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  );
}
