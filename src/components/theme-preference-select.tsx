"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  discardThemePreview,
  previewThemePreference,
  themePreferenceChangeEvent,
  themePreviewStorageKey,
} from "@/components/theme-controller";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

      <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="desktop-theme-preference">Desktop theme</Label>
          <Select
            name="theme"
            value={selectedTheme}
            onValueChange={(value) => previewThemePreference(value as ThemePreference)}
          >
            <SelectTrigger id="desktop-theme-preference" className="w-full">
              <SelectValue placeholder="Choose a desktop theme" />
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  {themeLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border bg-muted/40 px-3 py-2">
          <p className="font-semibold">{themeLabels[selectedTheme]}</p>
          <p className="mt-0.5 text-xs font-normal leading-4 text-muted-foreground">
            {themeDescriptions[selectedTheme]}
          </p>
          <ThemeSwatch theme={selectedTheme} />
        </div>
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
      className="mt-2 grid h-6 grid-cols-[1.5fr_1fr_0.4fr] overflow-hidden rounded-sm border border-border"
    >
      <span />
      <span />
      <span />
    </span>
  );
}
