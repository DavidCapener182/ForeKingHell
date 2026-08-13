"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
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
    <aside
      className={cn(
        "sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-card/95 p-3 shadow-lg backdrop-blur",
        className,
      )}
      aria-live="polite"
      data-dirty-form-bar
    >
      <p className="min-w-0 flex-1 text-sm font-medium">You have unsaved changes.</p>
      {onReset ? (
        <Button type="button" variant="ghost" onClick={onReset} disabled={saving}>
          Reset
        </Button>
      ) : null}
      <Button type={onSave ? "button" : "submit"} onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : saveLabel}
      </Button>
    </aside>
  );
}
