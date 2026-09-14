import { track } from "@vercel/analytics";
import { isPublicAnalyticsPath, readAnalyticsConsent } from "./analytics-consent";

export type PlausibleEventName =
  | "AI Coach Generated"
  | "AI Data Chat Generated"
  | "Import Saved"
  | "Import Started"
  | "Import Queued Offline"
  | "Invite Accepted"
  | "PWA Installed"
  | "Round Created"
  | "Scorecard Extracted"
  | "Public Join Beta Clicked"
  | "Public Sign In Clicked"
  | "Public Sample Tour Started"
  | "Public Sample Tour Completed"
  | "Public Course Twin Demo Opened"
  | "Public FAQ Item Opened";

type PlausiblePayload = {
  props?: Record<string, string | number | boolean | null>;
};

// Preserve the existing caller API while the analytics provider changes.
// Only public marketing intent is sent; account data and event properties are excluded.
export function trackPlausibleEvent(eventName: PlausibleEventName, payload?: PlausiblePayload) {
  // Keep compatibility with existing callers without sending their properties.
  void payload;
  if (
    typeof window === "undefined" ||
    readAnalyticsConsent() !== "granted" ||
    !isPublicAnalyticsPath(window.location.pathname) ||
    !eventName.startsWith("Public ")
  ) {
    return;
  }

  track(eventName);
}
