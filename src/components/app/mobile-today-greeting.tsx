"use client";
import { useEffect, useState } from "react";
import { MobileLargeTitle } from "./mobile-screen";

export function MobileTodayGreeting() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);
  const hour = now?.getHours();
  const greeting =
    hour === undefined
      ? "Your golf companion"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
  return (
    <MobileLargeTitle
      title="Today"
      eyebrow={
        now
          ? new Intl.DateTimeFormat(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(now)
          : undefined
      }
      detail={greeting}
    />
  );
}
