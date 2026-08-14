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

  return (
    <Alert
      variant={status === "error" ? "destructive" : "default"}
      className={cn(
        status === "success" &&
          "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]",
        status === "warning" &&
          "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]",
        className,
      )}
      aria-live={status === "error" ? "assertive" : "polite"}
      data-operation-status={status}
    >
      {status === "working" ? (
        <Spinner className="size-4" />
      ) : (
        <Icon className="size-4" aria-hidden />
      )}
      <AlertTitle>{title}</AlertTitle>
      {description || typeof progress === "number" ? (
        <AlertDescription className="grid gap-2">
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
