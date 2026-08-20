import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";

export default function AuthenticatedRouteLoading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4">
        <span className="sr-only">Loading your golf workspace</span>
        <AppLoadingSkeleton variant="answer" />
        <AppLoadingSkeleton variant="detail" rows={3} />
      </div>
    </PageShell>
  );
}
