"use client";
import { useState } from "react";
import { useOps, type Edit } from "./ops-context";
import { Panel, GridTable, Tag } from "./admin-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type State, money, today } from "@/lib/domain";
import { inPeriod, type ReportFilter } from "@/lib/reporting";
import type { VehicleLookup } from "@/lib/dvla";
import {
  costPerMile,
  estimateMpg,
  fuelTypeLabels,
  fuelTypes,
  loadedRate,
  staffRoles,
  staffSummary,
  vehicleSummary,
  type Shift,
  type StaffMember,
  type Vehicle,
} from "@/lib/team-fleet";

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const services = [
  { value: "shared", label: "Shared business" },
  { value: "private", label: "Private services" },
  { value: "corporate", label: "Corporate catering" },
];
const hrs = (n: number) => `${Math.round(n * 100) / 100}h`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const nullIfZero = (v: unknown) => (Number(v) > 0 ? Number(v) : null);
const formatReg = (reg: string) =>
  reg.length > 4 ? `${reg.slice(0, -3)} ${reg.slice(-3)}` : reg;

function orderOptions(s: State) {
  return [
    { value: "", label: "No individual order" },
    ...s.orders.map((o) => ({
      value: o.id,
      label: `${o.reference} · ${o.details.date}`,
    })),
  ];
}

export function vehicleEditor(
  s: State,
  v?: Partial<Vehicle> & { estimatedMpg?: number | null },
): Edit {
  const existing = v?.id ? s.vehicles.find((x) => x.id === v.id) : undefined;
  const base = existing || v || {};
  const suggested =
    v?.estimatedMpg ??
    estimateMpg(base.co2, base.fuelType || "petrol", base.firstRegistered);
  return {
    title: existing ? "Edit vehicle" : "Add vehicle",
    action: "vehicle",
    values: {
      name: "",
      make: "",
      model: "",
      fuelType: "petrol",
      year: null,
      engineCc: null,
      co2: null,
      firstRegistered: "",
      milesPerKwh: 0,
      fuelPrice: s.settings.fuelPrice || 0,
      notes: "",
      ...base,
      registration: base.registration ? formatReg(base.registration) : "",
      mpg: base.mpg || suggested || 0,
      economySource: base.mpg
        ? base.economySource || "manual"
        : suggested
          ? "estimated"
          : "manual",
      isDefault: (existing ? existing.isDefault : !s.vehicles.length) ? "yes" : "no",
      active: existing?.active === false ? "no" : "yes",
    },
    fields: [
      { key: "registration", label: "Registration (number plate)" },
      { key: "name", label: "Nickname (e.g. Catering van)" },
      { key: "make", label: "Make" },
      { key: "model", label: "Model" },
      {
        key: "fuelType",
        label: "Fuel",
        options: fuelTypes.map((f) => ({ value: f, label: fuelTypeLabels[f] })),
      },
      { key: "year", label: "Year of manufacture", type: "number" },
      { key: "firstRegistered", label: "First registered", type: "month" },
      { key: "engineCc", label: "Engine size (cc)", type: "number" },
      { key: "co2", label: "Official CO2 (g/km)", type: "number" },
      {
        key: "mpg",
        label: suggested
          ? `Fuel economy, UK MPG (estimate from CO2: ${suggested})`
          : "Fuel economy, UK MPG",
        type: "number",
      },
      {
        key: "economySource",
        label: "Where the MPG comes from",
        options: [
          { value: "measured", label: "Measured from our own fill-ups" },
          { value: "estimated", label: "Estimated from DVLA CO2 figure" },
          { value: "manual", label: "Manufacturer / other figure" },
        ],
      },
      {
        key: "milesPerKwh",
        label: "Electric only: miles per kWh",
        type: "number",
      },
      {
        key: "fuelPrice",
        label: "Fuel price (£ per litre, or £ per kWh if electric)",
        type: "number",
      },
      { key: "isDefault", label: "Default vehicle for estimates", options: yesNo },
      { key: "active", label: "In use", options: yesNo },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    transform: (x) => ({
      ...x,
      year: nullIfZero(x.year),
      engineCc: nullIfZero(x.engineCc),
      co2: nullIfZero(x.co2),
      isDefault: x.isDefault === "yes",
      active: x.active === "yes",
    }),
  };
}

function staffEditor(m?: StaffMember): Edit {
  return {
    title: m ? "Edit staff member" : "Add staff member",
    action: "staff",
    values: m
      ? { ...m, active: m.active ? "yes" : "no" }
      : {
          role: "Chef",
          employment: "employee",
          onCostPercent: 0,
          active: "yes",
          email: "",
          phone: "",
          notes: "",
        },
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "role", label: "Main role", options: [...staffRoles] },
      {
        key: "employment",
        label: "Employment",
        options: [
          { value: "employee", label: "Employee (PAYE)" },
          { value: "contractor", label: "Freelance / agency" },
          { value: "owner", label: "Owner / director" },
        ],
      },
      { key: "hourlyRate", label: "Hourly pay (£)", type: "money" },
      {
        key: "onCostPercent",
        label: "Employer on-costs % (NI, pension, holiday pay)",
        type: "number",
      },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "active", label: "Currently working with us", options: yesNo },
      { key: "notes", label: "Notes (food hygiene level, availability…)", type: "textarea" },
    ],
    transform: (x) => ({ ...x, active: x.active === "yes" }),
  };
}

export function shiftEditor(
  s: State,
  shift?: Partial<Shift>,
  title?: string,
): Edit {
  const paid = shift?.id
    ? s.finance.find((f) => f.shiftId === shift.id)?.paymentDate || ""
    : "";
  return {
    title: title || (shift?.id ? "Edit assignment / hours" : "Assign staff to a job"),
    action: "shift",
    values: {
      staffId: "",
      orderId: "",
      service: "shared",
      date: today(),
      role: "",
      start: "",
      end: "",
      breakMinutes: 0,
      hours: 0,
      status: "planned",
      notes: "",
      ...shift,
      rateOverride:
        shift?.id && shift.staffId
          ? (() => {
              const m = s.staff.find((x) => x.id === shift.staffId);
              return m && shift.rate !== loadedRate(m) ? shift.rate : 0;
            })()
          : 0,
      paymentDate: paid,
    },
    fields: [
      {
        key: "staffId",
        label: "Staff member",
        required: true,
        options: s.staff
          .filter((m) => m.active || m.id === shift?.staffId)
          .map((m) => ({
            value: m.id,
            label: `${m.name} · ${m.role} · ${money(loadedRate(m))}/h`,
          })),
      },
      { key: "orderId", label: "Job / order", options: orderOptions(s) },
      {
        key: "service",
        label: "Business side (order link takes precedence)",
        options: services,
      },
      {
        key: "role",
        label: "Role on this job (blank = their main role)",
        options: [{ value: "", label: "Their main role" }, ...staffRoles],
      },
      { key: "date", label: "Date", type: "date" },
      {
        key: "status",
        label: "Status",
        options: [
          { value: "planned", label: "Assigned (planned hours)" },
          { value: "worked", label: "Worked (confirmed hours)" },
        ],
      },
      { key: "start", label: "Start time", type: "time" },
      { key: "end", label: "Finish time", type: "time" },
      { key: "breakMinutes", label: "Unpaid break (minutes)", type: "number" },
      {
        key: "hours",
        label: "Hours (only if no start and finish time)",
        type: "number",
      },
      {
        key: "rateOverride",
        label: "Different hourly cost for this job (£, blank = usual)",
        type: "money",
      },
      { key: "paymentDate", label: "Paid date (blank if unpaid)", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    transform: (x) => ({ ...x, paymentDate: x.paymentDate || "" }),
  };
}

function useRange(f: ReportFilter) {
  return (date: string) => inPeriod(date, f);
}

export function VehiclesPanel({ filter }: { filter: ReportFilter }) {
  const { s, open, api, integrations, busy } = useOps();
  const [reg, setReg] = useState("");
  const [tripMiles, setTripMiles] = useState("");
  const [error, setError] = useState("");
  const [looking, setLooking] = useState(false);
  const summary = vehicleSummary(s, useRange(filter));
  const miles = Number(tripMiles) || 0;
  async function lookup() {
    setError("");
    setLooking(true);
    try {
      const { vehicle } = await api<{ vehicle: VehicleLookup }>(
        "vehicle-lookup",
        { registration: reg },
      );
      setReg("");
      open(vehicleEditor(s, vehicle));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLooking(false);
    }
  }
  return (
    <Panel
      title="Vehicles & fuel"
      action={
        <Button variant="outline" onClick={() => open(vehicleEditor(s))}>
          Add by hand
        </Button>
      }
    >
      <form
        className="inline-actions"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup();
        }}
      >
        <Input
          aria-label="Number plate"
          placeholder="Number plate, e.g. AB12 CDE"
          value={reg}
          onChange={(e) => setReg(e.target.value.toUpperCase())}
          style={{ maxWidth: 220 }}
        />
        <Button disabled={busy || looking || reg.trim().length < 2}>
          {looking ? "Looking up…" : "Look up with DVLA"}
        </Button>
        <Input
          aria-label="Trip miles"
          type="number"
          min={0}
          step="any"
          placeholder="Trip miles"
          value={tripMiles}
          onChange={(e) => setTripMiles(e.target.value)}
          style={{ maxWidth: 140 }}
        />
        <span className="panel-note" style={{ padding: 0 }}>
          Enter miles to price a trip in each vehicle.
        </span>
      </form>
      {error && (
        <p className="error-message" role="alert" style={{ padding: "0 24px" }}>
          {error}
        </p>
      )}
      {!integrations.dvla && (
        <p className="panel-note">
          Number plate lookup needs a free DVLA Vehicle Enquiry Service key
          (DVLA_API_KEY). Until then, add vehicles by hand.
        </p>
      )}
      <GridTable
        empty="No vehicles yet. Look one up by number plate or add it by hand."
        heads={[
          "Vehicle",
          "Fuel",
          "Economy",
          "Fuel price",
          "Cost per mile",
          miles ? `${miles} mile trip` : "Period miles",
          "Period fuel",
          "MOT / tax",
          "",
        ]}
        rows={summary.map(({ vehicle: v, miles: m, fuel, journeys, estimatedFuel }) => {
          const perMile = costPerMile(v);
          return [
            <div key="name">
              <strong>{v.name}</strong>
              <br />
              <small>
                {[v.registration && formatReg(v.registration), v.year, v.dvla?.colour]
                  .filter(Boolean)
                  .join(" · ")}
              </small>{" "}
              {v.isDefault && <Tag tone="green">Default</Tag>}
              {!v.active && <Tag>Not in use</Tag>}
            </div>,
            fuelTypeLabels[v.fuelType],
            v.fuelType === "electric"
              ? v.milesPerKwh
                ? `${v.milesPerKwh} mi/kWh`
                : "Setup needed"
              : v.mpg
                ? `${v.mpg} MPG · ${v.economySource}`
                : "Setup needed",
            v.fuelPrice
              ? `£${v.fuelPrice.toFixed(2)}/${v.fuelType === "electric" ? "kWh" : "litre"}`
              : "Setup needed",
            perMile === null ? "—" : `${perMile.toFixed(1)}p`,
            miles
              ? perMile === null
                ? "—"
                : money(Math.round(perMile * miles))
              : `${Math.round(m)} mi · ${plural(journeys, "trip")}`,
            fuel
              ? `${money(fuel)}${estimatedFuel ? (estimatedFuel === journeys ? " (est.)" : " (part est.)") : ""}`
              : "—",
            v.dvla
              ? `MOT ${v.dvla.motStatus || "?"}${v.dvla.motExpiryDate ? ` to ${v.dvla.motExpiryDate}` : ""} · Tax ${v.dvla.taxStatus || "?"}${v.dvla.taxDueDate ? ` to ${v.dvla.taxDueDate}` : ""}`
              : "—",
            <Button
              key="edit"
              variant="outline"
              onClick={() => open(vehicleEditor(s, v))}
            >
              Edit
            </Button>,
          ];
        })}
      />
      <p className="panel-note">
        Journeys without a fuel receipt are priced from the vehicle’s MPG and
        fuel price. MPG estimated from the DVLA CO2 figure is a starting point:
        swap in your own figure (miles driven ÷ litres filled × 4.546) once you
        have it. For reference, HMRC’s approved mileage rate is 45p a mile for
        the first 10,000 business miles in a year.
      </p>
    </Panel>
  );
}

export function StaffPanel({ filter }: { filter: ReportFilter }) {
  const { s, open } = useOps();
  // Include upcoming assignments after the period end.
  const summary = staffSummary(
    s,
    (date) => inPeriod(date, filter) || (date > today() && date >= filter.from),
  );
  return (
    <Panel
      title="Staff & hourly costs"
      action={<Button onClick={() => open(staffEditor())}>Add staff member</Button>}
    >
      <GridTable
        empty="No staff yet. Add yourself and anyone who works on jobs."
        heads={[
          "Name",
          "Role",
          "Pay / h",
          "Cost / h incl. on-costs",
          "Assigned (period)",
          "Worked (period)",
          "Labour cost (period)",
          "",
        ]}
        rows={summary.map(({ member: m, plannedHours, workedHours, plannedCost, workedCost, jobs }) => [
          <div key="name">
            <strong>{m.name}</strong>
            <br />
            <small>{m.employment}</small>{" "}
            {!m.active && <Tag>Inactive</Tag>}
          </div>,
          m.role,
          money(m.hourlyRate),
          m.onCostPercent
            ? `${money(loadedRate(m))} (+${m.onCostPercent}%)`
            : money(m.hourlyRate),
          plannedHours ? hrs(plannedHours) : "—",
          workedHours || plannedHours
            ? `${hrs(workedHours)} · ${plural(jobs, "job")}`
            : "—",
          plannedCost || workedCost
            ? `${money(workedCost)}${plannedCost ? ` + ${money(plannedCost)} planned` : ""}`
            : "—",
          <Button key="edit" variant="outline" onClick={() => open(staffEditor(m))}>
            Edit
          </Button>,
        ])}
      />
    </Panel>
  );
}

export function ShiftsPanel({
  filter,
  matches,
}: {
  filter: ReportFilter;
  matches: (r: { orderId?: string; service?: string }) => boolean;
}) {
  const { s, open, run } = useOps();
  // Upcoming assignments stay visible even when the period ends today.
  const shifts = s.shifts
    .filter(
      (x) =>
        matches(x) &&
        (inPeriod(x.date, filter) ||
          (x.date > today() && x.date >= filter.from)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.start.localeCompare(b.start));
  const byJob = new Map<string, Shift[]>();
  for (const x of shifts) byJob.set(x.orderId, [...(byJob.get(x.orderId) || []), x]);
  const jobName = (orderId: string) => {
    const o = s.orders.find((o) => o.id === orderId);
    return o ? `${o.reference} · ${o.details.company || o.details.name}` : "No order (general work)";
  };
  const name = (id: string) => s.staff.find((m) => m.id === id)?.name || "Removed";
  const sum = (list: Shift[], status: Shift["status"], key: "hours" | "cost") =>
    list.filter((x) => x.status === status).reduce((n, x) => n + x[key], 0);
  return (
    <Panel
      title="Job assignments & hours worked"
      action={
        <Button
          disabled={!s.staff.some((m) => m.active)}
          onClick={() => open(shiftEditor(s))}
        >
          Assign staff
        </Button>
      }
    >
      <h3 className="panel-subhead">By job</h3>
      <GridTable
        empty="Nobody is assigned to a job in this period."
        heads={["Job", "Team", "Assigned", "Worked", "Labour cost"]}
        rows={[...byJob].map(([orderId, list]) => [
          jobName(orderId),
          [...new Set(list.map((x) => name(x.staffId)))].join(", "),
          sum(list, "planned", "hours") ? hrs(sum(list, "planned", "hours")) : "—",
          sum(list, "worked", "hours") ? hrs(sum(list, "worked", "hours")) : "—",
          money(list.reduce((n, x) => n + x.cost, 0)),
        ])}
      />
      <h3 className="panel-subhead">Who worked when</h3>
      <GridTable
        empty="No assignments yet."
        heads={["Date", "Staff", "Job", "Role", "Time", "Hours", "Cost", "Status", ""]}
        rows={shifts.map((x) => [
          x.date,
          name(x.staffId),
          s.orders.find((o) => o.id === x.orderId)?.reference || "General",
          x.role,
          x.start ? `${x.start}–${x.end}${x.breakMinutes ? ` (${x.breakMinutes}m break)` : ""}` : "—",
          hrs(x.hours),
          `${money(x.cost)} @ ${money(x.rate)}/h`,
          <Tag key="status" tone={x.status === "worked" ? "green" : "amber"}>
            {x.status === "worked" ? "Worked" : "Assigned"}
          </Tag>,
          <div key="actions" className="inline-actions" style={{ padding: 0 }}>
            {x.status === "planned" && (
              <Button
                variant="outline"
                onClick={() =>
                  open(shiftEditor(s, { ...x, status: "worked" }, "Confirm hours worked"))
                }
              >
                Confirm hours
              </Button>
            )}
            <Button variant="ghost" onClick={() => open(shiftEditor(s, x))}>
              Edit
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm(`Remove ${name(x.staffId)} from this job on ${x.date}?`))
                  void run("shift-remove", { id: x.id }).catch((e) => alert((e as Error).message));
              }}
            >
              Remove
            </Button>
          </div>,
        ])}
      />
      <p className="panel-note">
        Assigned hours count as estimated labour on the job until you confirm
        the hours worked. Each assignment creates one labour cost, so don’t
        record the same hours again as an expense.
      </p>
    </Panel>
  );
}
