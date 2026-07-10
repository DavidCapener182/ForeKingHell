"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

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

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const centerActiveTab = () => {
      const activeTab = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!activeTab) {
        return;
      }

      const targetLeft = Math.max(
        0,
        Math.min(
          activeTab.offsetLeft - (nav.clientWidth - activeTab.clientWidth) / 2,
          nav.scrollWidth - nav.clientWidth,
        ),
      );

      nav.scrollTo({
        left: targetLeft,
        behavior: "auto",
      });
    };

    const frame = requestAnimationFrame(() => {
      centerActiveTab();
      requestAnimationFrame(centerActiveTab);
    });
    const timeoutId = window.setTimeout(centerActiveTab, 150);
    const fontReady = document.fonts?.ready.then(centerActiveTab);

    window.addEventListener("resize", centerActiveTab);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", centerActiveTab);
      void fontReady;
    };
  }, [activeKey, tabs]);

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel ?? `Mobile ${activeKey} tabs`}
      tabIndex={0}
      className={cn(
        "premium-route-tabs focus-aaa -mx-4 flex min-w-0 snap-x snap-proximity gap-1.5 overflow-x-auto overscroll-x-contain border-b px-4 py-1 scroll-px-4 outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
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
              "focus-aaa min-h-11 shrink-0 snap-center touch-manipulation whitespace-nowrap rounded-md border px-3.5 py-2.5 text-sm font-semibold tracking-normal outline-none transition-[border-color,background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]",
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
