"use client";

import { useState, type ReactNode } from "react";
import { Database } from "lucide-react";

import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";

export function CoachSupportingEvidencePanel({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <ResponsiveDetailPanel
      open={open}
      onOpenChange={setOpen}
      title="Supporting coach evidence"
      description="Movement, athletic-development and readiness signals behind the current diagnosis."
      trigger={
        <Button type="button" variant="outline" className="w-fit">
          <Database className="size-4" aria-hidden="true" />
          Review supporting evidence
        </Button>
      }
      contentClassName="grid gap-4"
    >
      {children}
    </ResponsiveDetailPanel>
  );
}
