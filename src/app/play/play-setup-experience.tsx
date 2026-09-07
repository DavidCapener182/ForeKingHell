"use client";

import {
  PlaySelectionControls,
  type PlaySelectionControlsProps,
} from "@/app/play/play-selection-controls";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export function PlaySetupExperience({
  open,
  onOpenChange,
  ...selection
}: PlaySelectionControlsProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[88dvh] pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Course and tee</DrawerTitle>
          <DrawerDescription>
            Set the playing context once, then return to the selected-course decision.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-4">
          <PlaySelectionControls
            key={`${selection.selectedCourseId}:${selection.selectedTeeId}`}
            {...selection}
            showSearch
            stageChanges
          />
          <Button
            type="button"
            variant="outline"
            className="mt-4 min-h-11 w-full"
            onClick={() => onOpenChange(false)}
          >
            Done / cancel unsaved setup
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
