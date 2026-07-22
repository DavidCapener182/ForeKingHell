import type { ThemePreference } from "@/lib/user-settings";

export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const themeColourByMode: Record<ResolvedTheme, string> = {
  light: "#edf3ec",
  dark: "#07110b",
  clubhouse: "#123a29",
  outdoor: "#fffdf4",
  "range-night": "#050c08",
  "tour-broadcast": "#101612",
  "high-contrast": "#000000",
};

export const themePreviewStorageKey = "fkh:theme-preview";

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference !== "system") {
    return preference;
  }

  return prefersDark ? "dark" : "light";
}
