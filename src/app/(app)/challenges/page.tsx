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
        description="Choose a challenge to see its target, which shots qualify and who leads."
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
