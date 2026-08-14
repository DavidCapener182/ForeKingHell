"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function DirtyFormBar({
  dirty,
  saving = false,
  onSave,
  onReset,
  saveLabel = "Save changes",
  className,
}: {
  dirty: boolean;
  saving?: boolean;
  onSave?: () => void;
  onReset?: () => void;
  saveLabel?: string;
  className?: string;
}) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!dirty) return null;

  return (
    <Card
      className={cn(
        "sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 gap-0 bg-card/95 py-0 shadow-xl ring-primary/25 backdrop-blur",
        className,
      )}
      aria-live="polite"
      data-dirty-form-bar
    >
      <CardContent className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">You have unsaved changes.</p>
          <p className="text-xs text-muted-foreground">Save or reset before leaving this page.</p>
        </div>
        <Separator orientation="vertical" className="hidden min-h-9 sm:block" />
        <ButtonGroup className="ml-auto">
          {onReset ? (
            <Button type="button" variant="outline" onClick={onReset} disabled={saving}>
              Reset
            </Button>
          ) : null}
          <Button type={onSave ? "button" : "submit"} onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : saveLabel}
          </Button>
        </ButtonGroup>
      </CardContent>
    </Card>
  );
}
