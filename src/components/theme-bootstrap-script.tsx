import type { CurrentUserPreferences } from "@/lib/current-user";
import { themeColourByMode, themePreviewStorageKey } from "@/lib/theme";
import { themeOptions } from "@/lib/user-settings";

export function ThemeBootstrapScript({
  preference,
  preferredUnits,
  tableDensity,
  offlineAccountId,
  scriptId = "fkh-theme-bootstrap",
}: {
  preference: CurrentUserPreferences["theme"];
  preferredUnits?: CurrentUserPreferences["preferredUnits"];
  tableDensity?: CurrentUserPreferences["tableDensity"];
  offlineAccountId?: string;
  scriptId?: string;
}) {
  const script = `(() => {
    const root = document.documentElement;
    const savedPreference = ${JSON.stringify(preference)};
    const themePreviewStorageKey = ${JSON.stringify(themePreviewStorageKey)};
    const themeOptions = ${JSON.stringify(themeOptions)};
    let preference = savedPreference;
    try {
      const previewPreference = sessionStorage.getItem(themePreviewStorageKey);
      if (window.location.pathname === "/settings" && themeOptions.includes(previewPreference)) {
        preference = previewPreference;
      } else if (previewPreference !== null) {
        sessionStorage.removeItem(themePreviewStorageKey);
      }
    } catch {}
    const theme = preference === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    root.dataset.savedThemePreference = savedPreference;
    root.dataset.themePreference = preference;
    root.dataset.theme = theme;
    const usesDarkColourScheme = theme === "dark" || theme === "range-night" || theme === "high-contrast";
    root.classList.toggle("dark", usesDarkColourScheme);
    root.style.colorScheme = usesDarkColourScheme ? "dark" : "light";
    const meta = document.querySelector('meta[name="theme-color"]');
    const colours = ${JSON.stringify(themeColourByMode)};
    if (meta) meta.setAttribute("content", colours[theme]);
    const preferredUnits = ${JSON.stringify(preferredUnits ?? null)};
    const tableDensity = ${JSON.stringify(tableDensity ?? null)};
    const offlineAccountId = ${JSON.stringify(offlineAccountId ?? null)};
    if (preferredUnits) root.dataset.preferredUnits = preferredUnits;
    if (tableDensity) root.dataset.tableDensity = tableDensity;
    if (offlineAccountId) root.dataset.offlineAccountId = offlineAccountId;
    else delete root.dataset.offlineAccountId;
  })();`;

  return <script id={scriptId} dangerouslySetInnerHTML={{ __html: script }} />;
}
