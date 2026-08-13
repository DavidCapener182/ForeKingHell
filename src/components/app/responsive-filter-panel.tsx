"use client";

import { SlidersHorizontal, X } from "lucide-react";

import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ResponsiveFilterPanel({
  open,
  onOpenChange,
  activeCount = 0,
  onClear,
  children,
  applyAction,
  title = "Filters",
  description = "Narrow the current view without losing your place.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount?: number;
  onClear?: () => void;
  children: React.ReactNode;
  applyAction?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <ResponsiveDetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      trigger={
        <Button type="button" variant="outline">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
          {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
        </Button>
      }
      footer={
        <div className="flex w-full items-center gap-2">
          {onClear && activeCount > 0 ? (
            <Button type="button" variant="ghost" onClick={onClear}>
              <X className="size-4" aria-hidden />
              Clear all
            </Button>
          ) : null}
          <div className="ml-auto">{applyAction}</div>
        </div>
      }
    >
      <div className="grid gap-4">{children}</div>
    </ResponsiveDetailPanel>
  );
}
