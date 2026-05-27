"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const dashboardTabs = [
  { key: "today", label: "Latest", href: "/dashboard?section=today#today" },
  { key: "decisions", label: "Decisions", href: "/dashboard?section=decisions#decisions" },
  { key: "progress", label: "Progress", href: "/dashboard?section=progress#progress" },
  { key: "tools", label: "Tools", href: "/dashboard?section=tools#tools" },
  { key: "bag", label: "Bag", href: "/dashboard?section=bag#bag" },
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
        const section = document.getElementById(tab.key);

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

  return (
    <section className="premium-mobile-bar sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-40 -mx-4 -mt-4 grid max-w-[100vw] gap-0 overflow-x-clip px-4 sm:hidden">
      <header className="-mx-4 grid h-12 max-w-[100vw] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-y border-border/70 px-4">
        <span aria-hidden="true" />
        <h1 className="truncate text-center text-[1.25rem] font-semibold leading-7 tracking-normal text-foreground">
          Dashboard
        </h1>
        <span aria-hidden="true" />
      </header>
      <nav
        aria-label="Dashboard sections"
        tabIndex={0}
        className="premium-route-tabs -mx-4 flex max-w-[100vw] gap-1.5 overflow-x-auto border-b px-4 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {dashboardTabs.map((tab) => {
          const active = tab.key === activeKey;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              onClick={() => setActiveKey(tab.key)}
              className={cn(
                "min-h-10 shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold tracking-normal transition-[border-color,background-color,color,box-shadow] duration-150 ease-out",
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
