import type { ThemePreference } from "@/lib/user-settings";

export type ResolvedTheme = "light" | "dark" | "clubhouse";

export const themeColourByMode: Record<ResolvedTheme, string> = {
  light: "#edf3ec",
  dark: "#07110b",
  clubhouse: "#123a29",
};

export const themePreviewStorageKey = "fkh:theme-preview";

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === "light" || preference === "dark" || preference === "clubhouse") {
    return preference;
  }

  return prefersDark ? "dark" : "light";
}
