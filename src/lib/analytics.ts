export type PlausibleEventName =
  | "AI Coach Generated"
  | "Import Saved"
  | "Import Started"
  | "Import Queued Offline"
  | "Invite Accepted"
  | "PWA Installed"
  | "Round Created"
  | "Scorecard Extracted";

type PlausiblePayload = {
  props?: Record<string, string | number | boolean | null>;
};

declare global {
  interface Window {
    plausible?: (eventName: string, payload?: PlausiblePayload) => void;
  }
}

export function trackPlausibleEvent(eventName: PlausibleEventName, payload?: PlausiblePayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.plausible?.(eventName, payload);
}
