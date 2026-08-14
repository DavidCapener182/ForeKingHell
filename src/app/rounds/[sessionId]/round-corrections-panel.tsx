"use client";

import { useState, type ReactNode } from "react";
import { PencilLine } from "lucide-react";

import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";

export function RoundCorrectionsPanel({
  shotCount,
  children,
}: {
  shotCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <ResponsiveDetailPanel
      open={open}
      onOpenChange={setOpen}
      title="Round correction tools"
      description={`${shotCount} linked shots. Change only the evidence that is wrong; the original import remains preserved.`}
      trigger={
        <Button type="button" className="w-fit">
          <PencilLine className="size-4" aria-hidden="true" />
          Open correction tools
        </Button>
      }
      className="sm:max-w-[min(72rem,94vw)]"
      contentClassName="grid gap-4"
    >
      {children}
    </ResponsiveDetailPanel>
  );
}
