import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";
import { Skeleton } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-5">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-56" />
          <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
        </div>
        <div className="lg:hidden">
          <AppLoadingSkeleton variant="list" rows={4} />
        </div>
        <section
          className="relative hidden gap-4 pl-9 before:absolute before:inset-y-3 before:left-3 before:w-px before:bg-border lg:grid"
          aria-label="Loading feed timeline"
          data-feed-timeline-skeleton
        >
          {Array.from({ length: 4 }, (_, index) => (
            <article key={index} className="relative rounded-xl border bg-card p-4">
              <Skeleton className="absolute -left-9 top-5 size-6 rounded-full" />
              <div className="flex gap-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </PageShell>
  );
}
