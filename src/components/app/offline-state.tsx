import type { ReactNode } from "react";
import { WifiOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    <Alert
      className={cn(
        "rounded-2xl border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] p-4 text-[var(--status-warning-foreground)]",
        className,
      )}
      aria-live="polite"
    >
      <WifiOff className="size-5" aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-current">
        {description}
        {action ? <div className="mt-3">{action}</div> : null}
      </AlertDescription>
    </Alert>
  );
}
