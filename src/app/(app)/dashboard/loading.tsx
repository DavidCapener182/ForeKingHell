import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4">
        <AppLoadingSkeleton variant="answer" />
        <section className="grid gap-3 md:grid-cols-4" aria-label="Loading dashboard metrics">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </section>
        <AppLoadingSkeleton variant="detail" rows={3} />
      </div>
    </PageShell>
  );
}
