"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Separator } from "@/components/ui/separator";

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
  const inline = useWideFilterToolbar();

  if (inline) {
    return (
      <div
        className="flex min-w-0 flex-wrap items-end gap-3 rounded-lg bg-muted/35 p-2 ring-1 ring-border [&>.grid]:contents [&>.space-y-5]:contents [&_[data-slot=field]]:min-w-44 [&_[data-slot=field]]:flex-1"
        data-responsive-filter-panel="inline"
        aria-label={typeof title === "string" ? title : "Filters"}
      >
        <div className="flex min-h-9 items-center gap-2 px-1 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden />
          <span>{title}</span>
          {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
        </div>
        <Separator orientation="vertical" className="min-h-9" />
        {children}
        <ButtonGroup className="ml-auto">
          {onClear && activeCount > 0 ? (
            <Button type="button" variant="outline" onClick={onClear}>
              <X className="size-4" aria-hidden />
              Clear
            </Button>
          ) : null}
          {applyAction}
        </ButtonGroup>
      </div>
    );
  }

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

function useWideFilterToolbar() {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1600px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return wide;
}
