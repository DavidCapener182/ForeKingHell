import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";

export default function SessionsLoading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true">
        <AppLoadingSkeleton variant="list" rows={6} />
      </div>
    </PageShell>
  );
}
