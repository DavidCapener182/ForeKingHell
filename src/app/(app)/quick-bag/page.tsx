import { QuickBagClient } from "@/app/quick-bag/quick-bag-client";
import { MobileQuickBag } from "@/app/quick-bag/mobile-quick-bag";
import { PageHeader, PageShell } from "@/components/premium";
import { getMobileQuickBag } from "@/lib/mobile-quick-bag-data";
import { getCurrentUserPreferences, requireCurrentUserId } from "@/lib/current-user";
export const dynamic = "force-dynamic";
export default async function QuickBagPage() {
  const [clubs, userId, preferences] = await Promise.all([
    getMobileQuickBag(),
    requireCurrentUserId(),
    getCurrentUserPreferences(),
  ]);
  return (
    <PageShell>
      <section className="grid gap-5" data-quick-bag>
        <PageHeader
          title="Quick Bag"
          eyebrow="On-course reference"
          description="Enter an exact target or find a club. Check the measured range and confidence before choosing."
        />
        <QuickBagClient
          clubs={clubs}
          accountId={userId}
          preferredUnits={preferences.preferredUnits}
        />
        <details className="rounded-xl border bg-card p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Saved bag reference · carry and total
          </summary>
          <MobileQuickBag clubs={clubs} accountId={userId} />
        </details>
      </section>
    </PageShell>
  );
}
