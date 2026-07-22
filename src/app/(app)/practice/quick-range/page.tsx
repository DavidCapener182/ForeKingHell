import { requireCurrentUserId } from "@/lib/current-user";
import { getProductPreferences } from "@/lib/product-preferences";
import { QuickRangeSession } from "@/app/practice/quick-range/quick-range-session";

export const dynamic = "force-dynamic";

export default async function QuickRangePage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string }>;
}) {
  const params = await searchParams;
  const userId = await requireCurrentUserId();
  const preferences = await getProductPreferences(userId);
  const requestedFocus = params?.focus?.trim().slice(0, 80);

  return <QuickRangeSession focus={requestedFocus || preferences.seasonPlan.focus} />;
}
