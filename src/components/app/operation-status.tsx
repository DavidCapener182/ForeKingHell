import { AlertCircle, CheckCircle2, TriangleAlert } from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function OperationStatus({
  status,
  title,
  description,
  progress,
  action,
  className,
}: {
  status: "working" | "success" | "warning" | "error";
  title: string;
  description?: React.ReactNode;
  progress?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon =
    status === "success" ? CheckCircle2 : status === "warning" ? TriangleAlert : AlertCircle;
  const working = status === "working";
  const success = status === "success";

  return (
    <Alert
      variant={status === "error" ? "destructive" : "default"}
      className={cn(
        status === "success" &&
          "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]",
        status === "warning" &&
          "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]",
        "grid-cols-[auto_1fr] gap-x-2 [&>.t-icon-swap]:row-span-2 [&>.t-icon-swap]:translate-y-0.5 [&>.t-icon-swap]:text-current",
        className,
      )}
      aria-live={status === "error" ? "assertive" : "polite"}
      data-operation-status={status}
    >
      <span className="t-icon-swap" data-state={working ? "a" : "b"} aria-hidden="true">
        <span className="t-icon" data-icon="a">
          <Spinner className={cn("size-4", !working && "animate-none")} role={undefined} />
        </span>
        <span
          className={cn("t-icon", success && "t-success-check")}
          data-icon="b"
          data-state={success ? "in" : "out"}
        >
          <Icon className="size-4" />
        </span>
      </span>
      <AlertTitle className="col-start-2">
        <span key={`${status}:${title}`} className="t-text-state" data-motion-ready="true">
          {title}
        </span>
      </AlertTitle>
      {description || typeof progress === "number" ? (
        <AlertDescription className="col-start-2 grid gap-2">
          {description ? <div>{description}</div> : null}
          {typeof progress === "number" ? (
            <Progress
              value={progress}
              aria-label={`${title}: ${Math.round(progress)}%`}
              className="h-1.5"
            />
          ) : null}
        </AlertDescription>
      ) : null}
      {action ? <AlertAction>{action}</AlertAction> : null}
    </Alert>
  );
}
