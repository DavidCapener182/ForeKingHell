import type { ReactNode } from "react";
import { WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";

export function OfflineState({
  title = "You are offline",
  description = "Live analysis and account changes need a connection. Cached content remains read-only.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <WifiOff className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6">{description}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
