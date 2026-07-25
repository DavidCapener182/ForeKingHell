import type { ReactNode } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Empty
      className={cn(
        "border border-border/80 bg-card px-5 py-7 shadow-xs sm:px-7 sm:py-8",
        className,
      )}
    >
      <EmptyHeader className="gap-2.5">
        {icon ? (
          <EmptyMedia
            variant="icon"
            className="mb-1 size-10 rounded-xl bg-primary/10 text-primary [&_svg:not([class*='size-'])]:size-5"
          >
            {icon}
          </EmptyMedia>
        ) : null}
        <EmptyTitle className="text-base font-semibold">{title}</EmptyTitle>
        {description ? (
          <EmptyDescription className="max-w-md">{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent className="mt-1">{action}</EmptyContent> : null}
    </Empty>
  );
}
