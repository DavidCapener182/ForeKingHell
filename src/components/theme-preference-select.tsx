"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  discardThemePreview,
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
  useEffect(() => discardThemePreview, []);

  const selectedTheme = useSyncExternalStore(
    subscribeToThemePreference,
    readActiveThemePreference,
    () => defaultValue,
  );

  return (
    <fieldset className="grid gap-2 text-sm font-medium md:col-span-3">
      <legend>Appearance</legend>
      <div
        data-mobile-appearance-note
        data-mobile-surface="secondary"
        className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3 lg:hidden"
      >
        <span className="grid min-w-0 gap-0.5">
          <span className="font-semibold">Mobile appearance</span>
          <span className="text-[13px] font-normal leading-[1.35] text-muted-foreground">
            Always follows this device&apos;s system Light or Dark mode.
          </span>
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          Automatic
        </span>
      </div>

      <div className="mt-2 grid gap-0.5 lg:hidden">
        <p className="font-semibold">Desktop appearance</p>
        <p className="text-[13px] font-normal leading-[1.35] text-muted-foreground">
          Choose how ForeKingHell looks on larger screens. This preference is saved for desktop and
          does not change the mobile appearance above.
        </p>
      </div>

      <div className="grid divide-y overflow-hidden rounded-xl border bg-card lg:grid-cols-2 lg:gap-2 lg:divide-y-0 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent xl:grid-cols-4">
        {themeOptions.map((value) => (
          <label
            key={value}
            className="group relative grid min-h-14 cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-x-3 bg-transparent px-4 py-3 transition-colors has-[:checked]:bg-primary/5 has-[:focus-visible]:z-10 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-[-3px] has-[:focus-visible]:outline-ring lg:min-h-24 lg:rounded-lg lg:border lg:bg-card lg:p-3 lg:hover:border-primary/45 lg:has-[:checked]:border-primary lg:has-[:focus-visible]:outline-offset-2"
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
      <span className="text-xs font-normal leading-5 text-muted-foreground lg:hidden">
        Save settings to keep this as your desktop preference. Mobile remains automatic.
      </span>
      <span className="hidden text-xs font-normal leading-5 text-muted-foreground lg:inline">
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
      className="mt-1 hidden h-6 grid-cols-[1.5fr_1fr_0.4fr] overflow-hidden rounded-sm border border-black/10 lg:grid"
    >
      <span />
      <span />
      <span />
    </span>
  );
}
