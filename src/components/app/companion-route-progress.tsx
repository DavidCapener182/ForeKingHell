"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const transitionTimeoutMs = 12_000;

export function CompanionRouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocation = `${pathname}?${searchParams.toString()}`;
  const [navigation, setNavigation] = useState<{ destination: string; from: string } | null>(null);
  const activeNavigation = navigation?.from === currentLocation ? navigation : null;

  useEffect(() => {
    const startNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const target =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;

      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin || url.href === window.location.href) return;
      setNavigation({ destination: `${url.pathname}${url.search}`, from: currentLocation });
    };
    const startHistoryNavigation = () =>
      setNavigation({ destination: "previous page", from: currentLocation });

    document.addEventListener("click", startNavigation, true);
    window.addEventListener("popstate", startHistoryNavigation);
    return () => {
      document.removeEventListener("click", startNavigation, true);
      window.removeEventListener("popstate", startHistoryNavigation);
    };
  }, [currentLocation]);

  useEffect(() => {
    if (!activeNavigation) return;
    const timeout = window.setTimeout(() => setNavigation(null), transitionTimeoutMs);
    return () => window.clearTimeout(timeout);
  }, [activeNavigation]);

  if (!activeNavigation) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-[90]"
      role="status"
      aria-live="polite"
      aria-label="Loading next companion page"
      data-companion-route-progress
    >
      <span className="companion-route-progress block h-0.5 w-2/5 bg-gradient-to-r from-[#e5b33d] via-primary to-[#e5b33d] shadow-[0_0_12px_rgba(229,179,61,0.65)]" />
      <span className="sr-only">Loading {activeNavigation.destination}</span>
    </div>
  );
}
