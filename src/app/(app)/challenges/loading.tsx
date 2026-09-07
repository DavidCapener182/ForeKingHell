import { PageShell } from "@/components/premium";
import { AppLoadingSkeleton } from "@/components/app/app-loading-skeleton";

export default function ChallengesLoading() {
  return (
    <PageShell>
      <section aria-busy="true" aria-label="Loading challenges" className="grid gap-4">
        <h1 className="text-2xl font-semibold">Loading challenges</h1>
        <p>Checking your challenge states and qualifying results.</p>
        <AppLoadingSkeleton variant="list" rows={4} />
      </section>
    </PageShell>
  );
}
