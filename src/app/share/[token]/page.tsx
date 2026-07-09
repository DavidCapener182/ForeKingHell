import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { ArrowLeft, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataPair,
  DataTableFrame,
  MobileDataCard,
  MobileDataList,
  PageHeader,
  PageShell,
  StatusPill,
} from "@/components/premium";
import { MobileMetricStrip } from "@/components/visuals/mobile-metric-strip";
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

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

type SharedScorecardHole = NonNullable<(typeof sessions.$inferSelect)["scorecardJson"]>[number];

const integerFormatter = new Intl.NumberFormat("en-GB");
const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export default async function SharedRoundPage({ params }: PageProps) {
  const { token } = await params;
  const round = await getSharedRound(token);

  if (!round) {
    notFound();
  }

  return (
    <PageShell size="6xl">
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

      <MobileMetricStrip
        items={[
          {
            label: "Score",
            value: formatNullableInteger(round.totalScore),
            detail: "Gross",
            tone: "green",
          },
          {
            label: "Par",
            value: formatNullableInteger(round.totalPar),
            detail: "Round par",
            tone: "sky",
          },
          {
            label: "Putts",
            value: formatNullableInteger(round.totalPutts),
            detail: "Total",
            tone: "amber",
          },
          {
            label: "Diff",
            value: formatHandicapValue(round.handicapDifferential),
            detail: "Estimate",
            tone: "slate",
          },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[0.7fr_0.3fr]">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Scorecard</CardTitle>
            <CardDescription>
              Hole-by-hole scoring from the shared round. Shot data and private account details are
              not exposed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTableFrame
              mobile={
                <MobileDataList>
                  {round.holes.map((hole) => (
                    <MobileDataCard
                      key={hole.holeNumber}
                      title={`Hole ${hole.holeNumber}`}
                      subtitle={`Par ${hole.par} · ${hole.yards > 0 ? `${integerFormatter.format(hole.yards)} yd` : "Yards not set"}`}
                      action={<Badge variant="outline">{formatNullableInteger(hole.score)}</Badge>}
                    >
                      <DataPair label="Putts" value={formatNullableInteger(hole.putts)} />
                      <DataPair label="Penalties" value={formatNullableInteger(hole.penalties)} />
                      <DataPair label="FIR" value={formatBoolean(hole.fairwayHit)} />
                      <DataPair label="GIR" value={formatBoolean(hole.gir)} />
                    </MobileDataCard>
                  ))}
                </MobileDataList>
              }
              label="Shared scorecard table"
              stickyFirstColumn
            >
              <Table
                className="min-w-[720px]"
                data-workbench-scope="shared-scorecard"
                aria-describedby="shared-scorecard-summary"
              >
                <TableCaption id="shared-scorecard-summary" className="sr-only">
                  Shared round scorecard with hole, par, yards, score, putting, penalty, fairway and
                  green-in-regulation values.
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
                    <TableRow key={hole.holeNumber} tabIndex={0} className="focus-aaa outline-none">
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
    </PageShell>
  );
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
