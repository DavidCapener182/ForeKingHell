"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function DelayedGolfLoader({
  label,
  className,
  delayMs = 2500,
}: {
  label: string;
  className?: string;
  delayMs?: number;
}) {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowLoader(true);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs]);

  if (!showLoader) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mx-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2 text-sm font-medium text-foreground shadow-sm",
        className,
      )}
    >
      <Loader2
        className="size-4 animate-spin text-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
