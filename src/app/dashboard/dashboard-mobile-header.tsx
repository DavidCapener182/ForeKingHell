"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useState } from "react";

const dashboardTabs = [
  {
    key: "today",
    label: "Today",
    href: "/dashboard?section=today#dashboard-mobile-today",
    targetId: "dashboard-mobile-today",
  },
  {
    key: "decisions",
    label: "Decisions",
    href: "/dashboard?section=decisions#dashboard-mobile-decisions",
    targetId: "dashboard-mobile-decisions",
  },
  {
    key: "more",
    label: "More",
    href: "/dashboard?section=more#dashboard-mobile-more",
    targetId: "dashboard-mobile-more",
  },
] as const;

export type DashboardTabKey = (typeof dashboardTabs)[number]["key"];

export function DashboardMobileHeader({
  initialActiveKey = "today",
}: {
  initialActiveKey?: DashboardTabKey;
}) {
  const [activeKey, setActiveKey] = useState<DashboardTabKey>(initialActiveKey);

  useEffect(() => {
    let frame = 0;

    function updateActiveSection() {
      const activationLine = window.innerHeight * 0.34;
      let nextKey: DashboardTabKey = "today";

      for (const tab of dashboardTabs) {
        const section = document.getElementById(tab.targetId);

        if (section && section.getBoundingClientRect().top <= activationLine) {
          nextKey = tab.key;
        }
      }

      setActiveKey((current) => (current === nextKey ? current : nextKey));
    }

    function scheduleUpdate() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateActiveSection);
    }

    frame = window.requestAnimationFrame(updateActiveSection);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, []);

  function handleTabClick(
    event: MouseEvent<HTMLAnchorElement>,
    tab: (typeof dashboardTabs)[number],
  ) {
    setActiveKey(tab.key);

    const section = document.getElementById(tab.targetId);

    if (!section) {
      return;
    }

    event.preventDefault();
    window.history.replaceState(null, "", tab.href);
    section.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <section className="sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-40 -mx-4 -mt-3 grid max-w-[100vw] overflow-x-clip border-b border-[var(--ios-separator)] bg-[var(--ios-material-strong)] px-4 py-2 backdrop-blur-xl lg:hidden">
      <nav
        aria-label="Dashboard views"
        tabIndex={0}
        className="ios-route-tabs focus-aaa flex w-full max-w-full overflow-x-auto outline-none"
      >
        {dashboardTabs.map((tab) => {
          const active = tab.key === activeKey;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              onClick={(event) => handleTabClick(event, tab)}
              className="ios-route-tab focus-aaa min-h-11 min-w-0 flex-1 touch-manipulation whitespace-nowrap text-center outline-none transition-[background-color,color,box-shadow,transform] duration-100 ease-out active:scale-[0.98]"
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
