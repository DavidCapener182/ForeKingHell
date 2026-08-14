import Link from "next/link";
import { ArrowLeft, Link2 } from "lucide-react";

import type { SharedRoundData } from "@/app/share/[token]/page";
import {
  formatBoolean,
  formatDate,
  formatDateTime,
  formatNullableInteger,
  formatRatingSlope,
  integerFormatter,
} from "@/app/share/[token]/shared-round-format";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BRAND_NAME } from "@/lib/brand";
import { formatHandicapValue } from "@/lib/round-handicap";

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

export function SharedRoundWorkbench({ round, token }: { round: SharedRoundData; token: string }) {
  return (
    <PageShell className="ios-public-auth pb-[max(2rem,env(safe-area-inset-bottom))] lg:pb-8">
      <div className="grid gap-6" data-desktop-shared-round>
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
                  <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                    <TableRow>
                      <TableHead
                        data-column="hole"
                        className="sticky left-0 z-20 min-w-28 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
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
                          className="sticky left-0 z-10 min-w-28 bg-card font-medium shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
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

function SharedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/55 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
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
