import { PageShell } from "@/components/premium";
import { getAutomaticShotReviewData } from "@/lib/automatic-shot-review-data";
import { MobileAutomaticReview } from "@/app/shots/mobile-automatic-review";
export const dynamic = "force-dynamic";
export default async function AutomaticReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const requestedPage = Number(query.page);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(10_000, requestedPage) : 1;
  const data = await getAutomaticShotReviewData(page);
  return (
    <PageShell>
      <MobileAutomaticReview {...data} page={page} />
    </PageShell>
  );
}
