import type { ThemePreference } from "@/lib/user-settings";

export type ResolvedTheme = "light" | "dark";

export const themeColourByMode: Record<ResolvedTheme, string> = {
  light: "#edf3ec",
  dark: "#07110b",
};

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === "light" || preference === "dark") {
    return preference;
  }

  return prefersDark ? "dark" : "light";
}
