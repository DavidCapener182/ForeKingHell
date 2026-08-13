"use client";

import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export function PlaySetupDrawer({
  children,
  label = "Change course or tee",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <Drawer repositionInputs={false}>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" className="min-h-12 w-full rounded-xl">
          <Settings2 className="size-4" aria-hidden />
          {label}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[88dvh] pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Course and tee</DrawerTitle>
          <DrawerDescription>
            Set the playing context once, then return to the selected-course decision.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-4">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
