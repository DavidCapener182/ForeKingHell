export type DistanceUnitPreference = "yards" | "metres";
export type SpeedUnitPreference = "mph" | "kph";
export type Handedness = "right" | "left";

const YARDS_TO_METRES = 0.9144;
const FEET_TO_METRES = 0.3048;
const MPH_TO_KPH = 1.609344;

export function yardsToDisplay(valueYards: number, preference: DistanceUnitPreference) {
  return preference === "metres" ? valueYards * YARDS_TO_METRES : valueYards;
}

export function feetToDisplay(valueFeet: number, preference: DistanceUnitPreference) {
  return preference === "metres" ? valueFeet * FEET_TO_METRES : valueFeet;
}

export function mphToDisplay(valueMph: number, preference: SpeedUnitPreference) {
  return preference === "kph" ? valueMph * MPH_TO_KPH : valueMph;
}

export function distanceUnitLabel(preference: DistanceUnitPreference) {
  return preference === "metres" ? "m" : "yd";
}

export function apexUnitLabel(preference: DistanceUnitPreference) {
  return preference === "metres" ? "m" : "ft";
}

export function formatStoredYards(
  valueYards: number | null | undefined,
  preference: DistanceUnitPreference,
  maximumFractionDigits = 1,
) {
  if (valueYards === null || valueYards === undefined || !Number.isFinite(valueYards)) return "—";
  return `${yardsToDisplay(valueYards, preference).toLocaleString("en-GB", { maximumFractionDigits })} ${distanceUnitLabel(preference)}`;
}

export function formatStoredApexFeet(
  valueFeet: number | null | undefined,
  preference: DistanceUnitPreference,
) {
  if (valueFeet === null || valueFeet === undefined || !Number.isFinite(valueFeet)) return "—";
  return `${feetToDisplay(valueFeet, preference).toLocaleString("en-GB", { maximumFractionDigits: 1 })} ${apexUnitLabel(preference)}`;
}

export function formatStoredSpeedMph(
  valueMph: number | null | undefined,
  preference: DistanceUnitPreference,
) {
  if (valueMph === null || valueMph === undefined || !Number.isFinite(valueMph)) return "—";
  const metric = preference === "metres";
  const value = mphToDisplay(valueMph, metric ? "kph" : "mph");
  return `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })} ${metric ? "kph" : "mph"}`;
}

export function formatStoredLateralYards(
  valueYards: number | null | undefined,
  preference: DistanceUnitPreference,
) {
  if (valueYards === null || valueYards === undefined || !Number.isFinite(valueYards)) return "—";
  if (valueYards === 0) return `0 ${distanceUnitLabel(preference)}`;
  const suffix = valueYards < 0 ? "L" : "R";
  const value = yardsToDisplay(Math.abs(valueYards), preference);
  return `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })} ${distanceUnitLabel(preference)} ${suffix}`;
}

export function lateralDirection(
  valueYards: number,
  reference: "target-line" | "golfer-relative" = "target-line",
  handedness: Handedness = "right",
) {
  if (valueYards === 0) return reference === "target-line" ? "centre" : "straight";
  const physical = valueYards < 0 ? "left" : "right";
  if (reference === "target-line") return physical;
  const pull =
    (handedness === "right" && physical === "left") ||
    (handedness === "left" && physical === "right");
  return pull ? "pull" : "push";
}

export function safePercentage(numerator: number, denominator: number) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? (numerator / denominator) * 100
    : null;
}

export function parseDateOnlyLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}
