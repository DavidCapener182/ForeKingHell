export const preferredUnitOptions = ["yards", "metres"] as const;
export const themeOptions = [
  "system",
  "light",
  "dark",
  "clubhouse",
  "outdoor",
  "range-night",
  "tour-broadcast",
  "high-contrast",
] as const;
export const tableDensityOptions = ["comfortable", "compact"] as const;
export const dashboardPinOptions = [
  "shots",
  "clubs",
  "sessions",
  "handicap",
  "bag",
  "rounds",
  "coach",
  "achievements",
] as const;

export type PreferredUnits = (typeof preferredUnitOptions)[number];
export type ThemePreference = (typeof themeOptions)[number];
export type TableDensity = (typeof tableDensityOptions)[number];
export type DashboardPin = (typeof dashboardPinOptions)[number];

export const defaultThemePreference = "clubhouse" satisfies ThemePreference;

export type PrivacySettings = {
  allowCoachAccess: boolean;
  allowLeaderboard: boolean;
  publicProfile: boolean;
};

export function parsePreferredUnits(value: FormDataEntryValue | null): PreferredUnits {
  return value === "metres" ? "metres" : "yards";
}

export function parseTheme(value: FormDataEntryValue | null): ThemePreference {
  return typeof value === "string" && themeOptions.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : defaultThemePreference;
}

export function parseTableDensity(value: FormDataEntryValue | null): TableDensity {
  return value === "compact" ? "compact" : "comfortable";
}

export function parseDashboardPins(values: FormDataEntryValue[]): DashboardPin[] {
  const allowedPins = new Set<string>(dashboardPinOptions);
  return values.filter(
    (value): value is DashboardPin => typeof value === "string" && allowedPins.has(value),
  );
}

export function parsePrivacySettings(formData: FormData): PrivacySettings {
  return {
    allowCoachAccess: formData.get("allowCoachAccess") === "on",
    allowLeaderboard: formData.get("allowLeaderboard") === "on",
    publicProfile: formData.get("publicProfile") === "on",
  };
}
