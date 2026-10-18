import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";

export default function WelcomeLoading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4">
        <span className="sr-only">Loading your saved setup progress.</span>
        <AppLoadingSkeleton variant="list" rows={4} />
      </div>
    </PageShell>
  );
}
