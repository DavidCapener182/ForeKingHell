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

export function DashboardMobileHeader({ initialActiveKey = "today" }: { initialActiveKey?: DashboardTabKey }) {
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
    <section className="sticky top-0 z-40 -mx-4 -mt-5 grid min-w-0 gap-0 bg-white px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:hidden">
      <div className="-mx-4 h-12 px-4" aria-hidden="true" />
      <header className="-mx-4 grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-y border-[#E5E7EB] px-4">
        <span aria-hidden="true" />
        <h1 className="truncate text-center text-[1.35rem] font-semibold leading-7 tracking-normal text-[#050505]">
          Dashboard
        </h1>
        <span aria-hidden="true" />
      </header>
      <nav aria-label="Dashboard sections" className="-mx-4 flex min-w-0 gap-6 overflow-x-auto border-b border-[#E5E7EB] px-4">
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
                "shrink-0 whitespace-nowrap border-b-2 py-3 text-base font-semibold tracking-normal",
                active
                  ? "border-[#0B7A3B] text-[#050505]"
                  : "border-transparent text-[#6B7280]",
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
