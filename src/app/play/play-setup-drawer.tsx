"use client";

import { ChevronDown, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export function PlaySetupDrawer({
  children,
  label = "Change course or tee",
  description,
  compact = false,
}: {
  children: React.ReactNode;
  label?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <Drawer repositionInputs={false}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant={compact ? "ghost" : "outline"}
          className={
            compact
              ? "min-h-11 h-auto w-full justify-between gap-3 px-0 py-1 text-left whitespace-normal"
              : "min-h-12 w-full rounded-xl"
          }
          aria-label={compact ? `Change course or tee: ${label}, ${description ?? ""}` : undefined}
        >
          {compact ? (
            <>
              <span className="grid min-w-0 gap-0.5">
                <span>{label}</span>
                <span className="text-xs font-normal text-muted-foreground">{description}</span>
              </span>
              <ChevronDown className="size-4 shrink-0" aria-hidden />
            </>
          ) : (
            <>
              <Settings2 className="size-4" aria-hidden />
              {label}
            </>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[88dvh] pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="text-left">
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle>Course and tee</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" className="min-h-11">
                Done
              </Button>
            </DrawerClose>
          </div>
          <DrawerDescription>
            Set the playing context once, then return to the selected-course decision.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-4">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
