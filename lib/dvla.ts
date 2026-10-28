import { config } from "./server";
import {
  estimateMpg,
  fuelTypeFromDvla,
  normaliseRegistration,
  validRegistration,
  type FuelType,
} from "./team-fleet";

// DVLA Vehicle Enquiry Service: free, needs an API key from
// https://developer-portal.driver-vehicle-licensing.api.gov.uk/
// It returns make, fuel, engine size, CO2, first registration, tax and MOT,
// but not the model or MPG, so MPG is estimated from the CO2 figure.
const DVLA_URL =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

type DvlaVehicle = {
  registrationNumber: string;
  make?: string;
  colour?: string;
  fuelType?: string;
  engineCapacity?: number;
  co2Emissions?: number;
  yearOfManufacture?: number;
  monthOfFirstRegistration?: string;
  motStatus?: string;
  motExpiryDate?: string;
  taxStatus?: string;
  taxDueDate?: string;
};

export type VehicleLookup = {
  registration: string;
  make: string;
  fuelType: FuelType;
  year: number | null;
  engineCc: number | null;
  co2: number | null;
  firstRegistered: string;
  estimatedMpg: number | null;
  dvla: {
    checkedAt: string;
    colour?: string;
    motStatus?: string;
    motExpiryDate?: string;
    taxStatus?: string;
    taxDueDate?: string;
  };
};

const title = (s = "") =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function mapDvlaVehicle(d: DvlaVehicle, at = new Date().toISOString()): VehicleLookup {
  const co2 = d.co2Emissions ?? null;
  const fuelType = fuelTypeFromDvla(d.fuelType, co2);
  const firstRegistered = (d.monthOfFirstRegistration || "").slice(0, 7);
  return {
    registration: normaliseRegistration(d.registrationNumber),
    make: title(d.make),
    fuelType,
    year: d.yearOfManufacture ?? null,
    engineCc: d.engineCapacity ?? null,
    co2,
    firstRegistered,
    estimatedMpg: estimateMpg(co2, fuelType, firstRegistered),
    dvla: {
      checkedAt: at,
      colour: d.colour ? title(d.colour) : undefined,
      motStatus: d.motStatus,
      motExpiryDate: d.motExpiryDate,
      taxStatus: d.taxStatus,
      taxDueDate: d.taxDueDate,
    },
  };
}

export async function lookupVehicle(registration: string): Promise<VehicleLookup> {
  const reg = normaliseRegistration(registration);
  if (!validRegistration(reg))
    throw Error("Enter a valid UK registration, e.g. AB12 CDE");
  const key = config().DVLA_API_KEY;
  if (!key)
    throw Error(
      "Number plate lookup is not set up yet. Enter the vehicle details by hand for now.",
    );
  const r = await fetch(config().DVLA_API_BASE || DVLA_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ registrationNumber: reg }),
    signal: AbortSignal.timeout(10000),
  });
  if (r.status === 404) throw Error(`DVLA has no vehicle with registration ${reg}`);
  if (r.status === 400) throw Error("DVLA did not accept that registration");
  if (r.status === 403 || r.status === 401)
    throw Error("DVLA rejected the lookup key. Check DVLA_API_KEY.");
  if (r.status === 429) throw Error("DVLA is rate limiting lookups. Try again shortly.");
  if (!r.ok) throw Error(`DVLA lookup failed (${r.status}). Try again or enter by hand.`);
  return mapDvlaVehicle((await r.json()) as DvlaVehicle);
}
