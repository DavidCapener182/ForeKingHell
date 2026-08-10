import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { ArrowLeft, Link2 } from "lucide-react";

import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileStatusAction, MobileTopBar } from "@/components/mobile-sports";
import { Badge } from "@/components/ui/badge";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTableFrame, PageHeader, PageShell, StatusPill } from "@/components/premium";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db/client";
import { sessions, shareLinks, teeSets, users } from "@/db/schema";
import { BRAND_NAME } from "@/lib/brand";
import { calculateRoundDifferential, formatHandicapValue } from "@/lib/round-handicap";
import { hashShareToken } from "@/lib/share-links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared scorecard",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

type SharedScorecardHole = NonNullable<(typeof sessions.$inferSelect)["scorecardJson"]>[number];
type SharedRoundData = NonNullable<Awaited<ReturnType<typeof getSharedRound>>>;

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const sharedScorecardColumns = [
  { id: "hole", label: "Hole", locked: true },
  { id: "par", label: "Par" },
  { id: "yards", label: "Yards" },
  { id: "score", label: "Score" },
  { id: "putts", label: "Putts" },
  { id: "penalties", label: "Penalties" },
  { id: "fir", label: "FIR" },
  { id: "gir", label: "GIR" },
] satisfies DesktopWorkbenchColumn[];

export default async function SharedRoundPage({ params }: PageProps) {
  const { token } = await params;
  const round = await getSharedRound(token);

  if (!round) {
    notFound();
  }

  return (
    <PageShell className="ios-public-auth pb-[max(2rem,env(safe-area-inset-bottom))] lg:pb-8">
      <MobileSharedRound round={round} />
      <div className="hidden gap-6 lg:grid" data-desktop-shared-round>
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/login">
              <ArrowLeft className="size-4" />
              {BRAND_NAME}
            </Link>
          </Button>
          <Badge variant="secondary" className="gap-1.5 rounded-full">
            <Link2 className="size-3.5" />
            Private read-only link
          </Badge>
        </div>

        <PageHeader
          eyebrow={<StatusPill tone="green">Shared round</StatusPill>}
          title={round.session.courseName ?? round.link.title ?? "Shared scorecard"}
          description={`${formatDate(round.session.date)} by ${round.ownerName ?? `${BRAND_NAME} player`}`}
          metrics={[
            { label: "Score", value: formatNullableInteger(round.totalScore) },
            { label: "Par", value: formatNullableInteger(round.totalPar) },
            { label: "Putts", value: formatNullableInteger(round.totalPutts) },
            { label: "Diff", value: formatHandicapValue(round.handicapDifferential) },
          ]}
        />

        <section className="grid gap-4 lg:grid-cols-[0.7fr_0.3fr]">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Scorecard</CardTitle>
              <CardDescription>
                Hole-by-hole scoring from the shared round. Shot data and private account details
                are not exposed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DesktopTableWorkbenchControls
                viewKey="shared-scorecard"
                scope="shared-scorecard"
                currentViewLabel="Shared scorecard"
                resultLabel={`${round.holes.length} holes`}
                columns={sharedScorecardColumns}
                suggestedViews={sharedScorecardSuggestedViews(token)}
                exportTableId="shared-scorecard"
                exportFileName="forekinghell-shared-scorecard.csv"
                className="mb-3"
              />
              <DataTableFrame mainTable mainTableLabel="Shared scorecard table" stickyFirstColumn>
                <Table
                  id="shared-scorecard"
                  className="min-w-[720px]"
                  data-workbench-scope="shared-scorecard"
                  data-workbench-export-table="shared-scorecard"
                  aria-describedby="shared-scorecard-summary"
                >
                  <TableCaption id="shared-scorecard-summary" className="sr-only">
                    Shared round scorecard with hole, par, yards, score, putting, penalty, fairway
                    and green-in-regulation values.
                  </TableCaption>
                  <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                    <TableRow>
                      <TableHead
                        data-column="hole"
                        className="sticky left-0 z-20 min-w-28 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                      >
                        Hole
                      </TableHead>
                      <TableHead data-column="par" className="text-right">
                        Par
                      </TableHead>
                      <TableHead data-column="yards" className="text-right">
                        Yards
                      </TableHead>
                      <TableHead data-column="score" className="text-right">
                        Score
                      </TableHead>
                      <TableHead data-column="putts" className="text-right">
                        Putts
                      </TableHead>
                      <TableHead data-column="penalties" className="text-right">
                        Penalties
                      </TableHead>
                      <TableHead data-column="fir" className="text-right">
                        FIR
                      </TableHead>
                      <TableHead data-column="gir" className="text-right">
                        GIR
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {round.holes.map((hole) => (
                      <TableRow
                        key={hole.holeNumber}
                        tabIndex={0}
                        className="focus-aaa outline-none"
                      >
                        <TableCell
                          data-column="hole"
                          className="sticky left-0 z-10 min-w-28 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                        >
                          Hole {hole.holeNumber}
                        </TableCell>
                        <TableCell data-column="par" className="text-right">
                          {integerFormatter.format(hole.par)}
                        </TableCell>
                        <TableCell data-column="yards" className="text-right">
                          {hole.yards > 0 ? integerFormatter.format(hole.yards) : "--"}
                        </TableCell>
                        <TableCell data-column="score" className="text-right">
                          {formatNullableInteger(hole.score)}
                        </TableCell>
                        <TableCell data-column="putts" className="text-right">
                          {formatNullableInteger(hole.putts)}
                        </TableCell>
                        <TableCell data-column="penalties" className="text-right">
                          {formatNullableInteger(hole.penalties)}
                        </TableCell>
                        <TableCell data-column="fir" className="text-right">
                          {formatBoolean(hole.fairwayHit)}
                        </TableCell>
                        <TableCell data-column="gir" className="text-right">
                          {formatBoolean(hole.gir)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DataTableFrame>
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Round details</CardTitle>
              <CardDescription>This link can be revoked by the owner at any time.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <SharedMetric label="Tee" value={round.session.teeName ?? "--"} />
              <SharedMetric
                label="Rating / slope"
                value={formatRatingSlope(round.session.courseRating, round.session.slopeRating)}
              />
              <SharedMetric
                label="Status"
                value={round.session.roundStatus === "in_progress" ? "In progress" : "Complete"}
              />
              <SharedMetric label="Conditions" value={round.weather.conditions ?? "--"} />
              <SharedMetric label="Wind" value={round.weather.wind ?? "--"} />
              <SharedMetric label="Temperature" value={round.weather.temperature ?? "--"} />
              {round.session.equipmentNotes ? (
                <SharedMetric label="Equipment" value={round.session.equipmentNotes} />
              ) : null}
              <div className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
                {round.link.expiresAt
                  ? `Expires ${formatDateTime(round.link.expiresAt)}.`
                  : "This link has no expiry date."}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PageShell>
  );
}

function MobileSharedRound({ round }: { round: SharedRoundData }) {
  const frontNine = round.holes.slice(0, 9);
  const remainingHoles = round.holes.slice(9);
  const title = round.session.courseName ?? round.link.title ?? "Shared scorecard";

  return (
    <MobileAppShell className="ios-public-auth">
      <MobileTopBar
        title="Shared round"
        leading={
          <Button asChild variant="ghost" size="icon" className="focus-aaa size-11 rounded-full">
            <Link href="/login" aria-label={`Back to ${BRAND_NAME}`}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
        }
      />
      <MobileStatusAction
        label={round.session.roundStatus === "in_progress" ? "Round in progress" : "Final score"}
        value={formatNullableInteger(round.totalScore)}
        detail={`${title} · ${formatDate(round.session.date)} · ${round.ownerName ?? `${BRAND_NAME} player`}`}
        action={<IOSInlineStatus label="Private link" tone="info" />}
      />

      <section className="grid gap-2" aria-label="Shared round summary">
        <IOSSectionHeader title="Round summary" description="Read-only scorecard evidence" />
        <IOSGroupedList label="Shared round metrics">
          <IOSListRow
            label="Par"
            value={formatNullableInteger(round.totalPar)}
            detail="Recorded round par"
          />
          <IOSListRow
            label="Putts"
            value={formatNullableInteger(round.totalPutts)}
            detail="Total recorded putts"
          />
          <IOSListRow
            label="Handicap differential"
            value={formatHandicapValue(round.handicapDifferential)}
            detail="Estimate from the shared scorecard and tee data"
          />
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-label="Shared hole scores">
        <IOSSectionHeader
          title="Scorecard"
          description={`${round.holes.length} scored hole${round.holes.length === 1 ? "" : "s"}`}
        />
        <MobileSharedHoleRows holes={frontNine} />
        {remainingHoles.length > 0 ? (
          <IOSDisclosureGroup
            label="Remaining shared holes"
            items={[
              {
                value: "remaining-holes",
                title: "Back nine",
                summary: `${remainingHoles.length} holes`,
                description: "Hole-by-hole scoring detail",
                contentClassName: "px-0 pb-0 pt-0",
                content: <MobileSharedHoleRows holes={remainingHoles} />,
              },
            ]}
          />
        ) : null}
      </section>

      <IOSDisclosureGroup
        label="Shared round details"
        items={[
          {
            value: "round-details",
            title: "Round details",
            summary: round.session.teeName ?? "Tee not set",
            description: "Tee, conditions, equipment and link expiry",
            contentClassName: "px-0 pb-0 pt-0",
            content: (
              <IOSGroupedList label="Shared round detail rows" className="border-0">
                <IOSListRow label="Tee" value={round.session.teeName ?? "--"} />
                <IOSListRow
                  label="Rating / slope"
                  value={formatRatingSlope(round.session.courseRating, round.session.slopeRating)}
                />
                <IOSListRow label="Conditions" value={round.weather.conditions ?? "--"} />
                <IOSListRow label="Wind" value={round.weather.wind ?? "--"} />
                <IOSListRow label="Temperature" value={round.weather.temperature ?? "--"} />
                {round.session.equipmentNotes ? (
                  <IOSListRow label="Equipment" detail={round.session.equipmentNotes} />
                ) : null}
                <IOSListRow
                  label="Link access"
                  detail={
                    round.link.expiresAt
                      ? `Expires ${formatDateTime(round.link.expiresAt)}.`
                      : "This private link has no expiry date."
                  }
                  status={<IOSInlineStatus label="Read only" tone="info" />}
                />
              </IOSGroupedList>
            ),
          },
        ]}
      />

      <IOSGroupedList label="Shared link privacy">
        <IOSListRow
          icon={Link2}
          label="Only this scorecard is shared"
          detail="Shot data and private account details are not exposed. The owner can revoke this link."
          status={<IOSInlineStatus label="Private read-only link" tone="positive" />}
        />
      </IOSGroupedList>
    </MobileAppShell>
  );
}

function MobileSharedHoleRows({ holes }: { holes: SharedScorecardHole[] }) {
  return (
    <IOSGroupedList label="Shared scorecard hole rows">
      {holes.length > 0 ? (
        holes.map((hole) => (
          <IOSListRow
            key={hole.holeNumber}
            label={`Hole ${hole.holeNumber}`}
            value={formatNullableInteger(hole.score)}
            detail={`Par ${integerFormatter.format(hole.par)} · ${
              hole.yards > 0 ? `${integerFormatter.format(hole.yards)} yd` : "yards not set"
            } · ${formatNullableInteger(hole.putts)} putts`}
            status={
              <IOSInlineStatus
                label={`FIR ${formatBoolean(hole.fairwayHit)} · GIR ${formatBoolean(hole.gir)} · ${formatNullableInteger(hole.penalties)} penalties`}
                tone="neutral"
              />
            }
          />
        ))
      ) : (
        <IOSListRow label="No scored holes" detail="The shared round has no scorecard rows." />
      )}
    </IOSGroupedList>
  );
}

function sharedScorecardSuggestedViews(token: string): DesktopSavedViewSuggestion[] {
  const baseHref = `/share/${encodeURIComponent(token)}`;

  return [
    {
      title: "Scorecard",
      href: `${baseHref}#shared-scorecard`,
      detail: "Hole, par, score and scoring proof.",
    },
    {
      title: "Putting review",
      href: `${baseHref}#shared-scorecard`,
      detail: "Keep putts visible for the shared round.",
    },
    {
      title: "FIR / GIR check",
      href: `${baseHref}#shared-scorecard`,
      detail: "Review fairway and green-in-regulation calls.",
    },
  ];
}

async function getSharedRound(token: string) {
  const db = getDb();
  const now = new Date();
  const tokenHash = hashShareToken(token);
  const [link] = await db
    .select({
      id: shareLinks.id,
      userId: shareLinks.userId,
      resourceId: shareLinks.resourceId,
      title: shareLinks.title,
      expiresAt: shareLinks.expiresAt,
    })
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.tokenHash, tokenHash),
        eq(shareLinks.resourceType, "round"),
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!link) {
    return null;
  }

  const [session] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      type: sessions.type,
      date: sessions.date,
      courseName: sessions.courseName,
      roundStatus: sessions.roundStatus,
      weatherJson: sessions.weatherJson,
      equipmentNotes: sessions.equipmentNotes,
      scorecardJson: sessions.scorecardJson,
      teeName: teeSets.name,
      courseRating: teeSets.courseRating,
      slopeRating: teeSets.slopeRating,
      ownerName: users.name,
    })
    .from(sessions)
    .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, link.resourceId), eq(sessions.userId, link.userId)))
    .limit(1);

  if (!session) {
    return null;
  }

  const holes = session.scorecardJson ?? [];
  const totalScore = sumNullable(holes.map((hole) => hole.score ?? null));
  const totalPar = holes.length > 0 ? holes.reduce((total, hole) => total + hole.par, 0) : null;
  const totalPutts = sumNullable(holes.map((hole) => hole.putts ?? null));
  const handicapDifferential = calculateRoundDifferential({
    totalScore,
    totalPar,
    courseRating: session.courseRating,
    slopeRating: session.slopeRating,
    holesPlayed: holes.length,
  });

  return {
    link,
    session,
    ownerName: session.ownerName,
    weather: normalizeWeather(session.weatherJson),
    holes,
    totalScore,
    totalPar,
    totalPutts,
    handicapDifferential,
  };
}

function SharedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white/80 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function normalizeWeather(value: unknown) {
  if (!value || typeof value !== "object") {
    return { conditions: null, wind: null, temperature: null };
  }

  const weather = value as {
    conditions?: unknown;
    wind?: unknown;
    temperature?: unknown;
  };

  return {
    conditions: typeof weather.conditions === "string" ? weather.conditions : null,
    wind: typeof weather.wind === "string" ? weather.wind : null,
    temperature: typeof weather.temperature === "string" ? weather.temperature : null,
  };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatNullableInteger(value: number | null | undefined) {
  return typeof value === "number" ? integerFormatter.format(value) : "--";
}

function formatRatingSlope(rating: number | null, slope: number | null) {
  if (typeof rating !== "number" || typeof slope !== "number") {
    return "--";
  }

  return `${numberFormatter.format(rating)} / ${integerFormatter.format(slope)}`;
}

function formatBoolean(value: SharedScorecardHole["fairwayHit"] | SharedScorecardHole["gir"]) {
  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  return "--";
}
