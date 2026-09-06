import type { AppSurface } from "./app-surface";

/** Keep the selected entity, repeated filters and fragment through document navigation. */
export function appSurfaceHref(surface: AppSurface, location: string): `/surface/${string}` {
  const destination =
    location.startsWith("/") && !location.startsWith("//") && !location.includes("\\")
      ? location
      : "/today";
  return `/surface/${surface}?next=${encodeURIComponent(destination)}`;
}
