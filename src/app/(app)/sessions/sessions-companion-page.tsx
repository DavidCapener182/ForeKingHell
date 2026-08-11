import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { SessionsCompanionList } from "@/app/sessions/sessions-companion-list";
import { CompanionImageHero } from "@/components/app/companion-image-hero";
import { MobileAppShell } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { requireCurrentUserId } from "@/lib/current-user";
import { getRecentSessionHistory } from "@/lib/session-history";

export default async function SessionsCompanionPage() {
  const userId = await requireCurrentUserId();
  const sessions = await getRecentSessionHistory(userId, 24);

  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-sessions-companion>
        <CompanionImageHero
          variant="sessions"
          title="Sessions"
          label="Recent golf"
          alt="A golfer marking a scorecard with the course and green ahead"
        />
        {sessions.length > 0 ? (
          <SessionsCompanionList sessions={sessions} accountId={userId} />
        ) : (
          <section className="ios-grouped-list grid place-items-center gap-3 p-8 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
              <CalendarDays className="size-6" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold">No sessions yet</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Import measured data or add a round to create your review history.
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              <Button asChild className="min-h-11 rounded-xl">
                <Link href="/import">Import data</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11 rounded-xl">
                <Link href="/rounds/new">Add round</Link>
              </Button>
            </div>
          </section>
        )}
      </MobileAppShell>
    </PageShell>
  );
}
