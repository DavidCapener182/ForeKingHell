import { PageHeader, PageShell } from "@/components/premium";
export default function LoadingSharedRound() {
  return (
    <PageShell>
      <PageHeader
        title="Opening shared round"
        description="Checking this link and loading its permitted scorecard."
      />
      <p role="status">Loading shared scorecard…</p>
    </PageShell>
  );
}
