import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ChevronRight, Cloud, FileClock, FileUp, PenLine, PlugZap, Settings2 } from "lucide-react";

import { getRapsodoConnectionStatusAction } from "@/app/rapsodo/actions";
import { CompanionSyncStatus } from "@/components/app/companion-sync-status";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { StatusTimeline } from "@/components/app/status-timeline";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { getSavedPracticePlan } from "@/lib/practice-planner";
import { companionReviewRoute } from "@/lib/session-review-route";

type ImportSearchParams = Promise<{ practicePlanId?: string }> | undefined;

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
          <div className="px-1">
            <h2 className="text-sm font-semibold">Import a session</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {validPlan ? `Evidence for ${validPlan.title}` : "Choose one measured source"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card size="sm">
              <CardHeader>
                <Cloud className="size-5 text-primary" aria-hidden />
                <CardTitle>Rapsodo R-Cloud</CardTitle>
                <CardDescription>
                  {connected
                    ? "Recent unimported sessions are ready to load."
                    : "Connect and import your newest measured session."}
                </CardDescription>
                <CardAction>
                  <Badge variant={connected ? "default" : "outline"}>
                    {connected ? "Connected" : "Connect"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={`/rapsodo${planQuery}`}>Open R-Cloud</Link>
                </Button>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <FileUp className="size-5 text-primary" aria-hidden />
                <CardTitle>Choose CSV from Files</CardTitle>
                <CardDescription>
                  Pick one range export, confirm the summary, then save.
                </CardDescription>
                <CardAction>
                  <Badge variant="secondary">Fast import</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={`/import${csvQuery}`}>Choose CSV</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
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
            {recent.length > 0 ? (
              <ImportActionItem
                icon={FileClock}
                title="Import history"
                description={`${recent.length} recent imports`}
                href="#recent-imports"
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
            <h2 className="px-1 text-sm font-semibold">Recent imports</h2>
            <Card size="sm">
              <CardContent>
                <StatusTimeline
                  label="Recent import timeline"
                  items={recent.map((session) => ({
                    id: session.id,
                    title: session.courseName ?? session.fileName ?? "Measured session",
                    timestamp: formatRecentImportDate(session.date),
                    description:
                      session.type === "round"
                        ? "Round evidence imported"
                        : "Practice evidence imported",
                    status: session.type === "round" ? "Round" : "Practice",
                    kind: session.type === "round" ? "round" : "import",
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
                <Link href={`/import${csvQuery}`}>Choose CSV</Link>
              </Button>
            }
          />
        )}
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
