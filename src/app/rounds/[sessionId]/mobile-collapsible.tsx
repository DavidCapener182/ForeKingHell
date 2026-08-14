"use client";

import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const DESKTOP_MEDIA_QUERY = "(min-width: 64rem)";

function subscribeToDesktopViewport(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);

  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function isDesktopViewport() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

export function MobileCollapsible({
  title,
  description,
  count,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  count?: ReactNode;
  children: ReactNode;
}) {
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopViewport,
    isDesktopViewport,
    () => false,
  );
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      className="mobile-collapsible group/collapsible lg:contents"
      open={isDesktop || open}
      onOpenChange={setOpen}
    >
      <CollapsibleTrigger className="focus-aaa flex min-h-14 w-full cursor-pointer touch-manipulation items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-left outline-none lg:hidden">
        <span className="min-w-0">
          <span className="block text-[15px] font-medium leading-5 tracking-normal">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-[13px] leading-[1.15rem] text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 text-[13px] font-medium text-muted-foreground">
          {count ? <span>{count}</span> : null}
          <ChevronDown
            className="size-4 transition-transform duration-150 group-data-[state=open]/collapsible:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 lg:contents">{children}</CollapsibleContent>
    </Collapsible>
  );
}
