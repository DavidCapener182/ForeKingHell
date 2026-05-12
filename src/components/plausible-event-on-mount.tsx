"use client";

import { useEffect } from "react";

import { trackPlausibleEvent, type PlausibleEventName } from "@/lib/analytics";

export function PlausibleEventOnMount({ eventName }: { eventName: PlausibleEventName }) {
  useEffect(() => {
    trackPlausibleEvent(eventName);
  }, [eventName]);

  return null;
}
