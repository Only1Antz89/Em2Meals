"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form-controls";
import type { Place } from "@/lib/operations";
export function VenueSearch({
  onSelect,
  admin = false,
}: {
  onSelect: (place: Place) => void;
  admin?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Place[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function search() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(admin ? "/api/admin/places" : "/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const j = (await r.json()) as { places: Place[]; error?: string };
      if (!r.ok) throw Error(j.error || "Venue search failed");
      setPlaces(j.places);
      if (!j.places.length)
        setError(
          "No venues found. Try another name or enter the address manually.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="venue-search wide">
      <div className="inline-actions">
        <Field
          label="Search for a public venue"
          value={query}
          onChange={setQuery}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || query.trim().length < 3}
          onClick={search}
        >
          {busy ? "Searching…" : "Find venue"}
        </Button>
      </div>
      {error && <p role="status">{error}</p>}
      <div className="place-results">
        {places.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => {
              onSelect(p);
              setPlaces([]);
            }}
          >
            <b>{p.name}</b>
            <span>{p.address}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
