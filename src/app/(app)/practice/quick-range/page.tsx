import { requireCurrentUserId } from "@/lib/current-user";
import { getProductPreferences } from "@/lib/product-preferences";
import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

export default async function QuickRangePage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string }>;
}) {
  const params = await searchParams;
  const [userId, surface] = await Promise.all([requireCurrentUserId(), getRequestAppSurface()]);
  const preferences = await getProductPreferences(userId);
  const requestedFocus = params?.focus?.trim().slice(0, 80);
  const focus = requestedFocus || preferences.seasonPlan.focus;

  if (surface === "companion") {
    const { QuickRangeCompanionSession } =
      await import("@/app/practice/quick-range/quick-range-session");
    return <QuickRangeCompanionSession focus={focus} />;
  }

  const { QuickRangeWorkbenchSession } =
    await import("@/app/practice/quick-range/quick-range-workbench-session");
  return <QuickRangeWorkbenchSession focus={focus} />;
}
