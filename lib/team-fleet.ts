import { z } from "zod";
import { type State, uid } from "./domain";
import { dateValue } from "./operations";
import { type Service } from "./reporting";

// Vehicles, staff and the shifts that put staff on jobs. Shifts and journeys
// each keep one linked finance record, so job profit and the business report
// pick up labour and travel without anything being entered twice.

export const fuelTypes = [
  "petrol",
  "diesel",
  "hybrid-petrol",
  "hybrid-diesel",
  "plug-in-hybrid",
  "electric",
  "other",
] as const;
export type FuelType = (typeof fuelTypes)[number];
export const fuelTypeLabels: Record<FuelType, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  "hybrid-petrol": "Hybrid (petrol)",
  "hybrid-diesel": "Hybrid (diesel)",
  "plug-in-hybrid": "Plug-in hybrid",
  electric: "Electric",
  other: "Other",
};

export type Vehicle = {
  id: string;
  registration: string;
  name: string;
  make: string;
  model: string;
  fuelType: FuelType;
  year: number | null;
  engineCc: number | null;
  co2: number | null;
  // YYYY-MM, from the DVLA record.
  firstRegistered: string;
  // UK miles per gallon (4.54609 litres). 0 when unknown or electric.
  mpg: number;
  // Electric vehicles only.
  milesPerKwh: number;
  economySource: "measured" | "estimated" | "manual";
  // £ per litre, or £ per kWh for electric.
  fuelPrice: number;
  isDefault: boolean;
  active: boolean;
  notes: string;
  dvla?: {
    checkedAt: string;
    colour?: string;
    motStatus?: string;
    motExpiryDate?: string;
    taxStatus?: string;
    taxDueDate?: string;
  };
};

export const staffRoles = [
  "Head chef",
  "Chef",
  "Sous chef",
  "Kitchen assistant",
  "Kitchen porter",
  "Front of house",
  "Driver",
  "Event manager",
  "Admin",
  "Other",
] as const;

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  employment: "employee" | "contractor" | "owner";
  // Pence per hour before on-costs.
  hourlyRate: number;
  // Employer NI, pension and holiday pay on top of the hourly rate.
  onCostPercent: number;
  email: string;
  phone: string;
  active: boolean;
  notes: string;
};

export type Shift = {
  id: string;
  staffId: string;
  orderId: string;
  service: Service;
  date: string;
  role: string;
  // HH:MM, optional. When both are set, hours are worked out from them.
  start: string;
  end: string;
  breakMinutes: number;
  hours: number;
  // planned = assigned to the job; worked = hours confirmed.
  status: "planned" | "worked";
  // Loaded pence per hour used for this shift.
  rate: number;
  cost: number;
  notes: string;
};

const LITRES_PER_UK_GALLON = 4.54609;

export const normaliseRegistration = (reg: string) =>
  reg.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const validRegistration = (reg: string) =>
  /^[A-Z0-9]{2,8}$/.test(normaliseRegistration(reg));

export function fuelTypeFromDvla(fuel: string | undefined, co2?: number | null): FuelType {
  const f = String(fuel || "").toUpperCase();
  if (f === "ELECTRICITY" || f === "ELECTRIC") return "electric";
  if (f.includes("ELECTRIC")) {
    // DVLA does not separate plug-in hybrids; very low CO2 is the giveaway.
    if (co2 != null && co2 > 0 && co2 < 75) return "plug-in-hybrid";
    return f.includes("DIESEL") ? "hybrid-diesel" : "hybrid-petrol";
  }
  if (f.includes("PETROL")) return "petrol";
  if (f.includes("DIESEL")) return "diesel";
  return "other";
}

// Rough real-world UK MPG from the official CO2 figure. Burning a litre of
// petrol gives about 2.31 kg of CO2 and diesel about 2.68 kg, so CO2 in g/km
// divided by 23.1 (or 26.8) is litres per 100 km on the official test. Older
// NEDC figures (cars first registered before April 2020) read about 25%
// better than real driving; WLTP figures about 12% better.
export function estimateMpg(
  co2: number | null | undefined,
  fuelType: FuelType,
  firstRegistered = "",
): number | null {
  if (!co2 || co2 <= 0) return null;
  const factor =
    fuelType === "petrol" || fuelType === "hybrid-petrol"
      ? 23.1
      : fuelType === "diesel" || fuelType === "hybrid-diesel"
        ? 26.8
        : null;
  if (!factor) return null;
  const nedc = !firstRegistered || firstRegistered < "2020-04";
  const litresPer100km = (co2 / factor) * (nedc ? 1.25 : 1.12);
  const mpg = 282.481 / litresPer100km;
  return Math.round(mpg * 10) / 10;
}

// Pence per mile for fuel or charging, or null when the vehicle is not set up.
export function costPerMile(v: Pick<Vehicle, "fuelType" | "mpg" | "milesPerKwh" | "fuelPrice">) {
  if (v.fuelPrice <= 0) return null;
  if (v.fuelType === "electric")
    return v.milesPerKwh > 0 ? (v.fuelPrice * 100) / v.milesPerKwh : null;
  return v.mpg > 0 ? (LITRES_PER_UK_GALLON * v.fuelPrice * 100) / v.mpg : null;
}

export function vehicleFuelCost(
  v: Pick<Vehicle, "fuelType" | "mpg" | "milesPerKwh" | "fuelPrice">,
  miles: number,
) {
  const perMile = costPerMile(v);
  return perMile === null ? null : Math.round(miles * perMile);
}

export function defaultVehicle(s: Pick<State, "vehicles">) {
  const active = (s.vehicles || []).filter((v) => v.active);
  return active.find((v) => v.isDefault) || active[0];
}

// Fuel estimate for a trip: the chosen (or default) vehicle, falling back to
// the single-vehicle figures in settings for older workspaces.
export function tripFuelCost(s: State, miles: number, vehicleId = "") {
  const v =
    (vehicleId && s.vehicles?.find((x) => x.id === vehicleId)) ||
    defaultVehicle(s);
  if (v) return vehicleFuelCost(v, miles);
  const { mpg, fuelPrice } = s.settings;
  if (mpg <= 0 || fuelPrice <= 0) return null;
  return Math.round((miles / mpg) * LITRES_PER_UK_GALLON * fuelPrice * 100);
}

export const loadedRate = (m: Pick<StaffMember, "hourlyRate" | "onCostPercent">) =>
  Math.round(m.hourlyRate * (1 + (m.onCostPercent || 0) / 100));

const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
// Hours between two clock times less breaks; an end before the start runs
// past midnight.
export function hoursBetween(start: string, end: string, breakMinutes = 0) {
  let span = minutesOf(end) - minutesOf(start);
  if (span <= 0) span += 24 * 60;
  return Math.max(0, Math.round(((span - breakMinutes) / 60) * 100) / 100);
}

export type StaffSummary = {
  member: StaffMember;
  plannedHours: number;
  workedHours: number;
  plannedCost: number;
  workedCost: number;
  jobs: number;
};
export function staffSummary(
  s: State,
  inRange: (date: string) => boolean,
): StaffSummary[] {
  return s.staff.map((member) => {
    const shifts = s.shifts.filter(
      (x) => x.staffId === member.id && inRange(x.date),
    );
    const worked = shifts.filter((x) => x.status === "worked");
    const planned = shifts.filter((x) => x.status === "planned");
    return {
      member,
      plannedHours: planned.reduce((n, x) => n + x.hours, 0),
      workedHours: worked.reduce((n, x) => n + x.hours, 0),
      plannedCost: planned.reduce((n, x) => n + x.cost, 0),
      workedCost: worked.reduce((n, x) => n + x.cost, 0),
      jobs: new Set(shifts.map((x) => x.orderId).filter(Boolean)).size,
    };
  });
}

export type VehicleSummary = {
  vehicle: Vehicle;
  journeys: number;
  miles: number;
  fuel: number;
  estimatedFuel: number;
};
export function vehicleSummary(
  s: State,
  inRange: (date: string) => boolean,
): VehicleSummary[] {
  return s.vehicles.map((vehicle) => {
    const journeys = s.journeys.filter(
      (j) => j.vehicleId === vehicle.id && inRange(j.date),
    );
    return {
      vehicle,
      journeys: journeys.length,
      miles: journeys.reduce((n, j) => n + j.miles, 0),
      fuel: journeys.reduce((n, j) => n + (j.fuelCost || 0), 0),
      estimatedFuel: journeys.filter((j) => j.fuelEstimated).length,
    };
  });
}

const text = z.string().max(1000);
const maybeTime = z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]);
const pence = z.number().int().nonnegative().max(1e9);

function serviceFor(s: State, orderId: string, service: Service): Service {
  if (!orderId) return service;
  const o = s.orders.find((o) => o.id === orderId);
  if (!o) throw Error("Order not found");
  return o.details.service as Service;
}

export function teamFleetCommand(
  s: State,
  type: string,
  payload: unknown,
): string | undefined {
  const p = z.record(z.unknown()).parse(payload);
  switch (type) {
    case "vehicle": {
      const v = z
        .object({
          id: text.optional(),
          registration: text,
          name: text.default(""),
          make: text.default(""),
          model: text.default(""),
          fuelType: z.enum(fuelTypes),
          year: z.number().int().min(1900).max(2100).nullable().default(null),
          engineCc: z.number().int().nonnegative().max(20000).nullable().default(null),
          co2: z.number().int().nonnegative().max(1000).nullable().default(null),
          firstRegistered: z.union([z.string().regex(/^\d{4}-\d{2}$/), z.literal("")]).default(""),
          mpg: z.number().finite().nonnegative().max(500),
          milesPerKwh: z.number().finite().nonnegative().max(20).default(0),
          economySource: z.enum(["measured", "estimated", "manual"]).default("manual"),
          fuelPrice: z.number().finite().nonnegative().max(20),
          isDefault: z.boolean().default(false),
          active: z.boolean().default(true),
          notes: text.default(""),
          dvla: z
            .object({
              checkedAt: text,
              colour: text.optional(),
              motStatus: text.optional(),
              motExpiryDate: text.optional(),
              taxStatus: text.optional(),
              taxDueDate: text.optional(),
            })
            .optional(),
        })
        .parse(p);
      const registration = normaliseRegistration(v.registration);
      if (registration && !validRegistration(registration))
        throw Error("Enter a valid UK registration, e.g. AB12 CDE");
      const old = v.id ? s.vehicles.find((x) => x.id === v.id) : undefined;
      if (v.id && !old) throw Error("Vehicle not found");
      if (
        registration &&
        s.vehicles.some((x) => x.id !== v.id && x.registration === registration)
      )
        throw Error("That vehicle is already listed");
      const id = v.id || uid();
      const vehicle: Vehicle = {
        ...v,
        id,
        registration,
        name: v.name || [v.make, v.model].filter(Boolean).join(" ") || registration,
        dvla: v.dvla ?? old?.dvla,
        isDefault: v.isDefault || !s.vehicles.some((x) => x.id !== id && x.active),
      };
      if (!vehicle.active) vehicle.isDefault = false;
      if (vehicle.isDefault) for (const x of s.vehicles) x.isDefault = false;
      s.vehicles = s.vehicles.filter((x) => x.id !== id).concat(vehicle);
      if (!s.vehicles.some((x) => x.isDefault)) {
        const first = s.vehicles.find((x) => x.active);
        if (first) first.isDefault = true;
      }
      return id;
    }
    case "staff": {
      const v = z
        .object({
          id: text.optional(),
          name: text.min(1),
          role: text.min(1),
          employment: z.enum(["employee", "contractor", "owner"]),
          hourlyRate: pence,
          onCostPercent: z.number().finite().nonnegative().max(100).default(0),
          email: text.default(""),
          phone: text.default(""),
          active: z.boolean().default(true),
          notes: text.default(""),
        })
        .parse(p);
      if (v.id && !s.staff.some((x) => x.id === v.id))
        throw Error("Staff member not found");
      const id = v.id || uid();
      s.staff = s.staff.filter((x) => x.id !== id).concat({ ...v, id });
      return id;
    }
    case "shift": {
      const v = z
        .object({
          id: text.optional(),
          staffId: text.min(1, "Choose a staff member"),
          orderId: text.default(""),
          service: z.enum(["private", "corporate", "shared"]).default("shared"),
          date: dateValue,
          role: text.default(""),
          start: maybeTime.default(""),
          end: maybeTime.default(""),
          breakMinutes: z.number().int().nonnegative().max(1440).default(0),
          hours: z.number().finite().nonnegative().max(24).default(0),
          status: z.enum(["planned", "worked"]),
          // Pence per hour; 0 uses the staff member's loaded rate.
          rateOverride: pence.default(0),
          paymentDate: z.union([dateValue, z.literal("")]).default(""),
          notes: text.default(""),
        })
        .parse(p);
      const member = s.staff.find((x) => x.id === v.staffId);
      if (!member) throw Error("Staff member not found");
      if (v.id && !s.shifts.some((x) => x.id === v.id))
        throw Error("Shift not found");
      if (!!v.start !== !!v.end)
        throw Error("Enter both a start and finish time, or neither");
      const hours = v.start ? hoursBetween(v.start, v.end, v.breakMinutes) : v.hours;
      if (hours <= 0) throw Error("Enter the hours, or a start and finish time");
      const id = v.id || uid(),
        service = serviceFor(s, v.orderId, v.service),
        rate = v.rateOverride || loadedRate(member),
        cost = Math.round(hours * rate),
        role = v.role || member.role;
      const shift: Shift = {
        id,
        staffId: v.staffId,
        orderId: v.orderId,
        service,
        date: v.date,
        role,
        start: v.start,
        end: v.end,
        breakMinutes: v.breakMinutes,
        hours,
        status: v.status,
        rate,
        cost,
        notes: v.notes,
      };
      s.shifts = s.shifts.filter((x) => x.id !== id).concat(shift);
      const old = s.finance.find((x) => x.shiftId === id);
      s.finance = s.finance
        .filter((x) => x.shiftId !== id)
        .concat({
          id: old?.id || uid(),
          shiftId: id,
          orderId: v.orderId,
          service,
          type: "expense",
          costType: "labour",
          category: "labour",
          description: `${member.name} · ${role} · ${hours}h`,
          amount: cost,
          net: cost,
          vat: 0,
          recoverableVAT: 0,
          hours,
          incurredDate: v.date,
          paymentDate: v.paymentDate,
          date: v.paymentDate || v.date,
          status: v.status === "worked" ? "actual" : "estimated",
        });
      return id;
    }
    case "shift-remove": {
      const { id } = z.object({ id: text }).parse(p);
      if (!s.shifts.some((x) => x.id === id)) throw Error("Shift not found");
      s.shifts = s.shifts.filter((x) => x.id !== id);
      s.finance = s.finance.filter((x) => x.shiftId !== id);
      return id;
    }
    default:
      return undefined;
  }
}
