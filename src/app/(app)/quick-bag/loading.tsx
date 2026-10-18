import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";
export default function Loading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4">
        <p className="text-sm text-muted-foreground">Loading your measured bag reference</p>
        <AppLoadingSkeleton variant="table" rows={4} />
      </div>
    </PageShell>
  );
}
