import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function AppErrorState({
  title = "This view needs attention",
  description,
  action,
  className,
}: {
  title?: React.ReactNode;
  description: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Alert
      variant="destructive"
      className={cn("min-w-0 break-words p-4 [&_button]:min-h-11 [&_a]:min-h-11", className)}
      data-app-error-state
    >
      <AlertCircle className="size-4" aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <div>{description}</div>
        {action ? <div className="mt-3">{action}</div> : null}
      </AlertDescription>
    </Alert>
  );
}
