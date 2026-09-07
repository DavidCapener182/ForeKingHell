import { PageHeader, PageShell } from "@/components/premium";
import { getBillingPageData } from "@/lib/billing";
import { getChallengesPageData } from "@/lib/challenges";
import { ChallengeWorkspace } from "@/app/challenges/challenge-workspace";
export const dynamic = "force-dynamic";
export default async function ChallengesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; q?: string }>;
}) {
  const [params, data, billing] = await Promise.all([
    searchParams,
    getChallengesPageData(),
    getBillingPageData(),
  ]);
  return (
    <PageShell>
      <PageHeader
        title="Challenges"
        description="Choose a measured target, inspect its rules and follow qualifying results."
      />
      <ChallengeWorkspace
        challenges={data.challenges}
        templates={data.templates}
        freePlan={billing.activePlanKey === "free"}
        initialTab={params?.tab ?? "active"}
        initialQuery={params?.q ?? ""}
      />
    </PageShell>
  );
}
