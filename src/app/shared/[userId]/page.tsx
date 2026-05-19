import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { ArrowLeft, Database, Flag, Target, Trophy } from "lucide-react";

import {
  DataPair,
  DataPanel,
  DataTableFrame,
  MetricCard,
  MobileBentoSummary,
  MobileDataCard,
  MobileDataList,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
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

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export default async function SharedAccountPage({ params }: PageProps) {
  const { userId } = await params;
  const data = await getSharedAccountData(userId);

  if (!data) {
    notFound();
  }

  return (
    <PageShell>
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
        title={data.profile.name ?? data.profile.email ?? "ForeKingHell player"}
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

      <MobileBentoSummary
        items={[
          {
            label: "Best recent",
            value: data.longestDriveYd ? `${numberFormatter.format(data.longestDriveYd)} yd` : "--",
            detail: "Longest driver total",
            tone: "amber",
          },
          {
            label: "Top club",
            value: data.topClub?.clubType ?? "--",
            detail: data.topClub
              ? `${integerFormatter.format(data.topClub.count)} shots`
              : "No shots yet",
            tone: "green",
          },
          {
            label: "Recent rounds",
            value: integerFormatter.format(data.recentRounds.length),
            detail: "Shared sessions",
            tone: "sky",
          },
          {
            label: "30 day shots",
            value: integerFormatter.format(data.recentShotCount),
            detail: "Practice volume",
            tone: "slate",
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

      <DataPanel>
        <SectionHeader
          title="Recent sessions"
          description="A quick read-only view of the shared player's latest activity."
          action={<Database className="size-5 text-sky-600" />}
        />
        <CardContent>
          <DataTableFrame
            mobile={
              <MobileDataList>
                {data.recentRounds.map((round) => (
                  <MobileDataCard
                    key={round.id}
                    title={round.courseName ?? round.fileName ?? "Shared session"}
                    subtitle={`${formatDate(round.date)} · ${round.type}`}
                    action={<Badge variant="outline">{round.totalScore ?? "--"}</Badge>}
                  >
                    <DataPair label="Holes" value={round.holesPlayed} />
                    <DataPair label="Score" value={round.totalScore ?? "--"} />
                  </MobileDataCard>
                ))}
              </MobileDataList>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Course / file</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Holes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentRounds.map((round) => (
                  <TableRow key={round.id}>
                    <TableCell>{formatDate(round.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{round.type}</Badge>
                    </TableCell>
                    <TableCell>{round.courseName ?? round.fileName ?? "--"}</TableCell>
                    <TableCell className="text-right">{round.totalScore ?? "--"}</TableCell>
                    <TableCell className="text-right">{round.holesPlayed}</TableCell>
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
    </PageShell>
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
