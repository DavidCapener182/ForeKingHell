"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type MobileTab = {
  key: string;
  label: string;
  href: string;
};

export function MobileTabBar({
  tabs,
  activeKey,
  className,
  ariaLabel,
}: {
  tabs: MobileTab[];
  activeKey: string;
  className?: string;
  ariaLabel?: string;
}) {
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const nav = navRef.current;
    const activeTab = nav?.querySelector<HTMLElement>('[aria-current="page"]');

    activeTab?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
  }, [activeKey, tabs]);

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel ?? `Mobile ${activeKey} tabs`}
      tabIndex={0}
      className={cn(
        "premium-route-tabs -mx-4 flex min-w-0 gap-1.5 overflow-x-auto border-b px-4 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "min-h-10 shrink-0 touch-manipulation whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold tracking-normal outline-none transition-[border-color,background-color,color,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
  );
}
