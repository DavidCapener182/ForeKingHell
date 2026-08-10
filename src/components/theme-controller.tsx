"use client";

import { useEffect } from "react";

import { resolveTheme, themeColourByMode, themePreviewStorageKey } from "@/lib/theme";
import { defaultThemePreference, type ThemePreference } from "@/lib/user-settings";

export const themePreferenceChangeEvent = "fkh:theme-preference-change";
export { themePreviewStorageKey };

export const mobileThemeMediaQuery = "(max-width: 1023px)";

const mobileThemeColour = {
  light: "#f2f2f7",
  dark: "#000000",
} as const;

type ThemeRoot = Pick<HTMLElement, "classList" | "dataset" | "style">;
type ThemeMeta = Pick<HTMLMetaElement, "setAttribute"> | null;

export function ThemeController() {
  useEffect(() => {
    const colourScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const mobileViewport = window.matchMedia(mobileThemeMediaQuery);

    function apply(preference = readThemePreference()) {
      applyThemePreference(
        document.documentElement,
        findActiveThemeMeta(),
        preference,
        colourScheme.matches,
        mobileViewport.matches,
      );
    }

    function handlePreferenceChange(event: Event) {
      const preference = (event as CustomEvent<ThemePreference>).detail;
      apply(preference);
    }

    function handleSystemChange() {
      const preference = readThemePreference();
      if (mobileViewport.matches || preference === "system") {
        apply(preference);
      }
    }

    function handleViewportChange() {
      apply();
    }

    apply();
    window.addEventListener(themePreferenceChangeEvent, handlePreferenceChange);
    colourScheme.addEventListener("change", handleSystemChange);
    mobileViewport.addEventListener("change", handleViewportChange);

    return () => {
      window.removeEventListener(themePreferenceChangeEvent, handlePreferenceChange);
      colourScheme.removeEventListener("change", handleSystemChange);
      mobileViewport.removeEventListener("change", handleViewportChange);
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

export function discardThemePreview() {
  try {
    window.sessionStorage.removeItem(themePreviewStorageKey);
  } catch {
    // Storage can be unavailable; restoring the saved root preference still fixes this document.
  }

  const savedPreference = document.documentElement.dataset.savedThemePreference;
  const preference = isThemePreference(savedPreference) ? savedPreference : defaultThemePreference;
  window.dispatchEvent(new CustomEvent(themePreferenceChangeEvent, { detail: preference }));
}

export function applyThemePreference(
  root: ThemeRoot,
  meta: ThemeMeta,
  preference: ThemePreference,
  prefersDark: boolean,
  isMobileViewport = false,
) {
  const theme = isMobileViewport
    ? prefersDark
      ? "dark"
      : "light"
    : resolveTheme(preference, prefersDark);

  root.dataset.themePreference = preference;
  root.dataset.theme = theme;
  const usesDarkColourScheme =
    theme === "dark" || theme === "range-night" || theme === "high-contrast";
  root.classList.toggle("dark", usesDarkColourScheme);
  root.style.colorScheme = usesDarkColourScheme ? "dark" : "light";
  meta?.setAttribute(
    "content",
    isMobileViewport ? mobileThemeColour[theme as "light" | "dark"] : themeColourByMode[theme],
  );
}

function findActiveThemeMeta() {
  const themeMetas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  return (
    Array.from(themeMetas).find((meta) => {
      const media = meta.getAttribute("media");
      return !media || window.matchMedia(media).matches;
    }) ??
    themeMetas.item(0) ??
    null
  );
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
  return isThemePreference(value) ? value : defaultThemePreference;
}

function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return (
    value === "system" ||
    value === "light" ||
    value === "dark" ||
    value === "clubhouse" ||
    value === "outdoor" ||
    value === "range-night" ||
    value === "tour-broadcast" ||
    value === "high-contrast"
  );
}
