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
