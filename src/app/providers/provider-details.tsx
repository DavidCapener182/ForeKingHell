"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
export function ProviderDetails({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ResponsiveDetailPanel
      open={open}
      onOpenChange={setOpen}
      title={title}
      description="Connection controls and recorded import evidence. Disconnecting preserves imported history."
      trigger={
        <Button
          variant="outline"
          className="h-auto min-h-16 w-full items-start flex-col whitespace-normal p-4 text-left"
        >
          <span className="font-semibold">{title}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {status} · View connection and diagnostics
          </span>
        </Button>
      }
    >
      <div className="grid gap-4">{children}</div>
    </ResponsiveDetailPanel>
  );
}
