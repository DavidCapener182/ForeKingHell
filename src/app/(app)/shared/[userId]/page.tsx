import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { ArrowLeft, Database, Flag, Target, Trophy } from "lucide-react";

import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileStatusAction, MobileTopBar } from "@/components/mobile-sports";
import {
  DataPanel,
  DataTableFrame,
  MetricCard,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clubs, sessions, shots, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireReadableAccountUserId } from "@/lib/account-access";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ userId: string }>;
};
type SharedAccountData = NonNullable<Awaited<ReturnType<typeof getSharedAccountData>>>;

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

const sharedSessionColumns: DesktopWorkbenchColumn[] = [
  { id: "date", label: "Date", locked: true },
  { id: "type", label: "Type" },
  { id: "session", label: "Course / file", locked: true },
  { id: "score", label: "Score" },
  { id: "holes", label: "Holes" },
];

const sharedSessionSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Recent scorecards",
    href: "#shared-session-ledger",
    detail: "Review shared rounds with score and hole evidence.",
  },
  {
    title: "Coach read-only check",
    href: "#shared-session-ledger",
    detail: "Use visible sessions without changing the owner's account.",
  },
];

export default async function SharedAccountPage({ params }: PageProps) {
  const { userId } = await params;
  const data = await getSharedAccountData(userId);

  if (!data) {
    notFound();
  }

  return (
    <PageShell>
      <MobileSharedAccount data={data} />
      <DesktopWorkbenchLayout scope="shared-account" className="hidden lg:grid">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/settings" prefetch={false}>
              <ArrowLeft className="size-4" />
              Settings
            </Link>
          </Button>
          <Badge variant="secondary">{data.accessRole} access</Badge>
        </div>

        <PageHeader
          eyebrow={<StatusPill tone="sky">Shared account</StatusPill>}
          title={data.profile.name ?? data.profile.email ?? "LM World Tour player"}
          description="Read-only account overview for coach, viewer, and editor roles. Mutations still require owner/editor-scoped actions."
          metrics={[
            {
              label: "Sessions",
              value: integerFormatter.format(data.sessionCount),
              detail: "Imported and manual rounds.",
            },
            {
              label: "Shots",
              value: integerFormatter.format(data.shotCount),
              detail: "Launch-monitor records.",
            },
            {
              label: "Active clubs",
              value: integerFormatter.format(data.activeClubCount),
              detail: "Current bag entries.",
            },
            {
              label: "30 day shots",
              value: integerFormatter.format(data.recentShotCount),
              detail: "Recent practice volume.",
            },
          ]}
        />

        <section className="hidden gap-4 sm:grid md:grid-cols-3">
          <MetricCard
            label="Longest drive"
            value={data.longestDriveYd ? `${numberFormatter.format(data.longestDriveYd)} yd` : "--"}
            detail="Best driver total distance in the visible account."
            icon={Trophy}
            tone="amber"
          />
          <MetricCard
            label="Most used club"
            value={data.topClub?.clubType ?? "--"}
            detail={
              data.topClub
                ? `${integerFormatter.format(data.topClub.count)} shots recorded.`
                : "No shots yet."
            }
            icon={Target}
            tone="green"
          />
          <MetricCard
            label="Recent rounds"
            value={integerFormatter.format(data.recentRounds.length)}
            detail="Latest scorecard sessions available to this role."
            icon={Flag}
            tone="sky"
          />
        </section>

        <section id="shared-session-ledger" data-workbench-scope="shared-sessions">
          <DataPanel>
            <SectionHeader
              title="Recent sessions"
              description="A quick read-only view of the shared player's latest activity."
              action={<Database className="size-5 text-sky-600" />}
            />
            <CardContent>
              <DesktopTableWorkbenchControls
                viewKey={`shared-sessions-${userId}`}
                scope="shared-sessions"
                currentViewLabel={`${data.accessRole} shared sessions`}
                resultLabel={`${integerFormatter.format(data.recentRounds.length)} sessions`}
                columns={sharedSessionColumns}
                suggestedViews={sharedSessionSuggestedViews}
                exportTableId="shared-sessions"
                exportFileName="forekinghell-shared-sessions.csv"
                className="mb-3"
              />
              <DataTableFrame
                mainTable
                mainTableLabel="Shared account recent sessions table"
                stickyFirstColumn
              >
                <Table
                  data-workbench-export-table="shared-sessions"
                  aria-describedby="shared-sessions-table-summary"
                >
                  <TableCaption id="shared-sessions-table-summary" className="sr-only">
                    Shared account recent sessions with date, type, course or file, score and holes
                    played. The table is read-only for coach, viewer and editor roles.
                  </TableCaption>
                  <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                    <TableRow>
                      <TableHead
                        data-column="date"
                        className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        Date
                      </TableHead>
                      <TableHead data-column="type">Type</TableHead>
                      <TableHead data-column="session">Course / file</TableHead>
                      <TableHead data-column="score" className="text-right">
                        Score
                      </TableHead>
                      <TableHead data-column="holes" className="text-right">
                        Holes
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentRounds.map((round) => (
                      <TableRow key={round.id} tabIndex={0} className="focus-aaa outline-none">
                        <TableCell
                          data-column="date"
                          className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                        >
                          {formatDate(round.date)}
                        </TableCell>
                        <TableCell data-column="type">
                          <Badge variant="outline">{round.type}</Badge>
                        </TableCell>
                        <TableCell data-column="session">
                          {round.courseName ?? round.fileName ?? "--"}
                        </TableCell>
                        <TableCell data-column="score" className="text-right">
                          {round.totalScore ?? "--"}
                        </TableCell>
                        <TableCell data-column="holes" className="text-right">
                          {round.holesPlayed}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.recentRounds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No shared sessions yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </DataTableFrame>
            </CardContent>
          </DataPanel>
        </section>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function MobileSharedAccount({ data }: { data: SharedAccountData }) {
  const primaryRounds = data.recentRounds.slice(0, 8);
  const olderRounds = data.recentRounds.slice(8);
  const profileName = data.profile.name ?? data.profile.email ?? "ForeKingHell player";

  return (
    <MobileAppShell>
      <MobileTopBar title="Shared account" />
      <MobileStatusAction
        label={`${data.accessRole} access`}
        value={profileName}
        detail={`${integerFormatter.format(data.sessionCount)} sessions · ${integerFormatter.format(data.shotCount)} measured shots`}
        action={<IOSInlineStatus label="Read only" tone="info" />}
      />

      <section className="grid gap-2" aria-label="Shared player summary">
        <IOSSectionHeader title="Player summary" description="Visible account evidence" />
        <IOSGroupedList label="Shared player metrics">
          <IOSListRow
            icon={Trophy}
            label="Longest driver total"
            value={
              data.longestDriveYd ? `${numberFormatter.format(data.longestDriveYd)} yd` : "No data"
            }
            detail="Best visible driver total distance."
          />
          <IOSListRow
            icon={Target}
            label="Most-used club"
            value={data.topClub?.clubType ?? "No data"}
            detail={
              data.topClub
                ? `${integerFormatter.format(data.topClub.count)} measured shots`
                : "No visible club evidence yet."
            }
          />
          <IOSListRow
            icon={Flag}
            label="30-day practice volume"
            value={integerFormatter.format(data.recentShotCount)}
            detail={`${integerFormatter.format(data.activeClubCount)} active clubs visible`}
          />
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-label="Shared recent sessions">
        <IOSSectionHeader
          title="Recent sessions"
          description={`${data.recentRounds.length} shared session${data.recentRounds.length === 1 ? "" : "s"}`}
        />
        <MobileSharedSessionRows rounds={primaryRounds} />
        {olderRounds.length > 0 ? (
          <IOSDisclosureGroup
            label="Older shared sessions"
            items={[
              {
                value: "older-shared-sessions",
                title: "Older sessions",
                summary: olderRounds.length,
                description: "Earlier rows in the shared account",
                contentClassName: "px-0 pb-0 pt-0",
                content: <MobileSharedSessionRows rounds={olderRounds} />,
              },
            ]}
          />
        ) : null}
      </section>

      <IOSDisclosureGroup
        label="Shared access explanation"
        items={[
          {
            value: "shared-access",
            title: "Access and privacy",
            summary: data.accessRole,
            description: "What this shared view permits",
            contentClassName: "px-0 pb-0 pt-0",
            content: (
              <IOSGroupedList label="Shared access detail" className="border-0">
                <IOSListRow
                  label="Visible data"
                  detail="Sessions, measured-shot totals and bag summary are scoped to the access granted by the account owner."
                />
                <IOSListRow
                  label="Changes"
                  detail="This overview does not expose mutation controls. Owner or editor checks still apply to any separate action."
                  status={<IOSInlineStatus label="Read only here" tone="info" />}
                />
              </IOSGroupedList>
            ),
          },
        ]}
      />
    </MobileAppShell>
  );
}

function MobileSharedSessionRows({ rounds }: { rounds: SharedAccountData["recentRounds"] }) {
  return (
    <IOSGroupedList label="Shared recent session rows">
      {rounds.length > 0 ? (
        rounds.map((round) => (
          <IOSListRow
            key={round.id}
            icon={Flag}
            label={round.courseName ?? round.fileName ?? "Shared session"}
            value={round.totalScore ?? "--"}
            detail={`${formatDate(round.date)} · ${round.type} · ${round.holesPlayed} scored holes`}
            status={<IOSInlineStatus label="Shared evidence" tone="neutral" />}
          />
        ))
      ) : (
        <IOSListRow
          label="No shared sessions"
          detail="The account owner has not shared a visible session yet."
        />
      )}
    </IOSGroupedList>
  );
}

async function getSharedAccountData(targetUserId: string) {
  const access = await requireReadableAccountUserId(targetUserId);
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [profileRows, sessionRows, shotRows, recentShotRows, clubRows] = await Promise.all([
    db.select().from(users).where(eq(users.id, targetUserId)).limit(1),
    db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, targetUserId))
      .orderBy(desc(sessions.date)),
    db
      .select({
        clubType: shots.clubType,
        totalYd: shots.totalYd,
      })
      .from(shots)
      .where(eq(shots.userId, targetUserId)),
    db
      .select({ id: shots.id })
      .from(shots)
      .where(and(eq(shots.userId, targetUserId), gte(shots.shotAt, thirtyDaysAgo))),
    db.select().from(clubs).where(eq(clubs.userId, targetUserId)),
  ]);
  const profile = profileRows[0];

  if (!profile) {
    return null;
  }

  const clubCounts = countBy(shotRows.map((shot) => shot.clubType));
  const topClub =
    [...clubCounts.entries()]
      .map(([clubType, count]) => ({ clubType, count }))
      .sort((a, b) => b.count - a.count)[0] ?? null;
  const longestDriveYd =
    shotRows
      .filter((shot) => shot.clubType === "driver" && typeof shot.totalYd === "number")
      .reduce<number | null>((best, shot) => Math.max(best ?? 0, shot.totalYd ?? 0), null) ?? null;

  return {
    profile,
    accessRole: access.role,
    sessionCount: sessionRows.length,
    shotCount: shotRows.length,
    recentShotCount: recentShotRows.length,
    activeClubCount: clubRows.filter((club) => club.active).length,
    topClub,
    longestDriveYd,
    recentRounds: sessionRows.slice(0, 20).map((session) => {
      const scorecard = session.scorecardJson ?? [];
      return {
        id: session.id,
        date: session.date,
        type: session.type,
        courseName: session.courseName,
        fileName: session.fileName,
        holesPlayed: scorecard.length,
        totalScore: scorecardTotal(scorecard),
      };
    }),
  };
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function scorecardTotal(scorecard: NonNullable<(typeof sessions.$inferSelect)["scorecardJson"]>) {
  const scores = scorecard
    .map((hole) => hole.score)
    .filter((score): score is number => typeof score === "number");
  return scores.length > 0 ? scores.reduce((total, score) => total + score, 0) : null;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}
