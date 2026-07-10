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
  const compact = tabs.length <= 4;

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
        "ios-route-tabs focus-aaa flex min-w-0 snap-x snap-proximity overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        compact ? "w-full" : "ios-scroll-tabs -mx-4 px-4 scroll-px-4",
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
              "ios-route-tab focus-aaa min-h-11 snap-center touch-manipulation whitespace-nowrap outline-none transition-[background-color,color,box-shadow,transform] duration-100 ease-out active:scale-[0.98]",
              compact ? "min-w-0 flex-1" : "shrink-0",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
