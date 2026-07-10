"use client";

import { previewThemePreference } from "@/components/theme-controller";
import { themeOptions, type ThemePreference } from "@/lib/user-settings";

export function ThemePreferenceSelect({ defaultValue }: { defaultValue: ThemePreference }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>Appearance</span>
      <select
        name="theme"
        defaultValue={defaultValue}
        className="h-10 rounded-xl border bg-background px-3 text-sm"
        onChange={(event) => previewThemePreference(event.currentTarget.value as ThemePreference)}
      >
        {themeOptions.map((value) => (
          <option key={value} value={value}>
            {value === "system" ? "Use device setting" : titleCase(value)}
          </option>
        ))}
      </select>
      <span className="text-xs font-normal leading-5 text-muted-foreground">
        Device setting follows your iPhone, iPad or computer automatically.
      </span>
    </label>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
