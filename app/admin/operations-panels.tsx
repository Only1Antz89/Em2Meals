"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useOps } from "./ops-context";
import { Panel, GridTable, Tag } from "./admin-client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Field } from "@/components/form-controls";
import { VenueSearch } from "@/components/venue-search";
import { money, today, available, type Order, type State } from "@/lib/domain";
import {
  expiryStatus,
  shortage,
  reservedFor,
  proposals,
  symbols,
  type Place,
  type Offering,
  type Research,
} from "@/lib/operations";
export function ExpiryBadge({
  expiry,
  dateType,
}: {
  expiry: string;
  dateType: string;
}) {
  const { s } = useOps();
  const [day, setDay] = useState(today());
  useEffect(() => {
    const refresh = () => setDay(today());
    const timer = setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const status = expiryStatus(
    expiry,
    dateType,
    day,
    s.settings.warningDays ?? 7,
    s.settings.urgentDays ?? 3,
  );
  return (
    <span>
      <Tag tone={status.tone}>{status.label}</Tag>
      <small className="subtext">
        {dateType} · {expiry || "Not recorded"}
      </small>
    </span>
  );
}
export function StockSummary() {
  const { s } = useOps();
  const buying = proposals(s);
  return (
    <Panel title="Stock commitments">
      <GridTable
        heads={[
          "Ingredient",
          "On hand",
          "Reserved",
          "Eligible available",
          "Incoming",
          "To purchase",
        ]}
        rows={s.ingredients.map((i) => {
          const batches = s.batches.filter((b) => b.ingredientId === i.id);
          const unit = (q: number) => `${+q.toFixed(2)} ${i.unit}`;
          return [
            <span key="cell-0">
              {i.category && symbols[i.category]} {i.name}
            </span>,
            unit(batches.reduce((n, b) => n + b.quantity, 0)),
            unit(s.orders.reduce((n, o) => n + reservedFor(s, o, i.id), 0)),
            unit(
              batches
                .filter((b) => b.expiry && b.expiry >= today())
                .reduce((n, b) => n + Math.max(0, available(s, b.id)), 0),
            ),
            unit(
              s.purchases
                .filter(
                  (p) => p.ingredientId === i.id && p.status === "ordered",
                )
                .reduce(
                  (n, p) => n + p.quantity - (p.receivedQuantity || 0),
                  0,
                ),
            ),
            unit(
              buying
                .flatMap((p) => p.lines)
                .filter((l) => l.ingredientId === i.id)
                .reduce((n, l) => n + l.required, 0),
            ),
          ];
        })}
      />
      <p className="panel-note">
        On hand includes reserved ingredients until packaging. Only dated,
        eligible stock is available. Incoming deliveries are estimates until
        received.
      </p>
    </Panel>
  );
}
export function OrderStock({ order: o }: { order: Order }) {
  const { s, open, href, run, busy } = useOps();
  const [reconcile, setReconcile] = useState(false),
    [used, setUsed] = useState<Record<string, string>>({}),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  const rows = shortage(s, o);
  return (
    <Panel
      title={
        o.costSnapshot
          ? "Stock impact & actual usage"
          : "Stock impact if accepted"
      }
      action={
        <a href={`${href("business")}&tab=purchasing`}>
          Purchasing & supplier drafts →
        </a>
      }
    >
      <GridTable
        heads={[
          "Ingredient",
          "Required",
          "Available for this order",
          "Shortfall",
          "Supplier / ETA",
        ]}
        rows={rows.map((l) => {
          const i = s.ingredients.find((i) => i.id === l.ingredientId)!;
          const offer = s.offerings.find(
            (x) => x.ingredientId === i.id && x.preferred,
          );
          const sup = s.suppliers.find((x) => x.id === offer?.supplierId);
          const eta = sup
            ? new Date(Date.parse(today()) + sup.leadDays * 86400000)
                .toISOString()
                .slice(0, 10)
            : "";
          return [
            i.name,
            `${+l.quantity.toFixed(2)} ${i.unit}`,
            `${+l.available.toFixed(2)} ${i.unit}`,
            <Tag key="cell-3" tone={l.shortage > 0 ? "red" : "green"}>
              {+l.shortage.toFixed(2)}
            </Tag>,
            <span key="cell-4">
              {sup?.name || "Assign supplier"}
              <small className="subtext">
                {eta
                  ? `${eta} · ${o.details.date && eta > o.details.date ? "Late for event" : "estimated"}`
                  : "ETA unknown"}
              </small>
            </span>,
          ];
        })}
      />
      {!o.items.length && (
        <p className="panel-note">
          Confirm recipe matches and portions to calculate demand.
        </p>
      )}
      {!o.costSnapshot && (
        <p className="panel-note">
          This preview leaves existing accepted commitments unchanged. No stock
          is reserved yet.
        </p>
      )}
      {o.costSnapshot &&
        !o.consumed &&
        !["cancelled", "declined", "delivered"].includes(o.status) && (
          <div className="inline-actions">
            <Button
              variant="outline"
              onClick={() =>
                open({
                  title: "Record actual ingredient usage",
                  action: "usage",
                  values: {
                    orderId: o.id,
                    ingredientId: rows[0]?.ingredientId || "",
                    quantity: rows[0]?.quantity || 0,
                  },
                  fields: [
                    {
                      key: "ingredientId",
                      label: "Ingredient",
                      options: s.ingredients.map((i) => ({
                        value: i.id,
                        label: `${i.name} (${i.unit})`,
                      })),
                    },
                    {
                      key: "quantity",
                      label:
                        "Total actual quantity for this order (base units)",
                      type: "number",
                    },
                    {
                      key: "reason",
                      label:
                        "Reason: extra usage, accident, or unused quantity",
                      required: true,
                    },
                  ],
                })
              }
            >
              Adjust actual usage
            </Button>
            {["prepared", "cooked"].includes(o.status) && (
              <Button
                variant="outline"
                onClick={() => {
                  setReconcile(true);
                  setUsed(
                    Object.fromEntries(
                      rows.map((l) => [l.ingredientId, String(l.quantity)]),
                    ),
                  );
                }}
              >
                Reconcile & cancel
              </Button>
            )}
          </div>
        )}
      {!!o.usage?.length && (
        <p className="panel-note">
          {o.usage
            .map(
              (u) =>
                `${s.ingredients.find((i) => i.id === u.ingredientId)?.name}: ${u.quantity} — ${u.reason}`,
            )
            .join("; ")}
        </p>
      )}
      {reconcile && (
        <form
          className="reconciliation-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await run("cancel-reconcile", {
                orderId: o.id,
                reason,
                used: Object.entries(used).map(([ingredientId, q]) => ({
                  ingredientId,
                  quantity: Number(q),
                })),
              });
              setReconcile(false);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <h3>Reconcile before cancellation</h3>
          <p>
            Enter what has actually been consumed or wasted. The rest is
            released as reusable stock.
          </p>
          {Object.entries(used).map(([id, q]) => (
            <Field
              key={id}
              label={`${s.ingredients.find((i) => i.id === id)?.name} used (${s.ingredients.find((i) => i.id === id)?.unit})`}
              type="number"
              min="0"
              step="any"
              value={q}
              onChange={(v) => setUsed({ ...used, [id]: v })}
            />
          ))}
          <Field
            label="Reconciliation reason"
            required
            value={reason}
            onChange={setReason}
          />
          {error && <p role="alert">{error}</p>}
          <Button disabled={busy}>Record usage & cancel order</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setReconcile(false)}
          >
            Keep order
          </Button>
        </form>
      )}
    </Panel>
  );
}
export function OrderVenue({ order: o }: { order: Order }) {
  const { s, run, api, integrations, busy, open } = useOps();
  const [error, setError] = useState(""),
    [map, setMap] = useState<Place | undefined>(undefined),
    [departure, setDeparture] = useState(
      o.details.date && o.details.arrivalTime
        ? `${o.details.date}T${o.details.arrivalTime}`
        : "",
    ),
    [venueHours, setVenueHours] = useState("4"),
    [parkingCostOverride, setParkingCost] = useState<string | null>(null),
    [otherCost, setOtherCost] = useState("0");
  const attempted = useRef("");
  const key = JSON.stringify({
    kind: "venue",
    input: {
      name: o.details.venue,
      address: o.details.address,
      date: o.details.date,
      time: o.details.arrivalTime,
      place: o.details.place,
    },
  });
  const stale = o.venueResearch?.key !== key;
  const research = useCallback(
    async (refresh = false) => {
      try {
        setError("");
        await api("research", { kind: "venue", id: o.id, refresh });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [api, o.id],
  );
  useEffect(() => {
    if (
      integrations.gemini &&
      o.details.address &&
      stale &&
      !busy &&
      attempted.current !== key
    ) {
      attempted.current = key;
      void research();
    }
  }, [key, stale, busy, integrations.gemini, o.details.address, research]);
  async function select(place: Place) {
    try {
      await run("venue-select", { orderId: o.id, place });
      setMap(place);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const selectedMap = map || o.details.place;
  const enteredVenueHours = Number(venueHours);
  const durationMinutes = Number.isFinite(enteredVenueHours)
    ? Math.max(0, Math.round(enteredVenueHours * 60))
    : 0;
  const pricedParking = o.venueResearch?.parkingOptions?.find(
    (option) => option.hourlyRatePence !== null,
  );
  const estimatedParkingPence =
    pricedParking?.hourlyRatePence !== null &&
    pricedParking?.hourlyRatePence !== undefined
    ? Math.min(
        pricedParking.hourlyRatePence * Math.ceil(durationMinutes / 60),
        pricedParking.dailyCapPence ?? Number.POSITIVE_INFINITY,
      )
    : 0;
  const parkingCost =
    parkingCostOverride ?? (estimatedParkingPence / 100).toFixed(2);
  const poundsToPence = (value: string) => {
    const pounds = Number(value);
    return Number.isFinite(pounds) ? Math.max(0, Math.round(pounds * 100)) : 0;
  };
  async function calculateRoute() {
    try {
      setError("");
      await api("route", {
        orderId: o.id,
        departure: new Date(departure).toISOString(),
        returnTrip: true,
        venueDurationMinutes: durationMinutes,
        parkingCost: poundsToPence(parkingCost),
        otherCost: poundsToPence(otherCost),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Panel
      title="Venue, parking, access & journey estimate"
      action={
        <Button
          variant="outline"
          disabled={busy || !integrations.gemini}
          title={
            !integrations.gemini
              ? "AutoSous is not available in this deployment"
              : undefined
          }
          onClick={() => research(true)}
        >
          Refresh research
        </Button>
      }
    >
      <VenueSearch admin onSelect={select} />
      {error && <p role="status">{error}</p>}
      <div className="journey-grid">
        <div>
          {o.venueResearch ? (
            <>
              <Tag tone={stale ? "amber" : ""}>
                {stale
                  ? "Venue or timing changed — refresh needed"
                  : "Public research · verify before travel"}
              </Tag>
              <p className="research-text">{o.venueResearch.text}</p>
              <small>
                Researched{" "}
                {new Date(o.venueResearch.at).toLocaleString("en-GB")}
              </small>
              <ul>
                {o.venueResearch.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="empty-state">
              {integrations.gemini
                ? "Venue research will appear here."
                : "AutoSous setup required. Customer access instructions remain available."}
            </p>
          )}
          <h3>Customer access instructions</h3>
          <p>{o.details.access || "None supplied"}</p>
        </div>
        <div>
          <iframe
            title="Venue and selected car park map"
            loading="lazy"
            className="venue-map"
            src={`https://www.google.com/maps?q=${encodeURIComponent(selectedMap ? `${selectedMap.latitude},${selectedMap.longitude}` : o.details.address || o.details.venue)}&output=embed`}
          />
          {o.details.place && (
            <Button variant="ghost" onClick={() => setMap(o.details.place)}>
              Venue marker
            </Button>
          )}
          {o.venueResearch?.carParks?.map((p) => (
            <div className="car-park" key={p.id}>
              <Button variant="outline" onClick={() => setMap(p)}>
                📍 {p.name}
              </Button>
              <p>{p.address}</p>
              <a href={p.mapUrl} target="_blank" rel="noreferrer">
                Directions & parking details ↗
              </a>
            </div>
          ))}
        </div>
      </div>
      <section className="journey-planner" aria-labelledby="journey-heading">
        <div className="journey-planner-heading">
          <div>
            <h3 id="journey-heading">Round-trip journey & parking estimate</h3>
            <p>
              The return route is calculated separately after the planned time
              at the venue, so traffic can differ in each direction.
            </p>
          </div>
        </div>
        <div className="form-grid">
          <Field
            label="Leave kitchen (your device timezone)"
            type="datetime-local"
            value={departure}
            onChange={setDeparture}
          />
          <Field
            label="Expected time at venue (hours)"
            type="number"
            min="0"
            step="0.25"
            value={venueHours}
            onChange={setVenueHours}
          />
          <Field
            label="Estimated parking (£)"
            type="number"
            min="0"
            step="0.01"
            value={parkingCost}
            onChange={setParkingCost}
          />
          <Field
            label="Tolls / other charges (£)"
            type="number"
            min="0"
            step="0.01"
            value={otherCost}
            onChange={setOtherCost}
          />
        </div>
        <div className="parking-guidance">
          <h3>Parking systems & duration-based costs</h3>
          {o.venueResearch?.parkingOptions?.length ? (
            o.venueResearch.parkingOptions.map((option, index) => {
              const estimate = option.hourlyRatePence !== null
                ? Math.min(
                    option.hourlyRatePence * Math.ceil(durationMinutes / 60),
                    option.dailyCapPence ?? Number.POSITIVE_INFINITY,
                  )
                : null;
              const overMaximum =
                option.maximumStayMinutes !== null &&
                durationMinutes > option.maximumStayMinutes;
              return (
                <div
                  className="parking-option"
                  key={`${option.name}-${option.tariff}-${index}`}
                >
                  <div>
                    <strong>{option.name}</strong>
                    <span>{option.paymentSystem || "Payment method not confirmed"}</span>
                  </div>
                  <p>{option.tariff || "Published tariff not confirmed"}</p>
                  <b>{estimate === null ? "Cost needs confirmation" : `Approx. ${money(estimate)} for ${venueHours || 0} hours`}</b>
                  {overMaximum && (
                    <small className="parking-warning">
                      Planned stay exceeds the published maximum stay.
                    </small>
                  )}
                </div>
              );
            })
          ) : (
            <p className="empty-state compact">
              Refresh venue research to look for RingGo, PayByPhone, PayPark,
              on-site machines, validation rules and published tariffs. Confirm
              unknown charges with the venue.
            </p>
          )}
          {pricedParking && (
            <small>
              The parking field uses {pricedParking.name}&apos;s published
              hourly rate, rounded up to started hours and capped where a daily
              maximum is known. You can edit it before calculating.
            </small>
          )}
        </div>
        <div className="inline-actions">
          <Button disabled={busy || !departure} onClick={calculateRoute}>
            Calculate round trip with Google Maps
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              open({
                title: "Manual round-trip journey estimate",
                action: "route",
                values: {
                  orderId: o.id,
                  departure,
                  returnTrip: true,
                  venueDurationMinutes: durationMinutes,
                  parkingCost: poundsToPence(parkingCost),
                  otherCost: poundsToPence(otherCost),
                  extraCost:
                    poundsToPence(parkingCost) + poundsToPence(otherCost),
                  miles: o.route?.miles || 0,
                  minutes: o.route?.minutes || 0,
                },
                fields: [
                  {
                    key: "miles",
                    label: "Total round-trip miles",
                    type: "number",
                  },
                  {
                    key: "minutes",
                    label: "Total round-trip driving minutes",
                    type: "number",
                  },
                ],
              })
            }
          >
            Enter manually
          </Button>
        </div>
        {o.route && (
          <div className="route-result">
            <strong>
              {o.route.miles.toFixed(1)} miles round trip · {Math.ceil(o.route.minutes)} minutes driving
            </strong>
            {o.route.outboundMiles !== undefined && (
              <p>
                To venue: {o.route.outboundMiles.toFixed(1)} miles · {Math.ceil(o.route.outboundMinutes || 0)} minutes
                <br />
                Return: {(o.route.returnMiles || 0).toFixed(1)} miles · {Math.ceil(o.route.returnMinutes || 0)} minutes
                {o.route.returnDeparture && (
                  <>
                    <br />Estimated return departure: {new Date(o.route.returnDeparture).toLocaleString("en-GB")}
                  </>
                )}
              </p>
            )}
            <p>
              {s.settings.bufferMinutes} minutes additional loading buffer.
              <br />
              Fuel: {o.route.fuelCost === null ? "Enter MPG and petrol price in Settings" : money(o.route.fuelCost)} · Parking: {money(o.route.parkingCost ?? o.route.extraCost)} · Other charges: {money(o.route.otherCost ?? 0)}
            </p>
            <small>
              {o.route.source} · {new Date(o.route.at).toLocaleString("en-GB")}
            </small>
          </div>
        )}
        <p className="panel-note">
          Parking prices are planning estimates from public information. Check
          signage, app location codes, operating hours and restrictions on arrival.
        </p>
      </section>
    </Panel>
  );
}
type SupplierRecord = State["suppliers"][number];

function faviconFor(website?: string) {
  if (!website) return "";
  try {
    return `${new URL(website).origin}/favicon.ico`;
  } catch {
    return "";
  }
}

function websiteHost(website?: string) {
  if (!website) return "";
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function SupplierMark({ supplier }: { supplier: SupplierRecord }) {
  const sources = [supplier.logoUrl, faviconFor(supplier.website)].filter(
    (source, index, all): source is string =>
      Boolean(source) && all.indexOf(source) === index,
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const initials = supplier.name
    .replace(/·.*/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const source = sources[sourceIndex];
  return (
    <span className="supplier-mark" aria-hidden="true">
      {source ? (
        // Supplier domains are dynamic, so Next Image cannot safely enumerate
        // them. The native image element also lets us fall back on load error.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt=""
          onError={() => setSourceIndex((index) => index + 1)}
        />
      ) : (
        initials || "S"
      )}
    </span>
  );
}

export function SupplierInsights({
  section = "overview",
  onAddSupplier,
  onEditSupplier,
  selectedSupplierId,
  onSelectSupplier,
}: {
  section?: "overview" | "options";
  onAddSupplier?: () => void;
  onEditSupplier?: (supplier: SupplierRecord) => void;
  selectedSupplierId?: string;
  onSelectSupplier?: (supplierId: string) => void;
}) {
  const { s, api, run, open, busy, integrations } = useOps();
  const [result, setResult] = useState<{
      supplierId: string;
      research: Research;
      recommendation: string;
      profile: Record<string, string>;
    } | null>(null),
    [error, setError] = useState("");
  const buying = proposals(s);
  const selectedSupplier = selectedSupplierId
    ? s.suppliers.find((supplier) => supplier.id === selectedSupplierId)
    : undefined;

  if (section === "overview" && selectedSupplier) {
    const supplier = selectedSupplier;
    const offerings = s.offerings.filter(
      (offering) => offering.supplierId === supplier.id,
    );
    const purchases = s.purchases
      .filter((purchase) => purchase.supplierId === supplier.id)
      .sort((a, b) => (b.at || b.eta).localeCompare(a.at || a.eta));
    const requests = s.drafts
      .filter((draft) => draft.supplierId === supplier.id && draft.proposal)
      .sort((a, b) => b.at.localeCompare(a.at));
    const history = [
      ...requests.map((request) => ({
        at: request.at,
        date: request.at.slice(0, 10),
        type: "Purchase request",
        detail: request.subject,
        status: request.purchaseConfirmed
          ? "Purchase confirmed"
          : request.superseded
            ? "Closed"
            : request.sentAt
              ? "Sent — awaiting response"
              : "Draft",
      })),
      ...supplier.comms.map((communication) => ({
        at: communication.at,
        date: new Date(communication.at).toLocaleDateString("en-GB"),
        type: "Communication",
        detail: communication.message,
        status: "Logged",
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return (
      <div className="supplier-detail">
        <div className="supplier-detail-actions">
          <Button variant="ghost" onClick={() => onSelectSupplier?.("")}>
            <ArrowLeft size={16} />
            All suppliers
          </Button>
          {onEditSupplier && (
            <Button variant="outline" onClick={() => onEditSupplier(supplier)}>
              Edit supplier
            </Button>
          )}
        </div>
        <Panel title={supplier.name}>
          <div className="supplier-profile">
            <SupplierMark supplier={supplier} />
            <div>
              <strong>{supplier.contactName || "No contact named"}</strong>
              <span>{supplier.contactRole || "Contact role not recorded"}</span>
              <a href={`mailto:${supplier.email}`}>{supplier.email}</a>
              {supplier.phone && (
                <a href={`tel:${supplier.phone}`}>{supplier.phone}</a>
              )}
            </div>
            <dl>
              <div>
                <dt>Delivery</dt>
                <dd>{money(supplier.deliveryCharge)}</dd>
              </div>
              <div>
                <dt>Minimum order</dt>
                <dd>{money(supplier.minimumOrder)}</dd>
              </div>
              <div>
                <dt>Lead time</dt>
                <dd>
                  {supplier.leadDays}{" "}
                  {supplier.leadDays === 1 ? "day" : "days"}
                </dd>
              </div>
            </dl>
          </div>
          {(supplier.businessDetails || supplier.notes) && (
            <p className="panel-note">
              {[supplier.businessDetails, supplier.notes]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </Panel>
        <Panel title={`Options · ${offerings.length}`}>
          <GridTable
            heads={["Ingredient", "Pack", "Price", "VAT", "Status"]}
            rows={offerings.map((offering) => {
              const ingredient = s.ingredients.find(
                (item) => item.id === offering.ingredientId,
              );
              return [
                ingredient?.name || "Unknown ingredient",
                `${offering.packQuantity} ${ingredient?.unit || "units"}`,
                offering.packCost === null
                  ? "Price not recorded"
                  : money(offering.packCost),
                offering.vatRate === null
                  ? "VAT not recorded"
                  : `${offering.vatRate}% · ${offering.priceMode}`,
                <Tag key="status" tone={offering.preferred ? "green" : ""}>
                  {offering.preferred ? "Preferred" : "Alternative"}
                </Tag>,
              ];
            })}
            empty="No ingredient options are linked to this supplier yet."
          />
        </Panel>
        <Panel title={`Purchases · ${purchases.length}`}>
          <GridTable
            heads={[
              "Ordered",
              "Ingredient",
              "Ordered / received",
              "Cost",
              "ETA",
              "Status",
              "Reference / notes",
            ]}
            rows={purchases.map((purchase) => [
              purchase.at?.slice(0, 10) || "Date not recorded",
              s.ingredients.find(
                (item) => item.id === purchase.ingredientId,
              )?.name || "Unknown ingredient",
              `${purchase.quantity} / ${purchase.receivedQuantity || 0}`,
              money(purchase.cost),
              purchase.eta,
              <Tag key="status">{purchase.status}</Tag>,
              purchase.requestId || purchase.notes || "—",
            ])}
            empty="No purchases have been recorded for this supplier."
          />
        </Panel>
        <Panel
          title={`Requests & communication · ${requests.length + supplier.comms.length}`}
        >
          <GridTable
            heads={["Date", "Type", "Subject / note", "Status"]}
            rows={history.map((item) => [
              item.date,
              item.type,
              item.detail,
              item.status,
            ])}
            empty="No requests or communication have been recorded for this supplier."
          />
        </Panel>
      </div>
    );
  }

  return (
    <>
      {section === "overview" && (
      <Panel
        title="Supplier overview"
        action={
          onAddSupplier ? (
            <Button onClick={onAddSupplier}>Add supplier</Button>
          ) : undefined
        }
      >
        <div className="supplier-grid">
          {s.suppliers.map((sup) => {
            const websiteLabel = websiteHost(sup.website);
            const purchases = s.purchases
              .filter((p) => p.supplierId === sup.id)
              .sort((a, b) => (b.at || b.eta).localeCompare(a.at || a.eta));
            const ids = s.offerings
              .filter((o) => o.supplierId === sup.id)
              .map((o) => o.ingredientId);
            const counts = new Map<string, number>();
            for (const p of purchases)
              counts.set(p.ingredientId, (counts.get(p.ingredientId) || 0) + 1);
            const typical = [...counts]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([id]) => s.ingredients.find((i) => i.id === id)?.name);
            const next = buying
              .find((p) => p.supplierId === sup.id)
              ?.lines.map((l) => l.deadline)
              .sort()[0];
            return (
              <article key={sup.id} className="supplier-card">
                <header className="supplier-card-header">
                  <SupplierMark key={`${sup.logoUrl}-${sup.website}`} supplier={sup} />
                  <div>
                    <h3>
                      <button
                        type="button"
                        className="supplier-name-link"
                        onClick={() => onSelectSupplier?.(sup.id)}
                      >
                        {sup.name}
                      </button>
                    </h3>
                    {sup.website && websiteLabel ? (
                      <a href={sup.website} target="_blank" rel="noreferrer">
                        {websiteLabel} ↗
                      </a>
                    ) : (
                      <span className="supplier-muted">Website to add</span>
                    )}
                    <a href={`mailto:${sup.email}`}>{sup.email}</a>
                    {sup.contactName ? (
                      <span className="supplier-muted">
                        {sup.contactName}
                        {sup.contactRole ? ` · ${sup.contactRole}` : ""}
                      </span>
                    ) : null}
                  </div>
                  {onEditSupplier && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${sup.name}`}
                      onClick={() => onEditSupplier(sup)}
                    >
                      Edit
                    </Button>
                  )}
                </header>
                <dl className="supplier-facts">
                  <div>
                    <dt>Last order</dt>
                    <dd>
                      {purchases[0]
                        ? purchases[0].at?.slice(0, 10) ||
                          `${purchases[0].eta} (legacy delivery date)`
                        : "No purchase history"}
                    </dd>
                  </div>
                  <div>
                    <dt>Next expected order</dt>
                    <dd>{next || "No accepted-order shortage"}</dd>
                  </div>
                  <div>
                    <dt>Typically ordered</dt>
                    <dd>{typical.join(", ") || "Not enough history"}</dd>
                  </div>
                  <div>
                    <dt>Used in recipes</dt>
                    <dd>
                      {s.recipes
                        .filter((r) =>
                          r.lines.some((l) => ids.includes(l.ingredientId)),
                        )
                        .map((r) => r.name)
                        .join(", ") || "No linked recipes"}
                    </dd>
                  </div>
                </dl>
                <Button
                  className="supplier-research"
                  variant="outline"
                  disabled={busy || !integrations.gemini}
                  title={
                    !integrations.gemini
                      ? "AutoSous is not available in this deployment"
                      : undefined
                  }
                  onClick={async () => {
                    try {
                      setError("");
                      setResult({
                        ...(await api("research", {
                          kind: "supplier",
                          id: sup.id,
                        })),
                        supplierId: sup.id,
                      });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Research business & suggestions
                </Button>
              </article>
            );
          })}
          {!s.suppliers.length && (
            <div className="empty-state">
              Add your first supplier to track terms, ingredients and orders.
            </div>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
        {result && (
          <div className="research-review">
            <h3>Confirm supplier identity before applying</h3>
            <p className="research-text">{result.research.text}</p>
            <p>{result.recommendation}</p>
            <ul>
              {result.research.sources.map(
                (x: { url: string; title: string }) => (
                  <li key={x.url}>
                    <a href={x.url} target="_blank" rel="noreferrer">
                      {x.title}
                    </a>
                  </li>
                ),
              )}
            </ul>
            <Button
              disabled={busy}
              onClick={async () => {
                try {
                  const sup = s.suppliers.find(
                    (x) => x.id === result.supplierId,
                  )!;
                  const fields = Object.fromEntries(
                    Object.entries(result.profile).filter(([, v]) => v),
                  );
                  await run("supplier", {
                    ...sup,
                    ...fields,
                    research: result.research,
                  });
                  setResult(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Confirm match & apply business details
            </Button>
          </div>
        )}
      </Panel>
      )}
      {section === "options" && (
      <>
      <Panel title="Supplier terms">
        <GridTable
          heads={[
            "Supplier",
            "Delivery",
            "Minimum order",
            "Lead time",
            "Contact",
            "",
          ]}
          rows={s.suppliers.map((supplier) => [
            supplier.name,
            money(supplier.deliveryCharge),
            money(supplier.minimumOrder),
            `${supplier.leadDays} ${supplier.leadDays === 1 ? "day" : "days"}`,
            <span key="contact">
              {supplier.email}
              <small className="subtext">{supplier.phone}</small>
            </span>,
            onEditSupplier ? (
              <Button
                key="edit"
                size="sm"
                variant="outline"
                onClick={() => onEditSupplier(supplier)}
              >
                Edit
              </Button>
            ) : (
              "—"
            ),
          ])}
        />
      </Panel>
      <Panel
        title="Ingredient supplier options"
        action={
          <Button onClick={() => openOffering()}>Add supplier option</Button>
        }
      >
        <GridTable
          heads={[
            "Ingredient",
            "Supplier",
            "Pack",
            "Price",
            "VAT",
            "Preferred",
            "",
          ]}
          rows={s.offerings.map((o) => [
            s.ingredients.find((i) => i.id === o.ingredientId)?.name,
            s.suppliers.find((x) => x.id === o.supplierId)?.name,
            `${o.packQuantity} ${s.ingredients.find((i) => i.id === o.ingredientId)?.unit}`,
            o.packCost === null ? "Unknown" : money(o.packCost),
            o.vatRate === null ? "Unknown" : `${o.vatRate}% · ${o.priceMode}`,
            o.preferred ? "Preferred" : "Alternative",
            <Button
              key="cell-6"
              variant="outline"
              onClick={() => openOffering(o)}
            >
              Edit
            </Button>,
          ])}
        />
        <p className="panel-note">
          Delivery charges, minimums and calendar-day lead times come from the
          supplier profile. Prices here are used for purchasing estimates.
        </p>
      </Panel>
      </>
      )}
    </>
  );
  function openOffering(o?: Offering) {
    open({
      title: "Supplier ingredient option",
      action: "offering",
      values: o
        ? {
            ...o,
            price: o.packCost == null ? "" : String(o.packCost / 100),
            taxRate: o.vatRate == null ? "" : String(o.vatRate),
            preferred: o.preferred ? "yes" : "no",
          }
        : { priceMode: "exclusive", preferred: "yes" },
      fields: [
        {
          key: "ingredientId",
          label: "Ingredient",
          options: s.ingredients.map((i) => ({
            value: i.id,
            label: `${i.name} (${i.unit})`,
          })),
        },
        {
          key: "supplierId",
          label: "Supplier",
          options: s.suppliers.map((x) => ({ value: x.id, label: x.name })),
        },
        {
          key: "packQuantity",
          label: "Pack quantity (base units)",
          type: "number",
        },
        { key: "price", label: "Pack price (£); leave blank if unknown" },
        { key: "taxRate", label: "VAT rate (%); leave blank if unknown" },
        {
          key: "priceMode",
          label: "Price entry",
          options: ["exclusive", "inclusive"],
        },
        {
          key: "preferred",
          label: "Preferred supplier",
          options: ["yes", "no"],
        },
      ],
      transform: (v) => ({
        ...v,
        packCost: v.price === "" ? null : Math.round(Number(v.price) * 100),
        vatRate: v.taxRate === "" ? null : Number(v.taxRate),
        preferred: v.preferred === "yes",
      }),
    });
  }
}

export function UpcomingVenueResearch() {
  const { s, api, busy, integrations } = useOps();
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    const pending = s.orders.find(
      (o) =>
        o.details.place &&
        !o.venueResearch &&
        !["delivered", "cancelled", "declined"].includes(o.status) &&
        !attempted.current.has(o.id),
    );
    if (!pending || busy || !integrations.gemini) return;
    attempted.current.add(pending.id);
    void api("research", { kind: "venue", id: pending.id }).catch(
      () => undefined,
    );
  }, [s.orders, api, busy, integrations.gemini]);
  return null;
}
