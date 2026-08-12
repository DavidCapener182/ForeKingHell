"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type MobileTabBounds = {
  left: number;
  width: number;
};

export function getMobileTabContentBounds({
  tabLeft,
  tabWidth,
  viewportLeft,
  scrollLeft,
}: {
  tabLeft: number;
  tabWidth: number;
  viewportLeft: number;
  scrollLeft: number;
}): MobileTabBounds {
  return {
    left: tabLeft - viewportLeft + scrollLeft,
    width: tabWidth,
  };
}

export function getMobileTabScrollLeft({
  tabs,
  activeIndex,
  viewportWidth,
  maxScrollLeft,
}: {
  tabs: MobileTabBounds[];
  activeIndex: number;
  viewportWidth: number;
  maxScrollLeft: number;
}) {
  const active = tabs[activeIndex];
  if (!active || viewportWidth <= 0) {
    return 0;
  }

  const next = tabs[Math.min(activeIndex + 1, tabs.length - 1)] ?? active;
  const visibleEnd = next.left + next.width;
  let leadingIndex = activeIndex;

  while (leadingIndex > 0) {
    const candidate = tabs[leadingIndex - 1];
    if (!candidate || visibleEnd - candidate.left > viewportWidth) {
      break;
    }

    leadingIndex -= 1;
  }

  return Math.max(0, Math.min(tabs[leadingIndex]?.left ?? active.left, maxScrollLeft));
}

export type MobileTab = {
  key: string;
  label: string;
  href: string;
};

export function shouldUseCompactMobileTabs(tabs: MobileTab[]) {
  return tabs.length <= 4 && tabs.every((tab) => tab.label.length <= 10);
}

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
  const compact = shouldUseCompactMobileTabs(tabs);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const alignActiveTab = () => {
      const tabElements = Array.from(nav.querySelectorAll<HTMLElement>(":scope > a"));
      const activeIndex = tabElements.findIndex(
        (tab) => tab.getAttribute("aria-current") === "page",
      );
      if (activeIndex < 0) {
        return;
      }

      const viewportLeft = nav.getBoundingClientRect().left;

      const targetLeft = getMobileTabScrollLeft({
        tabs: tabElements.map((tab) => {
          const bounds = tab.getBoundingClientRect();
          return getMobileTabContentBounds({
            tabLeft: bounds.left,
            tabWidth: bounds.width,
            viewportLeft,
            scrollLeft: nav.scrollLeft,
          });
        }),
        activeIndex,
        viewportWidth: nav.clientWidth,
        maxScrollLeft: nav.scrollWidth - nav.clientWidth,
      });

      nav.scrollTo({
        left: targetLeft,
        behavior: "auto",
      });
    };

    const frame = requestAnimationFrame(() => {
      alignActiveTab();
      requestAnimationFrame(alignActiveTab);
    });
    const timeoutId = window.setTimeout(alignActiveTab, 150);
    const fontReady = document.fonts?.ready.then(alignActiveTab);

    window.addEventListener("resize", alignActiveTab);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", alignActiveTab);
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
        compact ? "w-full" : "ios-scroll-tabs -mx-4 px-4",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn(
              "ios-route-tab focus-aaa min-h-11 snap-start touch-manipulation whitespace-nowrap outline-none transition-[background-color,color,box-shadow,transform] duration-100 ease-out active:scale-[0.98]",
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
