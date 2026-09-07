import { PageHeader, PageShell } from "@/components/premium";
export default function LoadingSharedRound() {
  return (
    <PageShell>
      <PageHeader
        title="Opening shared Course Twin"
        description="Checking this link and loading its permitted replay."
      />
      <p role="status">Loading shared replay…</p>
    </PageShell>
  );
}
