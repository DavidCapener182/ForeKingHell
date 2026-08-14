import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";

export default function AnalyseLoading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4">
        <AppLoadingSkeleton variant="answer" />
        <AppLoadingSkeleton variant="detail" rows={4} />
      </div>
    </PageShell>
  );
}
