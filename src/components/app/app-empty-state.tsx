import { EmptyState } from "@/components/app/empty-state";
import { cn } from "@/lib/utils";

export function AppEmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  primaryAction: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      className={className}
      action={
        <div className={cn("flex w-full flex-col gap-2 sm:flex-row sm:justify-center")}>
          {primaryAction}
          {secondaryAction}
        </div>
      }
    />
  );
}
