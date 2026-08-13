import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  GitCompareArrows,
  SlidersHorizontal,
  Target,
  Users,
} from "lucide-react";

import { ClubDispersionPlot, CompareRadarChart } from "@/app/compare/club-compare-client";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { BottomSheet, MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ClubCompareData,
  ClubCompareSide,
  CompareDelta,
  PlayerCompareData,
  PlayerCompareDelta,
  PlayerCompareSide,
  ProgressCompareData,
} from "@/lib/compare-data";
import { cn } from "@/lib/utils";

export type MobileCompareView = "progress" | "clubs" | "players";

const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("en-GB");

export function MobileCompareWorkspace({
  data,
  playerData,
  view,
}: {
  data: ClubCompareData;
  playerData: PlayerCompareData;
  view: MobileCompareView;
}) {
  return (
    <MobileAppShell className="gap-4">
      <MobileTopBar title="Compare" />
      <CompareSegments view={view} />
      {view === "progress" ? <ProgressMobile data={data.progress} /> : null}
      {view === "clubs" ? <ClubsMobile data={data} /> : null}
      {view === "players" ? <PlayersMobile data={playerData} /> : null}
    </MobileAppShell>
  );
}

function CompareSegments({ view }: { view: MobileCompareView }) {
  const tabs: Array<{ key: MobileCompareView; label: string; icon: typeof BarChart3 }> = [
    { key: "progress", label: "Progress", icon: BarChart3 },
    { key: "clubs", label: "Clubs", icon: GitCompareArrows },
    { key: "players", label: "Players", icon: Users },
  ];

  return (
    <nav aria-label="Comparison type" className="ios-segmented-control grid grid-cols-3 p-0.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = view === tab.key;

        return (
          <Link
            key={tab.key}
            href={`/compare?view=${tab.key}`}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-aaa flex min-h-11 min-w-0 touch-manipulation items-center justify-center gap-1.5 rounded-[0.55rem] px-2 text-[13px] font-semibold transition-colors motion-reduce:transition-none",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground active:bg-card/70",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ProgressMobile({ data }: { data: ProgressCompareData }) {
  const comparison = data.previousWeek;
  const tone = benefitTone(comparison.benefit.verdict);

  return (
    <>
      <section
        className="ios-grouped-list overflow-hidden px-4 py-4"
        aria-labelledby="compare-progress-answer"
      >
        <div className="flex items-center justify-between gap-3">
          <IOSInlineStatus label={comparison.benefit.verdict} tone={tone} />
          <span className="text-xs text-muted-foreground">
            {integerFormatter.format(comparison.focus.stockShots)} vs{" "}
            {integerFormatter.format(comparison.baseline.stockShots)} shots
          </span>
        </div>
        <h2
          id="compare-progress-answer"
          className="mt-2 text-[1.75rem] font-semibold leading-8 tracking-tight text-foreground"
        >
          {controlHeadline(comparison.delta)}
        </h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{comparison.benefit.summary}</p>
        <Button asChild className="mt-4 min-h-11 w-full rounded-xl">
          <Link href="/practice" prefetch={false}>
            <Target className="size-4" aria-hidden />
            Turn this into practice
          </Link>
        </Button>
      </section>

      <section className="grid gap-2" aria-labelledby="compare-progress-key-metrics">
        <IOSSectionHeader
          title="What changed"
          description={`${comparison.focus.label} against ${comparison.label.toLowerCase()}`}
        />
        <IOSGroupedList label="Key progress changes">
          <IOSMetricRow
            label="Playable shots"
            value={formatSignedRate(comparison.delta.playableRateDelta)}
            detail="Higher is better"
            tone={movementTone(comparison.delta.playableRateDelta, "higher")}
          />
          <IOSMetricRow
            label="Big misses"
            value={formatSignedRate(comparison.delta.bigMissRateDelta)}
            detail="Lower is better"
            tone={movementTone(comparison.delta.bigMissRateDelta, "lower")}
          />
          <IOSMetricRow
            label="Shot cone"
            value={formatSignedYards(comparison.delta.coneDeltaYd)}
            detail="Lower is tighter"
            tone={movementTone(comparison.delta.coneDeltaYd, "lower")}
          />
          <IOSMetricRow
            label="Median carry"
            value={formatSignedYards(comparison.delta.carryDeltaYd)}
            detail="Context, not the verdict"
            tone={movementTone(comparison.delta.carryDeltaYd, "higher")}
          />
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-labelledby="compare-progress-evidence">
        <IOSSectionHeader title="Evidence" />
        <IOSDisclosureGroup
          label="Progress comparison evidence"
          items={[
            {
              value: "clubs",
              title: "Club-by-club movement",
              summary: `${comparison.clubRows.length}`,
              description: "The clearest current changes",
              content: (
                <IOSGroupedList label="Club comparison rows">
                  {comparison.clubRows.length > 0 ? (
                    comparison.clubRows.map((row) => (
                      <IOSListRow
                        key={row.clubId}
                        label={row.label}
                        value={clubSignal(row.delta)}
                        detail={`${integerFormatter.format(row.focus.stockShots)} current · ${integerFormatter.format(row.baseline.stockShots)} baseline`}
                      />
                    ))
                  ) : (
                    <IOSListRow
                      label="No club rows yet"
                      detail="Import tracked full-shot clubs to compare this period."
                    />
                  )}
                </IOSGroupedList>
              ),
            },
            {
              value: "history",
              title: "Period history",
              summary: `${data.weeklyPeriods.length} weeks`,
              description: "Older weekly and monthly context",
              content: (
                <div className="grid gap-3">
                  <PeriodRows title="Weekly" periods={data.weeklyPeriods} />
                  <PeriodRows title="Monthly" periods={data.monthlyPeriods} />
                </div>
              ),
            },
            {
              value: "method",
              title: "How this comparison works",
              summary: "Method",
              content: (
                <p className="text-sm leading-6 text-muted-foreground">
                  ForeKingHell compares trusted stock shots from the current period with the
                  immediately preceding period. Carry is context; playable rate, big misses, offline
                  average and dispersion decide the control signal.
                </p>
              ),
            },
          ]}
        />
      </section>
    </>
  );
}

function ClubsMobile({ data }: { data: ClubCompareData }) {
  const clubA = data.clubA;
  const clubB = data.clubB;

  if (!clubA || !clubB) {
    return (
      <EmptyComparison
        icon={GitCompareArrows}
        title="Choose two clubs"
        detail="Import or add at least two clubs before comparing performance."
        action={<ClubPicker data={data} />}
      />
    );
  }

  const winner = clubWinner(clubA, clubB, data.delta);
  const rows = clubMetricRows(clubA, clubB, data.delta);

  return (
    <>
      <section
        className="ios-grouped-list overflow-hidden px-4 py-4"
        aria-labelledby="compare-clubs-answer"
      >
        <div className="flex items-center justify-between gap-3">
          <IOSInlineStatus label={winner.label} tone={winner.tone} />
          <ClubPicker data={data} />
        </div>
        <h2
          id="compare-clubs-answer"
          className="mt-2 break-words text-[1.75rem] font-semibold leading-8 tracking-tight text-foreground"
        >
          {winner.headline}
        </h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{winner.detail}</p>
      </section>

      <section className="grid gap-2" aria-labelledby="compare-club-key-metrics">
        <IOSSectionHeader
          title="Decision signals"
          description={`${clubA.label} compared with ${clubB.label}`}
        />
        <IOSGroupedList label="Key club comparison metrics">
          {rows.slice(0, 4).map((row) => (
            <IOSListRow
              key={row.label}
              label={row.label}
              value={row.delta}
              detail={`${row.a} · ${row.b}`}
              status={<IOSInlineStatus label={row.outcome} tone={row.tone} />}
            />
          ))}
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-labelledby="compare-club-evidence">
        <IOSSectionHeader title="Evidence" />
        <IOSDisclosureGroup
          label="Club comparison evidence"
          items={[
            {
              value: "metrics",
              title: "Full metric comparison",
              summary: `${rows.length}`,
              description: "Distance, control and launch",
              content: (
                <IOSGroupedList label="All club comparison metrics">
                  {rows.map((row) => (
                    <IOSListRow
                      key={row.label}
                      label={row.label}
                      value={row.delta}
                      detail={`${clubA.label}: ${row.a} · ${clubB.label}: ${row.b}`}
                      status={<IOSInlineStatus label={row.outcome} tone={row.tone} />}
                    />
                  ))}
                </IOSGroupedList>
              ),
            },
            {
              value: "radar",
              title: "Performance shape",
              summary: "Radar",
              description: "Specialist multi-metric view",
              content: <CompareRadarChart clubA={clubA} clubB={clubB} />,
              contentClassName: "px-2 pb-3",
            },
            {
              value: "dispersion",
              title: "Shot dispersion",
              summary: `${clubA.dispersion.length + clubB.dispersion.length} shots`,
              description: "The real shot clouds around target",
              content: <ClubDispersionPlot clubA={clubA} clubB={clubB} />,
              contentClassName: "px-2 pb-3",
            },
            {
              value: "sample",
              title: "Sample and method",
              summary: `${clubA.stockShots} / ${clubB.stockShots}`,
              content: (
                <p className="text-sm leading-6 text-muted-foreground">
                  The comparison uses trusted stock shots and excludes chips, recovery shots and
                  obvious mishits. A metric winner is only a directional signal; launch and fit
                  remain context-dependent.
                </p>
              ),
            },
          ]}
        />
      </section>
    </>
  );
}

function PlayersMobile({ data }: { data: PlayerCompareData }) {
  const playerA = data.playerA;
  const playerB = data.playerB;

  if (!playerA || !playerB) {
    return (
      <EmptyComparison
        icon={Users}
        title="Choose two players"
        detail="Only your profile and profiles visible to you are available."
        action={<PlayerPicker data={data} />}
      />
    );
  }

  const rows = playerMetricRows(playerA, playerB, data.delta);
  const winner = playerWinner(playerA, playerB, rows);

  return (
    <>
      <section
        className="ios-grouped-list overflow-hidden px-4 py-4"
        aria-labelledby="compare-players-answer"
      >
        <div className="flex items-center justify-between gap-3">
          <IOSInlineStatus label={winner.label} tone={winner.tone} />
          <PlayerPicker data={data} />
        </div>
        <h2
          id="compare-players-answer"
          className="mt-2 break-words text-[1.75rem] font-semibold leading-8 tracking-tight text-foreground"
        >
          {winner.headline}
        </h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{winner.detail}</p>
      </section>

      <section className="grid gap-2" aria-labelledby="compare-player-key-metrics">
        <IOSSectionHeader
          title="Decision signals"
          description="Scoring and measured golf evidence first"
        />
        <IOSGroupedList label="Key player comparison metrics">
          {rows.slice(0, 4).map((row) => (
            <IOSListRow
              key={row.label}
              label={row.label}
              value={row.delta}
              detail={`${row.a} · ${row.b}`}
              status={<IOSInlineStatus label={row.outcome} tone={row.tone} />}
            />
          ))}
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-labelledby="compare-player-evidence">
        <IOSSectionHeader title="Evidence" />
        <IOSDisclosureGroup
          label="Player comparison evidence"
          items={[
            {
              value: "metrics",
              title: "Full player comparison",
              summary: `${rows.length}`,
              description: "Scoring, distance and control",
              content: (
                <IOSGroupedList label="All player comparison metrics">
                  {rows.map((row) => (
                    <IOSListRow
                      key={row.label}
                      label={row.label}
                      value={row.delta}
                      detail={`${playerA.displayName}: ${row.a} · ${playerB.displayName}: ${row.b}`}
                      status={<IOSInlineStatus label={row.outcome} tone={row.tone} />}
                    />
                  ))}
                </IOSGroupedList>
              ),
            },
            {
              value: "profiles",
              title: "Player profiles",
              summary: "Open",
              content: (
                <IOSGroupedList label="Compared player profiles">
                  <IOSListRow
                    label={playerA.displayName}
                    detail={`@${playerA.username}${playerA.homeCourse ? ` · ${playerA.homeCourse}` : ""}`}
                    value={playerHandicap(playerA)}
                    href={`/profile/${playerA.username}`}
                  />
                  <IOSListRow
                    label={playerB.displayName}
                    detail={`@${playerB.username}${playerB.homeCourse ? ` · ${playerB.homeCourse}` : ""}`}
                    value={playerHandicap(playerB)}
                    href={`/profile/${playerB.username}`}
                  />
                </IOSGroupedList>
              ),
            },
            {
              value: "tournaments",
              title: "Tournament evidence",
              summary: `${playerA.recentTournamentScores.length + playerB.recentTournamentScores.length}`,
              description: "Recent submitted rounds only",
              content: (
                <IOSGroupedList label="Recent tournament scores">
                  {[
                    ...playerA.recentTournamentScores.map((score) => ({ player: playerA, score })),
                    ...playerB.recentTournamentScores.map((score) => ({ player: playerB, score })),
                  ].length > 0 ? (
                    [
                      ...playerA.recentTournamentScores.map((score) => ({
                        player: playerA,
                        score,
                      })),
                      ...playerB.recentTournamentScores.map((score) => ({
                        player: playerB,
                        score,
                      })),
                    ]
                      .slice(0, 12)
                      .map(({ player, score }, index) => (
                        <IOSListRow
                          key={`${player.userId}-${score.tournamentTitle}-${score.roundNumber}-${index}`}
                          label={score.tournamentTitle}
                          value={integerFormatter.format(score.grossScore)}
                          detail={`${player.displayName} · Round ${score.roundNumber}`}
                        />
                      ))
                  ) : (
                    <IOSListRow
                      label="No recent tournament rounds"
                      detail="No submitted tournament evidence is visible for these players."
                    />
                  )}
                </IOSGroupedList>
              ),
            },
            {
              value: "method",
              title: "Privacy and method",
              summary: "Method",
              content: (
                <p className="text-sm leading-6 text-muted-foreground">
                  Player comparison uses only profile, scoring, stock-yardage, accuracy and
                  tournament evidence that is already visible to you. Missing values remain missing
                  and do not count as a win.
                </p>
              ),
            },
          ]}
        />
      </section>
    </>
  );
}

function ClubPicker({ data }: { data: ClubCompareData }) {
  return (
    <BottomSheet
      label={
        <>
          <SlidersHorizontal className="size-4" aria-hidden /> Clubs
        </>
      }
      title="Choose clubs"
      triggerClassName="min-h-11 rounded-xl border border-border bg-secondary px-3 text-foreground"
    >
      <form
        action="/compare"
        method="get"
        className="grid gap-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <input type="hidden" name="view" value="clubs" />
        <NativeSelect name="clubAId" label="Club A" defaultValue={data.filters.clubAId}>
          {data.clubs.map((club) => (
            <SelectItem key={club.id} value={club.id}>
              {club.label} ({integerFormatter.format(club.shotCount)} shots)
            </SelectItem>
          ))}
        </NativeSelect>
        <NativeSelect name="clubBId" label="Club B" defaultValue={data.filters.clubBId}>
          {data.clubs.map((club) => (
            <SelectItem key={club.id} value={club.id}>
              {club.label} ({integerFormatter.format(club.shotCount)} shots)
            </SelectItem>
          ))}
        </NativeSelect>
        <Button type="submit" className="min-h-11 rounded-xl">
          Compare clubs
        </Button>
      </form>
    </BottomSheet>
  );
}

function PlayerPicker({ data }: { data: PlayerCompareData }) {
  return (
    <BottomSheet
      label={
        <>
          <SlidersHorizontal className="size-4" aria-hidden /> Players
        </>
      }
      title="Choose players"
      triggerClassName="min-h-11 rounded-xl border border-border bg-secondary px-3 text-foreground"
    >
      <form
        action="/compare"
        method="get"
        className="grid gap-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <input type="hidden" name="view" value="players" />
        <NativeSelect name="playerAId" label="Player A" defaultValue={data.filters.playerAId}>
          {data.players.map((player) => (
            <SelectItem key={player.userId} value={player.userId}>
              {player.displayName} (@{player.username})
            </SelectItem>
          ))}
        </NativeSelect>
        <NativeSelect name="playerBId" label="Player B" defaultValue={data.filters.playerBId}>
          {data.players.map((player) => (
            <SelectItem key={player.userId} value={player.userId}>
              {player.displayName} (@{player.username})
            </SelectItem>
          ))}
        </NativeSelect>
        <Button type="submit" className="min-h-11 rounded-xl">
          Compare players
        </Button>
      </form>
    </BottomSheet>
  );
}

function NativeSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      {label}
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  );
}

function EmptyComparison({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: typeof Activity;
  title: string;
  detail: string;
  action: ReactNode;
}) {
  return (
    <section className="ios-grouped-list grid justify-items-start gap-3 px-4 py-5">
      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
      </div>
      {action}
    </section>
  );
}

function PeriodRows({
  title,
  periods,
}: {
  title: string;
  periods: ProgressCompareData["weeklyPeriods"];
}) {
  return (
    <div className="grid gap-2">
      <IOSSectionHeader title={title} />
      <IOSGroupedList label={`${title} comparison history`}>
        {periods.length > 0 ? (
          periods
            .slice(0, 12)
            .map((period) => (
              <IOSListRow
                key={period.key}
                label={period.label}
                value={period.benefit.verdict}
                detail={`${integerFormatter.format(period.summary.stockShots)} stock shots · ${clubSignal(period.deltaFromPrevious)}`}
              />
            ))
        ) : (
          <IOSListRow
            label={`No ${title.toLowerCase()} history`}
            detail="More measured sessions are needed."
          />
        )}
      </IOSGroupedList>
    </div>
  );
}

type MobileMetricRow = {
  label: string;
  a: string;
  b: string;
  delta: string;
  outcome: string;
  tone: "positive" | "attention" | "info" | "neutral";
};

function clubMetricRows(
  a: ClubCompareSide,
  b: ClubCompareSide,
  delta: CompareDelta,
): MobileMetricRow[] {
  return [
    metricRow(
      "Carry",
      a.carryMedianYd,
      b.carryMedianYd,
      delta.carryDeltaYd,
      "higher",
      formatYards,
      "yd",
    ),
    metricRow(
      "Playable",
      a.playableRate,
      b.playableRate,
      delta.playableRateDelta,
      "higher",
      formatRate,
      "pts",
    ),
    metricRow(
      "Offline average",
      a.absoluteOfflineAverageYd,
      b.absoluteOfflineAverageYd,
      delta.offlineDeltaYd,
      "lower",
      formatYards,
      "yd",
    ),
    metricRow(
      "Shot cone",
      a.shotConeWidthYd,
      b.shotConeWidthYd,
      delta.coneDeltaYd,
      "lower",
      formatYards,
      "yd",
    ),
    metricRow(
      "Big misses",
      a.bigMissRate,
      b.bigMissRate,
      delta.bigMissRateDelta,
      "lower",
      formatRate,
      "pts",
    ),
    metricRow(
      "Ball speed",
      a.ballSpeedAverageMph,
      b.ballSpeedAverageMph,
      delta.ballSpeedDeltaMph,
      "higher",
      formatMph,
      "mph",
    ),
    metricRow(
      "Launch",
      a.launchAverageDeg,
      b.launchAverageDeg,
      delta.launchDeltaDeg,
      "context",
      formatDegrees,
      "deg",
    ),
  ];
}

function playerMetricRows(
  a: PlayerCompareSide,
  b: PlayerCompareSide,
  delta: PlayerCompareDelta,
): MobileMetricRow[] {
  return [
    metricRow(
      "Scoring average",
      a.scoringAverage,
      b.scoringAverage,
      delta.scoringAverageDelta,
      "lower",
      formatNumber,
      "shots",
    ),
    metricRow(
      "Best score",
      a.bestScore,
      b.bestScore,
      delta.bestScoreDelta,
      "lower",
      formatNumber,
      "shots",
    ),
    metricRow(
      "Playable",
      a.playableRate,
      b.playableRate,
      delta.playableRateDelta,
      "higher",
      formatRate,
      "pts",
    ),
    metricRow(
      "Offline average",
      a.absoluteOfflineAverageYd,
      b.absoluteOfflineAverageYd,
      delta.offlineDeltaYd,
      "lower",
      formatYards,
      "yd",
    ),
    metricRow(
      "Driver carry",
      a.driverCarryYd,
      b.driverCarryYd,
      delta.driverCarryDeltaYd,
      "higher",
      formatYards,
      "yd",
    ),
    metricRow(
      "7 iron carry",
      a.sevenIronCarryYd,
      b.sevenIronCarryYd,
      delta.sevenIronCarryDeltaYd,
      "higher",
      formatYards,
      "yd",
    ),
    metricRow(
      "Latest score",
      a.latestScore,
      b.latestScore,
      delta.latestScoreDelta,
      "lower",
      formatNumber,
      "shots",
    ),
    metricRow(
      "Tournament total",
      a.tournamentGrossTotal,
      b.tournamentGrossTotal,
      delta.tournamentGrossDelta,
      "lower",
      formatNumber,
      "shots",
    ),
  ];
}

function metricRow(
  label: string,
  a: number | null,
  b: number | null,
  delta: number | null,
  direction: "higher" | "lower" | "context",
  formatter: (value: number | null) => string,
  unit: string,
): MobileMetricRow {
  const outcome = metricOutcome(delta, direction);
  return {
    label,
    a: formatter(a),
    b: formatter(b),
    delta: delta === null ? "--" : `${signed(delta)} ${unit}`,
    outcome: outcome.label,
    tone: outcome.tone,
  };
}

function metricOutcome(value: number | null, direction: "higher" | "lower" | "context") {
  if (direction === "context")
    return { label: "Fit dependent", winner: "none" as const, tone: "attention" as const };
  if (value === null)
    return { label: "No data", winner: "none" as const, tone: "neutral" as const };
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return { label: "Even", winner: "tie" as const, tone: "neutral" as const };
  const aWins = direction === "higher" ? rounded > 0 : rounded < 0;
  return {
    label: aWins ? "First leads" : "Second leads",
    winner: aWins ? ("a" as const) : ("b" as const),
    tone: aWins ? ("positive" as const) : ("info" as const),
  };
}

function clubWinner(a: ClubCompareSide, b: ClubCompareSide, delta: CompareDelta) {
  const outcomes = clubMetricRows(a, b, delta).map((row) => row.outcome);
  const aWins = outcomes.filter((outcome) => outcome === "First leads").length;
  const bWins = outcomes.filter((outcome) => outcome === "Second leads").length;
  if (aWins === bWins)
    return {
      label: "No clear winner",
      headline: "Too close to call",
      detail: `The clubs split the available distance and control signals ${aWins}-${bWins}.`,
      tone: "neutral" as const,
    };
  const winner = aWins > bWins ? a : b;
  return {
    label: "Current leader",
    headline: `${winner.label} leads`,
    detail: `Wins ${aWins}-${bWins} across the available distance and control signals. Check the evidence before changing the bag.`,
    tone: "positive" as const,
  };
}

function playerWinner(a: PlayerCompareSide, b: PlayerCompareSide, rows: MobileMetricRow[]) {
  const aWins = rows.filter((row) => row.outcome === "First leads").length;
  const bWins = rows.filter((row) => row.outcome === "Second leads").length;
  if (aWins === bWins)
    return {
      label: "Mixed evidence",
      headline: "No clear player lead",
      detail: `The players split the available measured signals ${aWins}-${bWins}. Missing values are not counted.`,
      tone: "neutral" as const,
    };
  const winner = aWins > bWins ? a : b;
  return {
    label: "Measured lead",
    headline: `${winner.displayName} leads`,
    detail: `Leads ${aWins}-${bWins} across the available measured signals. Missing values are not counted.`,
    tone: "positive" as const,
  };
}

function benefitTone(verdict: string): "positive" | "attention" | "neutral" {
  if (verdict === "Beneficial" || verdict === "Useful") return "positive";
  if (verdict === "Mixed") return "attention";
  return "neutral";
}

function movementTone(
  value: number | null,
  direction: "higher" | "lower",
): "positive" | "attention" | "neutral" {
  if (value === null || Math.round(value * 10) / 10 === 0) return "neutral";
  return (direction === "higher" ? value > 0 : value < 0) ? "positive" : "attention";
}

function controlHeadline(delta: CompareDelta) {
  const score = [
    delta.playableRateDelta !== null
      ? delta.playableRateDelta >= 5
        ? 1
        : delta.playableRateDelta <= -5
          ? -1
          : 0
      : 0,
    delta.bigMissRateDelta !== null
      ? delta.bigMissRateDelta <= -4
        ? 1
        : delta.bigMissRateDelta >= 4
          ? -1
          : 0
      : 0,
    delta.coneDeltaYd !== null
      ? delta.coneDeltaYd <= -4
        ? 1
        : delta.coneDeltaYd >= 4
          ? -1
          : 0
      : 0,
  ].reduce((total, value) => total + value, 0);
  if (score >= 2) return "Your control is improving";
  if (score >= 1) return "Your golf is more playable";
  if (score <= -2) return "Control needs attention";
  if (score <= -1) return "One control signal slipped";
  return "No clear movement yet";
}

function clubSignal(delta: CompareDelta) {
  const playable = formatSignedRate(delta.playableRateDelta);
  const cone = formatSignedYards(delta.coneDeltaYd);
  if (playable !== "--") return `${playable} playable`;
  if (cone !== "--") return `${cone} cone`;
  return "No comparable signal";
}

function playerHandicap(player: PlayerCompareSide) {
  return (
    player.handicapBand ??
    (player.handicapEstimate === null
      ? "--"
      : `Hcp ${numberFormatter.format(player.handicapEstimate)}`)
  );
}

function formatNumber(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}
function formatYards(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} yd`;
}
function formatMph(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)} mph`;
}
function formatDegrees(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)}°`;
}
function formatRate(value: number | null) {
  return value === null ? "--" : `${numberFormatter.format(value)}%`;
}
function formatSignedYards(value: number | null) {
  return value === null ? "--" : `${signed(value)} yd`;
}
function formatSignedRate(value: number | null) {
  return value === null ? "--" : `${signed(value)} pts`;
}
function signed(value: number) {
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
}
