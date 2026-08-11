export const APP_SURFACE_COOKIE = "fkh-app-surface";

export type AppSurface = "companion" | "workbench";

export function parseAppSurface(value: string | null | undefined): AppSurface | null {
  return value === "companion" || value === "workbench" ? value : null;
}

export function resolveAppSurface({
  storedPreference,
  deviceType,
}: {
  storedPreference?: string | null;
  deviceType?: string | null;
}): AppSurface {
  const explicitSurface = parseAppSurface(storedPreference);
  if (explicitSurface) return explicitSurface;

  return deviceType === "mobile" ? "companion" : "workbench";
}
