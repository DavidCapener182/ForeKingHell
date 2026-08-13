import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AppLoadingSkeleton({
  variant = "list",
  rows = 4,
  className,
}: {
  variant?: "answer" | "list" | "table" | "detail";
  rows?: number;
  className?: string;
}) {
  if (variant === "answer") {
    return (
      <section
        className={cn("grid gap-4 rounded-2xl border bg-card p-5", className)}
        aria-label="Loading answer"
      >
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </section>
    );
  }

  if (variant === "table") {
    return (
      <section
        className={cn("overflow-hidden rounded-xl border bg-card", className)}
        aria-label="Loading table"
      >
        <div className="flex gap-3 border-b p-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-24" />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_7rem_7rem] gap-4 border-b p-3 last:border-b-0"
          >
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section
      className={cn(
        "grid gap-3",
        variant === "detail" && "rounded-xl border bg-card p-4",
        className,
      )}
      aria-label="Loading content"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="grid min-w-0 flex-1 gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </section>
  );
}
