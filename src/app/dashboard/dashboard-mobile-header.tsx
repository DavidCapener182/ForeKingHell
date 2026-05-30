"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

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

  function handleTabClick(event: MouseEvent<HTMLAnchorElement>, tab: (typeof dashboardTabs)[number]) {
    setActiveKey(tab.key);

    const section = document.getElementById(tab.targetId);

    if (!section) {
      return;
    }

    event.preventDefault();
    window.history.replaceState(null, "", tab.href);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="premium-mobile-bar sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-40 -mx-4 -mt-4 grid max-w-[100vw] gap-0 overflow-x-clip px-4 sm:hidden">
      <header className="-mx-4 grid h-11 max-w-[100vw] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-y border-border/70 px-4">
        <span aria-hidden="true" />
        <h1 className="truncate text-center text-[1.15rem] font-semibold leading-7 tracking-normal text-foreground">
          Dashboard
        </h1>
        <span aria-hidden="true" />
      </header>
      <nav
        aria-label="Dashboard sections"
        tabIndex={0}
        className="premium-route-tabs -mx-4 flex max-w-[100vw] gap-1.5 overflow-x-auto border-b px-4 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              className={cn(
                "min-h-9 shrink-0 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-semibold tracking-normal transition-[border-color,background-color,color,box-shadow] duration-150 ease-out",
                active
                  ? "premium-route-tab-active"
                  : "border-transparent text-muted-foreground hover:bg-white/60 hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
