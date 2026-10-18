import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";

export default function RoundReviewLoading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4">
        <span className="sr-only">Loading round scorecard, mapped holes and linked evidence</span>
        <AppLoadingSkeleton variant="answer" />
        <AppLoadingSkeleton variant="table" rows={6} />
      </div>
    </PageShell>
  );
}
