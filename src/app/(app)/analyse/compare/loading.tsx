import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";
import { PageShell } from "@/components/premium";

export default function Loading() {
  return (
    <PageShell>
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4">
        <AppLoadingSkeleton variant="answer" />
        <AppLoadingSkeleton variant="table" rows={5} />
      </div>
    </PageShell>
  );
}
