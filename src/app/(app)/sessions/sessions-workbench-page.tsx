import Link from "next/link";
import { CalendarDays, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import { SessionTimeline } from "@/app/sessions/session-timeline";
import { getRecentSessionHistory } from "@/lib/session-history";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const userId = await requireCurrentUserId();
  const rows = await getRecentSessionHistory(userId);

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="green">Review history</StatusPill>}
        title="Sessions"
        description="Open practice and round evidence in one chronological history, then continue into the relevant review."
        actions={
          <Button asChild className="premium-action min-h-11 rounded-xl">
            <Link href="/import">
              <Upload className="size-4" aria-hidden />
              Import session
            </Link>
          </Button>
        }
      />

      {rows.length > 0 ? (
        <SessionTimeline sessions={rows} accountId={userId} />
      ) : (
        <Card className="premium-card">
          <CardContent className="grid place-items-center gap-3 py-12 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
              <CalendarDays className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold">No sessions yet</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Import launch-monitor data or add a round to create your review history.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="min-h-11 rounded-xl">
                <Link href="/import">Import data</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11 rounded-xl">
                <Link href="/rounds/new">Add round</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
