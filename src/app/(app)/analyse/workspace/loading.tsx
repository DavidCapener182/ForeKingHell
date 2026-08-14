import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";

export default function AnalysisWorkspaceLoading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4">
        <AppLoadingSkeleton variant="answer" />
        <div className="grid gap-4 lg:grid-cols-2">
          <AppLoadingSkeleton variant="detail" rows={3} />
          <AppLoadingSkeleton variant="detail" rows={3} />
        </div>
        <AppLoadingSkeleton variant="table" rows={4} />
      </div>
    </PageShell>
  );
}
