"use client";
import { useEffect, useState } from "react";
import { MobileLargeTitle } from "./mobile-screen";

export function MobileTodayGreeting({ initialNow }: { initialNow: string }) {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);
  return (
    <MobileLargeTitle
      title="Today"
      eyebrow={new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/London",
      }).format(now)}
    />
  );
}
