"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Settings2 } from "lucide-react";

import type { PlaySelectionControlsProps } from "@/app/play/play-selection-controls";
import { Button } from "@/components/ui/button";

const PlaySetupExperience = dynamic(
  () => import("@/app/play/play-setup-experience").then((module) => module.PlaySetupExperience),
  {
    loading: () => (
      <p className="px-1 text-xs text-muted-foreground" role="status">
        Opening course setup…
      </p>
    ),
  },
);

export function LazyPlaySetupDrawer({
  label = "Change course or tee",
  ...selection
}: PlaySelectionControlsProps & { label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-12 w-full rounded-xl"
        onClick={() => setOpen(true)}
        data-play-setup-trigger
      >
        <Settings2 className="size-4" aria-hidden />
        {label}
      </Button>
      {open ? <PlaySetupExperience open={open} onOpenChange={setOpen} {...selection} /> : null}
    </>
  );
}
