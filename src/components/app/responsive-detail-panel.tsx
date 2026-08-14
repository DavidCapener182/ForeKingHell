"use client";

import { useEffect, useState } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ResponsivePanelMode = "drawer" | "sheet" | "inline";

export function ResponsiveDetailPanel({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  inlineAtUltrawide = false,
  inlineAtDesktop = false,
  className,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  inlineAtUltrawide?: boolean;
  inlineAtDesktop?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const mode = useResponsivePanelMode(inlineAtUltrawide, inlineAtDesktop);

  if (mode === "inline") {
    return (
      <aside
        className={cn("min-w-0 rounded-xl border bg-card", className)}
        data-responsive-detail-panel="inline"
        hidden={!open && !inlineAtDesktop}
      >
        <div className="border-b p-4">
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className={cn("min-w-0 p-4", contentClassName)}>{children}</div>
        {footer ? <div className="border-t p-4">{footer}</div> : null}
      </aside>
    );
  }

  if (mode === "drawer") {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent
          className={cn("max-h-[88dvh] pb-[env(safe-area-inset-bottom)]", className)}
          data-responsive-detail-panel="drawer"
        >
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4",
              contentClassName,
            )}
          >
            {children}
          </div>
          {footer ? <DrawerFooter className="border-t">{footer}</DrawerFooter> : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent
        side="right"
        className={cn("w-[min(32rem,92vw)] sm:max-w-[32rem]", className)}
        data-responsive-detail-panel="sheet"
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4",
            contentClassName,
          )}
        >
          {children}
        </div>
        {footer ? <SheetFooter className="border-t">{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}

function useResponsivePanelMode(
  inlineAtUltrawide: boolean,
  inlineAtDesktop: boolean,
): ResponsivePanelMode {
  const [mode, setMode] = useState<ResponsivePanelMode>("sheet");

  useEffect(() => {
    // The companion shell remains active below the desktop `lg` workbench breakpoint.
    // Keep its detail interactions as Drawers across phones and companion tablets.
    const drawerQuery = window.matchMedia("(max-width: 1023px)");
    const inlineQuery = window.matchMedia("(min-width: 1600px)");

    const update = () => {
      setMode(
        drawerQuery.matches
          ? "drawer"
          : inlineAtDesktop || (inlineAtUltrawide && inlineQuery.matches)
            ? "inline"
            : "sheet",
      );
    };
    update();
    drawerQuery.addEventListener("change", update);
    inlineQuery.addEventListener("change", update);
    return () => {
      drawerQuery.removeEventListener("change", update);
      inlineQuery.removeEventListener("change", update);
    };
  }, [inlineAtDesktop, inlineAtUltrawide]);

  return mode;
}
