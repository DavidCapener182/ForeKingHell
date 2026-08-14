import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4">
        <AppLoadingSkeleton variant="answer" />
        <section
          aria-label="Loading session comparison"
          className="grid gap-4 rounded-2xl border bg-card p-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
          <AppLoadingSkeleton variant="detail" rows={3} />
        </section>
      </div>
    </PageShell>
  );
}
