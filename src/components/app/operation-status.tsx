import { AlertCircle, CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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
    status === "working"
      ? LoaderCircle
      : status === "success"
        ? CheckCircle2
        : status === "warning"
          ? TriangleAlert
          : AlertCircle;

  return (
    <Alert
      variant={status === "error" ? "destructive" : "default"}
      className={cn(
        status === "success" && "border-primary/25 bg-primary/5",
        status === "warning" && "border-amber-500/30 bg-amber-500/5",
        className,
      )}
      aria-live={status === "error" ? "assertive" : "polite"}
      data-operation-status={status}
    >
      <Icon
        className={cn("size-4", status === "working" && "animate-spin motion-reduce:animate-none")}
        aria-hidden
      />
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
