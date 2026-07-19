"use client";

import { useEffect } from "react";

import { resolveTheme, themeColourByMode, themePreviewStorageKey } from "@/lib/theme";
import type { ThemePreference } from "@/lib/user-settings";

export const themePreferenceChangeEvent = "fkh:theme-preference-change";
export { themePreviewStorageKey };

type ThemeRoot = Pick<HTMLElement, "classList" | "dataset" | "style">;
type ThemeMeta = Pick<HTMLMetaElement, "setAttribute"> | null;

export function ThemeController() {
  useEffect(() => {
    const colourScheme = window.matchMedia("(prefers-color-scheme: dark)");

    function apply(preference = readThemePreference()) {
      applyThemePreference(
        document.documentElement,
        document.querySelector<HTMLMetaElement>('meta[name="theme-color"]'),
        preference,
        colourScheme.matches,
      );
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
  try {
    window.sessionStorage.setItem(themePreviewStorageKey, preference);
  } catch {
    // Storage can be unavailable in privacy-restricted browsers; current-page preview still works.
  }

  window.dispatchEvent(new CustomEvent(themePreferenceChangeEvent, { detail: preference }));
}

export function applyThemePreference(
  root: ThemeRoot,
  meta: ThemeMeta,
  preference: ThemePreference,
  prefersDark: boolean,
) {
  const theme = resolveTheme(preference, prefersDark);

  root.dataset.themePreference = preference;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
  meta?.setAttribute("content", themeColourByMode[theme]);
}

function readThemePreference(): ThemePreference {
  try {
    const previewPreference = window.sessionStorage.getItem(themePreviewStorageKey);
    if (isThemePreference(previewPreference)) {
      return previewPreference;
    }
  } catch {
    // Fall through to the server-rendered preference when storage is unavailable.
  }

  const value = document.documentElement.dataset.themePreference;
  return isThemePreference(value) ? value : "system";
}

function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark" || value === "clubhouse";
}
