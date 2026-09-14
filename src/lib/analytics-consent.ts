export const ANALYTICS_CONSENT_KEY = "lmwt.analytics-consent.v1";
export const CONSENT_CHANGE_EVENT = "lmwt:consent-change";
export const CONSENT_SETTINGS_EVENT = "lmwt:consent-settings";
const CONSENT_LIFETIME = 180 * 24 * 60 * 60 * 1000;
export type AnalyticsConsentValue = "unknown" | "granted" | "denied";
let sessionChoice: AnalyticsConsentValue = "unknown";
let storageUnavailable = false;

export function readAnalyticsConsent(): AnalyticsConsentValue {
  if (typeof window === "undefined") return "unknown";
  if (storageUnavailable) return sessionChoice;
  try {
    const saved = JSON.parse(window.localStorage.getItem(ANALYTICS_CONSENT_KEY) ?? "null");
    if (saved?.version === 1 && typeof saved.expires === "number" && saved.expires > Date.now()) {
      return saved.analytics === true
        ? "granted"
        : saved.analytics === false
          ? "denied"
          : "unknown";
    }
    return "unknown";
  } catch {
    return sessionChoice;
  }
}

export function saveAnalyticsConsent(allow: boolean) {
  sessionChoice = allow ? "granted" : "denied";
  try {
    window.localStorage.setItem(
      ANALYTICS_CONSENT_KEY,
      JSON.stringify({
        version: 1,
        analytics: allow,
        expires: Date.now() + CONSENT_LIFETIME,
      }),
    );
  } catch {
    storageUnavailable = true;
  }
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

export function subscribeAnalyticsConsent(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
  };
}

export function isPublicAnalyticsPath(pathname: string) {
  return ["/", "/privacy", "/terms", "/cookies"].includes(pathname);
}

export function filterAnalyticsEvent<T extends { url: string }>(event: T): T | null {
  if (readAnalyticsConsent() !== "granted") return null;
  try {
    const url = new URL(event.url);
    if (url.origin !== window.location.origin || !isPublicAnalyticsPath(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
