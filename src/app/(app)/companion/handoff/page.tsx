import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Flag, Target } from "lucide-react";

import { IOSGroupedList, IOSListRow, IOSSectionHeader } from "@/components/app/ios-mobile";
import { findRouteMetadata } from "@/components/app/route-metadata";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";

export default async function CompanionHandoffPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const requestedPath = safeRequestedPath((await searchParams).from);
  const pathname = requestedPath.split("?")[0] ?? "/today";
  const route = findRouteMetadata(pathname);
  const title = route?.pageTitle ?? "This workspace";
  const explanation =
    route?.mobileExplanation ??
    "This workspace needs the detailed filtering and larger tables available in the full site.";
  const fallbackRoute = route?.mobileFallbackRoute ?? "/today";
  const fallbackLabel = route?.mobileFallbackLabel ?? "Go to Today";

  return (
    <PageShell>
      <MobileAppShell className="gap-5" data-companion-desktop-handoff>
        <MobileTopBar title="Full-site workspace" />

        <section className="ios-grouped-list grid gap-4 p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
            <BriefcaseBusiness className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Desktop workbench
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {title} is available on the full desktop site.
            </h1>
            <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{explanation}</p>
          </div>
          <Button asChild className="min-h-12 rounded-xl">
            <Link href={`/surface/workbench?next=${encodeURIComponent(requestedPath)}`}>
              Open Full Site
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader
            title="Useful companion alternatives"
            description="Keep moving with the jobs designed for the course or range."
          />
          <IOSGroupedList label="Companion alternatives">
            <IOSListRow icon={Target} label={fallbackLabel} href={fallbackRoute} />
            <IOSListRow icon={CalendarDays} label="Review latest session" href="/sessions" />
            <IOSListRow icon={Flag} label="Prepare for a round" href="/play" />
            <IOSListRow icon={Target} label="Open Quick Bag" href="/quick-bag" />
          </IOSGroupedList>
        </section>
      </MobileAppShell>
    </PageShell>
  );
}

function safeRequestedPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/today";
  return value;
}
