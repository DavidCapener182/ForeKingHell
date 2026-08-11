import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { IOSGroupedList, IOSListRow } from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getCompanionSummary } from "@/lib/companion-summary-data";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function CompanionSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const userId = await requireCurrentUserId();
  const from = safePath((await searchParams).from);
  const summary = await getCompanionSummary(userId, from);

  return (
    <PageShell>
      <MobileAppShell className="gap-5" data-companion-summary>
        <MobileTopBar title={summary.eyebrow} />
        <section className="ios-grouped-list grid gap-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {summary.eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-7 tracking-tight">{summary.title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{summary.description}</p>
          </div>
          <Button asChild className="min-h-12 rounded-xl">
            <Link href={summary.primary.href}>
              {summary.primary.label}
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>
        </section>
        <IOSGroupedList label={`${summary.eyebrow} details`}>
          {summary.rows.length > 0 ? (
            summary.rows.map((row) => (
              <IOSListRow
                key={`${row.label}-${row.value}`}
                label={row.label}
                value={row.value}
                detail={row.detail}
              />
            ))
          ) : (
            <IOSListRow
              label="Nothing current"
              detail="New measured evidence will appear here when available."
            />
          )}
        </IOSGroupedList>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href={`/surface/workbench?next=${encodeURIComponent(from)}`}>
            Open full desktop site
          </Link>
        </Button>
      </MobileAppShell>
    </PageShell>
  );
}

function safePath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/coach";
}
