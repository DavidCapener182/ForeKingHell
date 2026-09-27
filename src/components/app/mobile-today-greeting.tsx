"use client";
import { useEffect, useState } from "react";

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
    <header className="mobile-home-greeting">
      <h1 className="sr-only" data-mobile-route-label>
        Home
      </h1>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "Europe/London",
        }).format(now)}
      </p>
    </header>
  );
}
