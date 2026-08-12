import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Cloud, FileClock, FileUp, PenLine, PlugZap } from "lucide-react";

import { CompanionRangeImport } from "@/app/import/companion-range-import";
import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
import { CompanionSyncStatus } from "@/components/app/companion-sync-status";
import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { getSavedPracticePlan } from "@/lib/practice-planner";
import { companionReviewRoute } from "@/lib/session-review-route";

type ImportSearchParams = Promise<{ source?: string; practicePlanId?: string }> | undefined;

export default async function ImportCompanionPage({
  searchParams,
}: {
  searchParams?: ImportSearchParams;
}) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;
  const practicePlan = params?.practicePlanId
    ? await getSavedPracticePlan(userId, params.practicePlanId)
    : null;
  const validPlan =
    practicePlan &&
    ["planned", "active", "awaiting_import", "match_found"].includes(practicePlan.status) &&
    !practicePlan.sourceSessionId
      ? practicePlan
      : null;

  if (params?.source === "csv") {
    return (
      <PageShell>
        <MobileAppShell
          className="gap-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
          data-import-companion-csv
        >
          <MobileTopBar title="CSV import" />
          {validPlan ? (
            <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              This upload will be scored against {validPlan.title}.
            </p>
          ) : null}
          <CompanionRangeImport practicePlanId={validPlan?.id ?? null} />
          <CompanionSyncStatus accountId={userId} />
        </MobileAppShell>
      </PageShell>
    );
  }

  const [status, recent] = await Promise.all([
    getRapsodoConnectionStatusAction(),
    getDb()
      .select({
        id: sessions.id,
        type: sessions.type,
        date: sessions.date,
        fileName: sessions.fileName,
        courseName: sessions.courseName,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.date))
      .limit(3),
  ]);
  const connected = status.ok && status.data.connected;
  const planQuery = validPlan ? `?practicePlanId=${encodeURIComponent(validPlan.id)}` : "";
  const csvQuery = validPlan
    ? `?source=csv&practicePlanId=${encodeURIComponent(validPlan.id)}`
    : "?source=csv";

  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-import-companion-home>
        <MobileTopBar title="Import & Sync" />
        <CompanionSyncStatus accountId={userId} />

        <section className="grid gap-2.5">
          <IOSSectionHeader
            title="Import a session"
            description={
              validPlan ? `Evidence for ${validPlan.title}` : "Choose one measured source"
            }
          />
          <IOSGroupedList label="Import a session">
            <IOSListRow
              icon={Cloud}
              label="Rapsodo R-Cloud"
              detail={
                connected
                  ? "Recent unimported sessions are ready to load."
                  : "Connect and import your newest measured session."
              }
              href={`/rapsodo${planQuery}`}
              status={
                <IOSInlineStatus
                  label={connected ? "Connected" : "Connect"}
                  tone={connected ? "positive" : "attention"}
                />
              }
            />
            <IOSListRow
              icon={FileUp}
              label="Choose CSV from Files"
              detail="Pick one range export, confirm the summary, then save."
              href={`/import${csvQuery}`}
              status={<IOSInlineStatus label="Fast import" tone="info" />}
            />
          </IOSGroupedList>
        </section>

        <section className="grid gap-2.5">
          <IOSSectionHeader title="Other" />
          <IOSGroupedList label="Other import actions">
            <IOSListRow icon={PenLine} label="Add a manual round" href="/rounds/new" />
            <IOSListRow
              icon={PlugZap}
              label="Connection status"
              value={connected ? "Connected" : "Not connected"}
              href={`/rapsodo${planQuery}`}
            />
            <IOSListRow
              icon={FileClock}
              label="Import history"
              detail={`${recent.length} recent imports`}
              href="#recent-imports"
            />
          </IOSGroupedList>
        </section>

        {recent.length > 0 ? (
          <section id="recent-imports" className="grid gap-2.5 scroll-mt-20">
            <IOSSectionHeader title="Recent imports" />
            <IOSGroupedList label="Recent imports">
              {recent.map((session) => (
                <IOSListRow
                  key={session.id}
                  label={session.courseName ?? session.fileName ?? "Measured session"}
                  detail={new Intl.DateTimeFormat("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }).format(session.date)}
                  href={companionReviewRoute(session)}
                />
              ))}
            </IOSGroupedList>
          </section>
        ) : null}

        <Link
          href="/settings#offline-storage"
          className="focus-aaa px-1 text-xs text-muted-foreground underline underline-offset-4"
        >
          Local import storage settings
        </Link>
      </MobileAppShell>
    </PageShell>
  );
}
