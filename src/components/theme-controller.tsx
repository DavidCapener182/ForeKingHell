"use client";

import { useEffect } from "react";

import { resolveTheme, themeColourByMode } from "@/lib/theme";
import type { ThemePreference } from "@/lib/user-settings";

export const themePreferenceChangeEvent = "fkh:theme-preference-change";

export function ThemeController() {
  useEffect(() => {
    const colourScheme = window.matchMedia("(prefers-color-scheme: dark)");

    function apply(preference = readThemePreference()) {
      const theme = resolveTheme(preference, colourScheme.matches);
      const root = document.documentElement;

      root.dataset.themePreference = preference;
      root.dataset.theme = theme;
      root.classList.toggle("dark", theme === "dark");
      root.style.colorScheme = theme;
      document
        .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.setAttribute("content", themeColourByMode[theme]);
    }

    function handlePreferenceChange(event: Event) {
      const preference = (event as CustomEvent<ThemePreference>).detail;
      apply(preference);
    }

    function handleSystemChange() {
      if (readThemePreference() === "system") {
        apply("system");
      }
    }

    apply();
    window.addEventListener(themePreferenceChangeEvent, handlePreferenceChange);
    colourScheme.addEventListener("change", handleSystemChange);

    return () => {
      window.removeEventListener(themePreferenceChangeEvent, handlePreferenceChange);
      colourScheme.removeEventListener("change", handleSystemChange);
    };
  }, []);

  return null;
}

export function previewThemePreference(preference: ThemePreference) {
  window.dispatchEvent(new CustomEvent(themePreferenceChangeEvent, { detail: preference }));
}

function readThemePreference(): ThemePreference {
  const value = document.documentElement.dataset.themePreference;
  return value === "light" || value === "dark" ? value : "system";
}
