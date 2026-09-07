import Link from "next/link";
import { redirect } from "next/navigation";
import { DriverDevelopmentPanel } from "@/components/analysis/driver-development-panel";
import { AppSurfaceLink } from "@/components/app/app-surface-link";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getCompanionSummary } from "@/lib/companion-summary-data";
import { requireCurrentUserId } from "@/lib/current-user";
import { companionDestination, hasDirectCompanionRoute } from "@/lib/companion-destination";
import { appSurfaceHref } from "@/lib/app-surface-navigation";
export const dynamic = "force-dynamic";
export default async function CompanionSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const userId = await requireCurrentUserId();
  const from = companionDestination((await searchParams).from, "/coach");
  if (hasDirectCompanionRoute(from)) redirect(from);
  const summary = await getCompanionSummary(userId, from);
  const destination = new URL(from, "https://companion.invalid");
  const showDriver =
    destination.pathname.startsWith("/coach") &&
    [destination.searchParams.get("club"), destination.searchParams.get("compareClub")].some(
      (value) => value?.toLowerCase() === "driver",
    );
  const primary = summary.primary.href.startsWith("/surface/")
    ? appSurfaceHref("workbench", from)
    : summary.primary.href;
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28" data-companion-summary>
        <PageHeader
          title={summary.title}
          description={summary.description}
          actions={
            <Button asChild className="h-auto min-h-11 whitespace-normal">
              <SummaryActionLink href={primary}>{summary.primary.label}</SummaryActionLink>
            </Button>
          }
        />
        <section className="grid gap-3 rounded-xl border p-5" aria-labelledby="summary-context">
          <h2 id="summary-context" className="text-lg font-semibold">
            {summary.eyebrow}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            This is a summary of current account evidence. It does not replace the requested full
            task.
          </p>
          <details>
            <summary className="min-h-11 cursor-pointer py-3 text-sm">
              Requested destination and filters
            </summary>
            <p className="break-all text-sm text-muted-foreground">{from}</p>
          </details>
        </section>
        <dl aria-label={`${summary.eyebrow} details`} className="grid gap-3 sm:grid-cols-2">
          {summary.rows.length ? (
            summary.rows.map((row, index) => (
              <div key={`${row.label}-${index}`} className="grid gap-2 rounded-xl border p-5">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="font-semibold">{row.value}</dd>
                {row.detail ? (
                  <dd className="text-sm leading-6 text-muted-foreground">{row.detail}</dd>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border p-5">
              <dt>No current evidence</dt>
              <dd className="mt-2 text-sm text-muted-foreground">
                No supporting rows are available for this summary yet.
              </dd>
            </div>
          )}
        </dl>
        {showDriver ? (
          <details className="rounded-xl border p-4">
            <summary className="min-h-11 cursor-pointer py-3">Supporting driver context</summary>
            <DriverDevelopmentPanel compact />
          </details>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal">
            <AppSurfaceLink href={appSurfaceHref("workbench", from)}>
              Open full workspace
            </AppSurfaceLink>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/today">Return to Today</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
function SummaryActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return href.startsWith("/surface/") ? (
    <AppSurfaceLink href={href as `/surface/${string}`}>{children}</AppSurfaceLink>
  ) : (
    <Link href={href}>{children}</Link>
  );
}
