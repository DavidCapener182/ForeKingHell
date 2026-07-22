"use client";

import { useSyncExternalStore } from "react";

import {
  previewThemePreference,
  themePreferenceChangeEvent,
  themePreviewStorageKey,
} from "@/components/theme-controller";
import { parseTheme, themeOptions, type ThemePreference } from "@/lib/user-settings";

const themeLabels: Record<ThemePreference, string> = {
  system: "Use device setting",
  light: "Light",
  dark: "Dark",
  clubhouse: "Clubhouse Manager",
  outdoor: "Outdoor Mode",
  "range-night": "Range Night",
  "tour-broadcast": "Tour Broadcast",
  "high-contrast": "High Contrast",
};

const themeDescriptions: Record<ThemePreference, string> = {
  system: "Follows your device automatically",
  light: "ForeKingHell light",
  dark: "ForeKingHell dark",
  clubhouse: "Parchment, racing green and scorecard detail",
  outdoor: "Maximum sunlight legibility for the range",
  "range-night": "Reduced-glare launch-monitor display",
  "tour-broadcast": "Graphite, ivory and scoreboard presentation",
  "high-contrast": "Solid surfaces, stronger focus and underlined links",
};

export function ThemePreferenceSelect({ defaultValue }: { defaultValue: ThemePreference }) {
  const selectedTheme = useSyncExternalStore(
    subscribeToThemePreference,
    readActiveThemePreference,
    () => defaultValue,
  );

  return (
    <fieldset className="grid gap-2 text-sm font-medium md:col-span-3">
      <legend>Appearance</legend>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {themeOptions.map((value) => (
          <label
            key={value}
            className="group relative grid min-h-24 cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/45 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={selectedTheme === value}
              className="mt-0.5 size-4 accent-primary"
              onChange={(event) => {
                if (event.currentTarget.checked) {
                  const preference = event.currentTarget.value as ThemePreference;
                  previewThemePreference(preference);
                }
              }}
            />
            <span className="grid min-w-0 content-start gap-1">
              <span className="font-semibold">{themeLabels[value]}</span>
              <span className="text-xs font-normal leading-4 text-muted-foreground">
                {themeDescriptions[value]}
              </span>
              <ThemeSwatch theme={value} />
            </span>
          </label>
        ))}
      </div>
      <span className="text-xs font-normal leading-5 text-muted-foreground">
        Preview changes immediately. Save settings to keep the selection on your account.
      </span>
    </fieldset>
  );
}

function subscribeToThemePreference(onStoreChange: () => void) {
  window.addEventListener(themePreferenceChangeEvent, onStoreChange);
  return () => window.removeEventListener(themePreferenceChangeEvent, onStoreChange);
}

function readActiveThemePreference() {
  try {
    const previewPreference = window.sessionStorage.getItem(themePreviewStorageKey);
    if (previewPreference !== null) {
      return parseTheme(previewPreference);
    }
  } catch {
    // Fall back to the already bootstrapped root preference when storage is unavailable.
  }

  return parseTheme(document.documentElement.dataset.themePreference ?? null);
}

function ThemeSwatch({ theme }: { theme: ThemePreference }) {
  return (
    <span
      aria-hidden="true"
      data-theme-swatch={theme}
      className="mt-1 grid h-6 grid-cols-[1.5fr_1fr_0.4fr] overflow-hidden rounded-sm border border-black/10"
    >
      <span />
      <span />
      <span />
    </span>
  );
}
