import { getImportFileHistory } from "@/lib/import-file-history";
import type { ImportHistoryParams } from "@/lib/import-history-query";
import { ImportFileLibrary } from "@/app/import/import-file-library";
import Link from "next/link";
import { UntitledPageHeader } from "@/components/untitled-ui/headers";
import { ImportSourceChooser } from "@/app/import/import-source-chooser";
import { desc, eq } from "drizzle-orm";
import { ChevronRight, FileClock, PenLine, PlugZap, Settings2 } from "lucide-react";

import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
import { CompanionSyncStatus } from "@/components/app/companion-sync-status";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { StatusTimeline } from "@/components/app/status-timeline";
import { MobileAppShell } from "@/components/app/mobile-app-shell";
import { PageShell } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { getImportPracticeContext } from "@/lib/import-practice-context";
import { isRoundSessionType } from "@/lib/round-sessions";
import { companionReviewRoute } from "@/lib/session-review-route";

type ImportSearchParams = Promise<ImportHistoryParams> | undefined;

export default async function ImportCompanionPage({
  searchParams,
}: {
  searchParams?: ImportSearchParams;
}) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;
  const validPlan = await getImportPracticeContext(userId, params?.practicePlanId);

  const [status, recent, history] = await Promise.all([
    getRapsodoConnectionStatusAction(),
    getDb()
      .select({
        id: sessions.id,
        type: sessions.type,
        source: sessions.source,
        date: sessions.date,
        fileName: sessions.fileName,
        courseName: sessions.courseName,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.date))
      .limit(3),
    getImportFileHistory(userId, params),
  ]);
  const connected = status.ok && status.data.connected;
  const planQuery = validPlan ? `?practicePlanId=${encodeURIComponent(validPlan.id)}` : "";
  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-import-companion-home>
        <UntitledPageHeader
          title="Import"
          description="Choose a source and review your session before saving."
        />
        <CompanionSyncStatus accountId={userId} />

        <section className="grid gap-2.5">
          <div className="px-1">
            <h2 className="text-sm font-semibold">Import a session</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {validPlan ? `Evidence for ${validPlan.title}` : "Choose one measured source"}
            </p>
          </div>
          <ImportSourceChooser connected={connected} companion />
          <details className="rounded-2xl bg-card p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
              R-Cloud connection · {connected ? "Connected" : "Not connected"}
            </summary>
            <Alert>
              <PlugZap aria-hidden />
              <AlertTitle>
                Connection status · R-Cloud {connected ? "connected" : "is not connected"}
              </AlertTitle>
              <AlertDescription className="grid gap-2">
                <span>
                  {connected
                    ? "Recent provider sessions can be checked without uploading another file."
                    : "Connect R-Cloud, or continue with a CSV without changing your provider settings."}
                </span>
                <Button asChild size="sm" variant="outline" className="w-fit">
                  <Link href={`/rapsodo${planQuery}`}>
                    {connected ? "Review connection" : "Connect R-Cloud"}
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          </details>
        </section>

        <Card size="sm" data-import-other-actions>
          <CardHeader>
            <CardTitle>Other import actions</CardTitle>
            <CardDescription>Round entry, history and storage preferences.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <ImportActionItem
              icon={PenLine}
              title="Add a manual round"
              description="Enter a scored round without an upload."
              href="/rounds/new"
            />
            {history.activeCount > 0 ? (
              <ImportActionItem
                icon={FileClock}
                title="Import history"
                description={`${history.activeCount} active imported files`}
                href="#import-library"
              />
            ) : null}
            <ImportActionItem
              icon={Settings2}
              title="Local import storage"
              description="Choose whether this phone may queue uploads offline."
              href="/settings?section=offline#offline-storage"
            />
          </CardContent>
        </Card>

        {recent.length > 0 ? (
          <section id="recent-imports" className="grid gap-2.5 scroll-mt-20">
            <h2 className="px-1 text-sm font-semibold">Recent saved sessions</h2>
            <p className="px-1 text-sm text-muted-foreground">
              Your latest three saved sessions, including manual rounds. Open a session to review
              its recorded result.
            </p>
            <Card size="sm">
              <CardContent>
                <StatusTimeline
                  label="Recent import timeline"
                  items={recent.map((session) => ({
                    id: session.id,
                    title: session.courseName ?? session.fileName ?? "Measured session",
                    timestamp: formatRecentImportDate(session.date),
                    description: isRoundSessionType(session.type)
                      ? `${session.source} · Saved round evidence`
                      : `${session.source} · Saved practice evidence`,
                    status: isRoundSessionType(session.type) ? "Round" : "Practice",
                    kind: isRoundSessionType(session.type) ? "round" : "import",
                    href: companionReviewRoute(session),
                  }))}
                />
              </CardContent>
            </Card>
          </section>
        ) : (
          <AppEmptyState
            title="No recent imports"
            description="Choose R-Cloud or a CSV above to add your first measured session."
            primaryAction={
              <Button asChild size="sm">
                <Link
                  href={`/import?source=csv${validPlan ? `&practicePlanId=${encodeURIComponent(validPlan.id)}` : ""}`}
                >
                  Choose CSV
                </Link>
              </Button>
            }
          />
        )}
        <section id="import-library" className="min-w-0 scroll-mt-20">
          <ImportFileLibrary history={history} params={params} />
        </section>
      </MobileAppShell>
    </PageShell>
  );
}

function ImportActionItem({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: typeof PenLine;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="focus-aaa rounded-xl outline-none">
      <Item variant="outline" size="sm">
        <ItemMedia>
          <Icon className="size-4 text-primary" aria-hidden />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription className="whitespace-normal">{description}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </ItemActions>
      </Item>
    </Link>
  );
}

function formatRecentImportDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
