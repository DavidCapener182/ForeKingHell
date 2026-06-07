import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  Cloud,
  Dumbbell,
  Gauge,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";

import { createManualSpeedSessionAction, updateSpeedGoalsAction } from "@/app/speed/actions";
import { ClubSpeedFocus } from "@/app/speed/club-speed-focus";
import { FutureBagSlider } from "@/app/speed/future-bag-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CompactReadoutGrid,
  DataPair,
  DataPanel,
  EmptyState,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  getSpeedCentrePageData,
  type ClubSpeedRow,
  type FutureBagProjectionRow,
  type SpeedCarryProjection,
  type SpeedCentreSession,
  type SpeedGoal,
  type SpeedMonthPoint,
  type SpeedSideSummary,
  type SpeedTransferInsight,
  type SpeedTrendPoint,
} from "@/lib/speed-training-data";
import {
  average,
  buildSpeedPrescription,
  formatSpeed,
  formatSpeedCompact,
} from "@/lib/speed-training";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    club?: string | string[];
    speed_error?: string | string[];
    speed_saved?: string | string[];
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export default async function SpeedCentrePage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const userId = await requireCurrentUserId();
  const data = await getSpeedCentrePageData(userId);
  const speedError = firstSearchParam(resolvedSearchParams.speed_error);
  const speedSaved = firstSearchParam(resolvedSearchParams.speed_saved);
  const selectedClubIdParam = firstSearchParam(resolvedSearchParams.club);
  const summary = data.summary;
  const driverSystemTarget =
    data.clubSpeedRows.find((row) => row.clubType === "driver")?.benchmarkTarget ?? null;
  const selectedClubRow = resolveSelectedClubRow(data.clubSpeedRows, selectedClubIdParam);
  const selectedClub = selectedClubRow
    ? buildSelectedClubContext({
        row: selectedClubRow,
        sessions: data.sessions,
        goals: data.goals,
        futureBag: data.futureBag,
        driverTargetSpeedMph: summary.targetSpeedMph,
      })
    : null;
  const selectedTrend = selectedClub?.trend ?? data.trend;
  const selectedRolling = selectedClub?.rolling ?? data.rolling;
  const selectedPrescription = selectedClub?.prescription ?? summary.prescription;
  const selectedCarryProjection = selectedClub?.carryProjection ?? summary.carryProjection;
  const selectedSpeedMilestones =
    selectedClub?.speedMilestones ??
    buildSpeedMilestones({
      currentSpeedMph: summary.currentSpeedMph,
      targetSpeedMph: summary.targetSpeedMph,
      carryProjection: summary.carryProjection,
    });
  const selectedSpeedTimeline =
    selectedClub?.speedTimeline ?? buildSpeedTimeline(summary.currentSpeedMph, summary.targetSpeedMph);
  const hasSelectedSpeedTrend = selectedTrend.length >= 2;

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Speed Centre</StatusPill>}
        title="Athletic speed tracking"
        description="Track no-ball speed swings separately from shot performance so speed work does not distort bag numbers. No-ball means a training swing where you do not hit a ball."
        metrics={[
          {
            label: "Playing speed",
            value: formatSpeed(summary.currentSpeedMph),
            detail: currentSpeedSourceText(summary.currentSpeedSource),
          },
          {
            label: "PB",
            value: formatSpeed(summary.personalBestMph),
            detail: "Fastest no-ball or with-ball",
          },
          {
            label: "No-ball last 20",
            value: formatSpeed(summary.last20AvgMph),
            detail: "Training swings without a ball",
          },
          {
            label: "With ball",
            value: formatSpeed(summary.shotSpeed.last20DriverAvgMph),
            detail: "Driver benchmark",
          },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link href="/rapsodo" prefetch={false}>
              <Cloud aria-hidden="true" />
              R-Cloud
            </Link>
          </Button>
        }
      />

      {speedError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {speedError}
        </div>
      ) : null}
      {speedSaved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
          {speedSavedMessage(speedSaved)}
        </div>
      ) : null}

      <CompactReadoutGrid
        columnsClassName="sm:grid-cols-2 xl:grid-cols-7"
        items={[
          {
            label: "Playing speed",
            value: formatSpeed(summary.currentSpeedMph),
            detail: currentSpeedSourceText(summary.currentSpeedSource),
            tone: "sky",
          },
          {
            label: "No-ball training avg",
            value: formatSpeed(summary.trainingCurrentSpeedMph),
            detail: "Latest speed session without a ball",
            tone: "slate",
          },
          {
            label: "7-day average",
            value: formatSpeed(summary.sevenDayAvgMph),
            detail: "Training sessions",
            tone: "green",
          },
          {
            label: "30-day training",
            value: formatSpeed(summary.thirtyDayAvgMph),
            detail: `${summary.sessionsLast7Days} sessions this week`,
            tone: "green",
          },
          {
            label: "Personal best",
            value: formatSpeed(summary.personalBestMph),
            detail: "Max logged speed",
            tone: "amber",
          },
          {
            label: "Speed index",
            value:
              summary.speedIndex.value === null
                ? "Set target"
                : `${Math.round(summary.speedIndex.value * 100)}%`,
            detail: summary.speedIndex.label,
            tone: summary.speedIndex.tone,
          },
          {
            label: "Target",
            value: formatSpeed(summary.targetSpeedMph),
            detail:
              summary.currentSpeedMph && summary.targetSpeedMph
                ? `${formatGap(summary.targetSpeedMph - summary.currentSpeedMph)} gap`
                : "Add a target",
            tone: "green",
          },
        ]}
      />

      <DataPanel>
        <SectionHeader
          title="Club focus"
          description="No-ball training speed, with-ball speed, targets, and carry potential by selected club."
          action={<StatusPill tone="sky">{data.clubSpeedRows.length} clubs</StatusPill>}
        />
        {data.clubSpeedRows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Gauge className="size-5" aria-hidden="true" />}
              title="No clubs to focus yet"
              description="Club-specific speed scores appear once clubs or shot-speed samples exist."
            />
          </div>
        ) : (
          <ClubSpeedFocus
            rows={data.clubSpeedRows}
            goals={data.goals}
            futureBag={data.futureBag}
            driverTargetSpeedMph={summary.targetSpeedMph}
            selectedClubId={selectedClub?.row.clubId ?? null}
          />
        )}
      </DataPanel>

      <DataPanel>
        <SectionHeader
          title="Speed goals"
          description="Recommended goals auto-advance through the bag benchmark ladder. Saved values override them."
          action={
            summary.targetDateIso ? (
              <StatusPill tone="green">{formatShortDate(summary.targetDateIso)}</StatusPill>
            ) : (
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            )
          }
        />
        <form action={updateSpeedGoalsAction} className="grid gap-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[160px_170px_minmax(0,1fr)_auto]">
            <Field label="Driver goal">
              <Input
                name="driverGlobalTarget"
                inputMode="decimal"
                placeholder={systemTargetPlaceholder(driverSystemTarget)}
                defaultValue={goalDefault(data.goals, "driver_global", "target")}
              />
            </Field>
            <Field label="Target date">
              <Input
                name="driverGlobalDate"
                type="date"
                defaultValue={goalDefault(data.goals, "driver_global", "date")}
              />
            </Field>
            <Field label="Goal notes">
              <Input
                name="driverGlobalNotes"
                placeholder="Driver playing speed goal"
                defaultValue={goalDefault(data.goals, "driver_global", "notes")}
              />
            </Field>
            <Button type="submit" className="self-end">
              <Save aria-hidden="true" />
              Save goals
            </Button>
          </div>

          <details className="rounded-lg border border-border/70 bg-white/65 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-950">
              Optional per-club target overrides
            </summary>
            <div className="mt-3 grid gap-2">
              {data.clubOptions.map((club) => (
                <div
                  key={club.id}
                  className="grid gap-2 rounded-lg border border-border/60 bg-white/70 p-2 sm:grid-cols-[minmax(0,1fr)_130px_150px]"
                >
                  <div className="min-w-0 self-center">
                    <p className="truncate text-sm font-semibold text-slate-950">{club.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {systemTargetCopy(data.clubSpeedRows, club.id)}
                    </p>
                  </div>
                  <Input
                    name={`clubTarget:${club.id}`}
                    inputMode="decimal"
                    placeholder={systemTargetPlaceholder(
                      data.clubSpeedRows.find((row) => row.clubId === club.id)?.benchmarkTarget ??
                        null,
                    )}
                    defaultValue={goalDefault(data.goals, clubGoalKey(club.id), "target")}
                  />
                  <Input
                    name={`clubTargetDate:${club.id}`}
                    type="date"
                    defaultValue={goalDefault(data.goals, clubGoalKey(club.id), "date")}
                  />
                </div>
              ))}
            </div>
          </details>
        </form>
      </DataPanel>

      <DataPanel>
        <SectionHeader
          title="Club speed by club"
          description="No-ball speed sessions against actual with-ball speed for every active club."
          action={<StatusPill tone="sky">{data.clubSpeedRows.length} clubs</StatusPill>}
        />
        <div className="grid gap-2 p-4">
          {data.clubSpeedRows.length === 0 ? (
            <EmptyState
              icon={<Gauge className="size-5" aria-hidden="true" />}
              title="No clubs to show yet"
              description="Add clubs or import shots with club speed, then log speed sessions against the club used."
            />
          ) : (
            data.clubSpeedRows.map((row) => (
              <ClubSpeedRowCard key={row.clubId ?? "unassigned"} row={row} />
            ))
          )}
        </div>
      </DataPanel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <DataPanel>
          <SectionHeader
            title="Speed trend"
            description={
              selectedClub
                ? `No-ball ${selectedClub.shortLabel} sessions over time, kept separate from shot sessions.`
                : "No-ball training averages over time, kept separate from shot sessions."
            }
            action={
              <StatusPill tone={selectedPrescription.priority === "High" ? "amber" : "sky"}>
                {selectedPrescription.priority}
              </StatusPill>
            }
          />
          <div
            className={cn(
              "grid gap-4 p-4",
              hasSelectedSpeedTrend
                ? "lg:grid-cols-[minmax(0,1fr)_320px]"
                : "lg:grid-cols-[minmax(0,1fr)_340px]",
            )}
          >
            {hasSelectedSpeedTrend ? (
              <SpeedTrendChart points={selectedTrend} />
            ) : (
              <SpeedTrendStarterCard
                sessionCount={selectedClub?.sessions.length ?? data.sessions.length}
                currentAverageMph={
                  selectedClub?.row.trainingAvgMph ??
                  summary.trainingCurrentSpeedMph ??
                  summary.last20AvgMph
                }
                personalBestMph={selectedClub?.row.trainingPbMph ?? summary.personalBestMph}
              />
            )}
            <div className="grid content-start gap-3">
              <SpeedPrescriptionCard
                headline={selectedPrescription.headline}
                recommendation={selectedPrescription.recommendation}
                goal={selectedPrescription.goal}
              />
              <div className="grid gap-2">
                <DataPair label="Forecast basis" value={forecastText(selectedTrend)} />
                <DataPair
                  label="7-day no-ball avg"
                  value={formatSpeed(selectedRolling.sevenDayAvgMph)}
                />
                <DataPair
                  label="30-day no-ball avg"
                  value={formatSpeed(selectedRolling.thirtyDayAvgMph)}
                />
                <DataPair
                  label="Speed gain"
                  value={
                    selectedRolling.speedGainPercent === null
                      ? "Need trend"
                      : `${formatSignedNumber(selectedRolling.speedGainPercent)}%`
                  }
                />
                <DataPair
                  label="Speed conversion"
                  value={
                    selectedClub
                      ? strikeEfficiencyLabel(selectedClub.transferInsight)
                      : summary.driverEfficiency.verdict
                  }
                />
                <DataPair
                  label={selectedClub ? `With-ball ${selectedClub.shortLabel}` : "With-ball driver"}
                  value={formatSpeed(
                    selectedClub?.row.shotLast20AvgMph ?? summary.shotSpeed.last20DriverAvgMph,
                  )}
                />
                <DataPair
                  label="No-ball vs with-ball"
                  value={
                    selectedClub
                      ? formatTransferGap(selectedClub.transferInsight.gapMph)
                      : formatTrainingToShotGap(
                          summary.trainingCurrentSpeedMph,
                          summary.shotSpeed.last20DriverAvgMph,
                        )
                  }
                />
                {selectedClub?.row.clubType === "driver" || !selectedClub ? (
                  <DataPair
                    label="Recent driver smash"
                    value={
                      summary.driverEfficiency.smashFactor
                        ? numberFormatter.format(summary.driverEfficiency.smashFactor)
                        : "No data"
                    }
                  />
                ) : (
                  <DataPair
                    label="Shot sample"
                    value={
                      selectedClub.row.shotSampleSize > 0
                        ? `${selectedClub.row.shotSampleSize} shots`
                        : "No shot-speed samples"
                    }
                  />
                )}
              </div>
              {selectedRolling.monthlyPoints.length > 0 ? (
                <div className="rounded-lg border border-border/70 bg-white/65 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Monthly training
                  </p>
                  <div className="mt-2 grid gap-2">
                    {selectedRolling.monthlyPoints.map((point) => (
                      <div
                        key={point.label}
                        className="grid grid-cols-[44px_1fr_1fr] gap-2 text-sm"
                      >
                        <span className="font-medium text-slate-950">{point.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          Avg {formatSpeedCompact(point.avgSpeedMph)}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          PB {formatSpeedCompact(point.pbSpeedMph)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title={selectedClub ? `${selectedClub.shortLabel} speed potential` : "Speed potential"}
            description={
              selectedClub
                ? `Projected ${selectedClub.shortLabel} carry from the selected club speed target.`
                : "A practical driver carry estimate from speed gain."
            }
            action={<Target className="size-4 text-primary" aria-hidden="true" />}
          />
          <div className="grid gap-3 p-4">
            <div className="grid grid-cols-3 gap-2">
              <PotentialMetric
                label="Current"
                value={formatCarry(selectedCarryProjection.currentCarryYd)}
              />
              <PotentialMetric
                label="Target"
                value={formatCarry(selectedCarryProjection.targetCarryYd)}
              />
              <PotentialMetric
                label="Gain"
                value={
                  selectedCarryProjection.carryGainYd === null
                    ? "-"
                    : `+${selectedCarryProjection.carryGainYd} yd`
                }
              />
            </div>
            <div className="rounded-lg border border-border/70 bg-white/65 p-3 text-sm leading-6 text-muted-foreground">
              {selectedCarryProjection.basis}. Current gain model is{" "}
              {numberFormatter.format(selectedCarryProjection.yardsPerMph)} carry yards per mph.
            </div>
            <div className="rounded-lg border border-border/70 bg-white/65 p-3 text-sm leading-6 text-muted-foreground">
              {selectedClub
                ? selectedPotentialFocus(selectedClub)
                : summary.driverEfficiency.focus}
            </div>
            {selectedSpeedMilestones.length > 0 ? (
              <div className="rounded-lg border border-border/70 bg-white/65 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">Speed milestones</p>
                  <span className="text-xs font-medium text-muted-foreground">
                    Same carry model
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedSpeedMilestones.map((milestone) => (
                    <div
                      key={milestone.speedMph}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-border/60 bg-white/70 p-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tabular-nums text-slate-950">
                          {formatMilestoneSpeed(milestone.speedMph)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {milestone.label}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-slate-950">
                          {milestone.projectedCarryYd} yd
                        </p>
                        <p className="text-xs font-medium tabular-nums text-emerald-800">
                          {formatCarryGain(milestone.carryGainYd)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-lg border border-border/70 bg-white/65 p-3 text-sm leading-6 text-muted-foreground">
              Actual with-ball shots feed this page as a read-only comparison. Speed Centre
              sessions do not write back into shots, bag yardages, or stock gapping.
            </div>
          </div>
        </DataPanel>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
        <DataPanel>
          <SectionHeader
            title={
              selectedClub && selectedClub.row.clubType !== "driver"
                ? `${selectedClub.shortLabel} Athletic Development`
                : "Athletic Development"
            }
            description={
              selectedClub
                ? "The coach-facing speed card for the selected club."
                : "The coach-facing speed card."
            }
            action={
              <StatusPill tone={selectedPrescription.priority === "High" ? "amber" : "green"}>
                Coach
              </StatusPill>
            }
          />
            <div className="grid gap-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PotentialMetric
                label="Current"
                value={formatSpeed(selectedClub?.currentSpeedMph ?? summary.currentSpeedMph)}
              />
              <PotentialMetric
                label="No-ball avg"
                value={formatSpeed(selectedClub?.row.trainingAvgMph ?? summary.trainingCurrentSpeedMph)}
              />
              <PotentialMetric
                label="Target"
                value={formatSpeed(selectedClub?.target.value ?? summary.targetSpeedMph)}
              />
              <PotentialMetric
                label={selectedClub ? "Gap" : "Progress"}
                value={
                  selectedClub
                    ? formatTargetGap(selectedClub.currentSpeedMph, selectedClub.target.value)
                    : formatNullableGap(summary.forecast.progressThisMonthMph)
                }
              />
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-lg border border-border/70 bg-white/65 p-3 text-sm leading-6 text-muted-foreground">
                {selectedClub?.transferInsight.coachMessage ?? summary.transferInsight.coachMessage}
              </div>
              <div className="grid gap-2">
                <DataPair
                  label="Strike efficiency"
                  value={strikeEfficiencyLabel(selectedClub?.transferInsight ?? summary.transferInsight)}
                />
                <DataPair
                  label="No-ball to with-ball"
                  value={formatTransferRatio(
                    selectedClub?.transferInsight.ratioPercent ??
                      summary.transferInsight.ratioPercent,
                  )}
                />
                <DataPair
                  label="Speed gap"
                  value={formatTransferGap(
                    selectedClub?.transferInsight.gapMph ?? summary.transferInsight.gapMph,
                  )}
                />
                <DataPair
                  label="Confidence"
                  value={selectedClub?.confidenceLabel ?? summary.forecast.confidenceLabel}
                />
              </div>
            </div>
            <SpeedTimelineCard
              milestones={selectedSpeedTimeline}
              hasMeasuredTrend={hasSelectedSpeedTrend}
            />
          </div>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title={
              selectedClub && selectedClub.row.clubType !== "driver"
                ? `${selectedClub.shortLabel} speed profile`
                : "Speed profile"
            }
            description={
              selectedClub
                ? "No-ball sessions for the selected club by side and implement."
                : "Dominant side, non-dominant side, and overspeed markers."
            }
            action={<Dumbbell className="size-4 text-primary" aria-hidden="true" />}
          />
          <div className="grid gap-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <PotentialMetric
                label="Dominant"
                value={formatSpeed(
                  selectedClub?.sideSummary.dominantAvgMph ?? summary.sideSummary.dominantAvgMph,
                )}
              />
              <PotentialMetric
                label="Non-dominant"
                value={formatSpeed(
                  selectedClub?.sideSummary.nonDominantAvgMph ??
                    summary.sideSummary.nonDominantAvgMph,
                )}
              />
            </div>
            {(selectedClub?.sideSummary.sideBalancePercent ??
              summary.sideSummary.sideBalancePercent) !== null ? (
              <DataPair
                label="Side balance"
                value={`${
                  selectedClub?.sideSummary.sideBalancePercent ??
                  summary.sideSummary.sideBalancePercent
                }%`}
              />
            ) : null}
            {(selectedClub?.sideSummary.overspeedMaxMph ?? summary.sideSummary.overspeedMaxMph) !==
            null ? (
              <DataPair
                label="Overspeed max"
                value={formatSpeed(
                  selectedClub?.sideSummary.overspeedMaxMph ?? summary.sideSummary.overspeedMaxMph,
                )}
              />
            ) : null}
            {(selectedClub?.sideSummary.overspeedRatio ?? summary.sideSummary.overspeedRatio) !==
            null ? (
              <DataPair
                label="Overspeed ratio"
                value={`${(
                  selectedClub?.sideSummary.overspeedRatio ?? summary.sideSummary.overspeedRatio
                )?.toFixed(2)}x`}
              />
            ) : null}
            {(selectedClub?.sideSummary.sideBalancePercent ??
              summary.sideSummary.sideBalancePercent) === null ||
            (selectedClub?.sideSummary.overspeedRatio ?? summary.sideSummary.overspeedRatio) ===
              null ? (
              <SpeedProfileUnlocks
                needsNonDominant={
                  (selectedClub?.sideSummary.sideBalancePercent ??
                    summary.sideSummary.sideBalancePercent) === null
                }
                needsOverspeed={
                  (selectedClub?.sideSummary.overspeedRatio ?? summary.sideSummary.overspeedRatio) ===
                  null
                }
              />
            ) : null}
          </div>
        </DataPanel>
      </div>

      <DataPanel>
        <SectionHeader
          title="What happens if I get faster?"
          description="Select one club at a time to project carry changes without changing saved bag numbers."
          action={<TrendingUp className="size-4 text-primary" aria-hidden="true" />}
        />
        <div className="p-4">
          {data.futureBag.length > 0 ? (
            <FutureBagSlider
              key={selectedClub?.row.clubId ?? "default-club"}
              rows={data.futureBag}
              targetSpeedMph={summary.targetSpeedMph}
              selectedClubId={selectedClub?.row.clubId ?? null}
            />
          ) : (
            <EmptyState
              icon={<Gauge className="size-5" aria-hidden="true" />}
              title="Future Bag needs stock yardages"
              description="Build stock carry numbers first, then Speed Centre can project the bag forward."
            />
          )}
        </div>
      </DataPanel>

      <div className="grid gap-4 xl:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)]">
        <DataPanel>
          <SectionHeader
            title="Add speed session"
            description="Use a real club, speed stick, weighted club, or another implement."
            action={<Plus className="size-4 text-primary" aria-hidden="true" />}
          />
          <form action={createManualSpeedSessionAction} className="grid gap-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date">
                <Input name="sessionDate" type="date" defaultValue={todayDateInput()} />
              </Field>
              <Field label="Title">
                <Input name="title" placeholder="R-Speed" />
              </Field>
              <Field label="Implement">
                <NativeSelect name="implementKind" defaultValue="club">
                  <option value="club">Golf club</option>
                  <option value="speed_stick">Speed stick</option>
                  <option value="weighted_club">Weighted club</option>
                  <option value="other">Other</option>
                </NativeSelect>
              </Field>
              <Field label="Side">
                <NativeSelect name="handedness" defaultValue="dominant">
                  <option value="dominant">Dominant side</option>
                  <option value="non_dominant">Non-dominant side</option>
                  <option value="both">Both sides</option>
                </NativeSelect>
              </Field>
              <Field label="Speed system">
                <NativeSelect name="speedSystem" defaultValue="">
                  <option value="">Standard club speed</option>
                  <option value="R-Speed">R-Speed</option>
                  <option value="Light speed stick">Light speed stick</option>
                  <option value="Medium speed stick">Medium speed stick</option>
                  <option value="Heavy speed stick">Heavy speed stick</option>
                  <option value="Stack">Stack</option>
                  <option value="Other">Other</option>
                </NativeSelect>
              </Field>
            </div>

            <Field label="Club used">
              <NativeSelect name="clubId" defaultValue="">
                <option value="">Not in bag / speed stick</option>
                {data.clubOptions.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label="Implement label">
              <Input
                name="implementLabel"
                placeholder="Only needed if no club is selected: speed stick, Stack 195g, etc."
              />
            </Field>

            <SpeedReadingsField />

            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Min">
                <Input name="minSpeedMph" inputMode="decimal" placeholder="73" />
              </Field>
              <Field label="Average">
                <Input name="avgSpeedMph" inputMode="decimal" placeholder="81" />
              </Field>
              <Field label="Max">
                <Input name="maxSpeedMph" inputMode="decimal" placeholder="87" />
              </Field>
              <Field label="Count">
                <Input name="swingCount" inputMode="numeric" placeholder="15" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
              <Field label="Target speed">
                <Input name="targetSpeedMph" inputMode="decimal" placeholder="95" />
              </Field>
              <Field label="Notes">
                <Input name="notes" placeholder="Felt strongest with driver, no speed sticks" />
              </Field>
            </div>

            <Button type="submit" className="w-full sm:w-fit">
              <Plus aria-hidden="true" />
              Save speed session
            </Button>
          </form>
        </DataPanel>

        <div className="grid gap-4">
          <DataPanel>
            <SectionHeader
              title="R-Cloud speed sessions"
              description="R-Speed is visible separately from normal Rapsodo shots."
              action={
                data.rapsodo.connected ? (
                  <StatusPill tone={data.rapsodo.error ? "amber" : "green"}>Connected</StatusPill>
                ) : (
                  <StatusPill tone="amber">Not connected</StatusPill>
                )
              }
            />
            <div className="grid gap-3 p-4">
              {data.rapsodo.error ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {data.rapsodo.error}
                </div>
              ) : null}
              {!data.rapsodo.connected ? (
                <RCloudConnectCard />
              ) : data.rapsodo.items.length === 0 && !data.rapsodo.error ? (
                <EmptyState
                  icon={<ShieldCheck className="size-5" aria-hidden="true" />}
                  title="No R-Speed detail found"
                  description="R-Cloud is connected, but the speed-session list did not return no-ball training rows."
                />
              ) : (
                <>
                  <div className="rounded-lg border border-border/70 bg-white/65 px-3 py-2 text-sm leading-6 text-muted-foreground">
                    R-Cloud can list speed sessions, but checked detail rows may still come back
                    empty. When that happens, use the manual readings box for the club or implement
                    used.
                  </div>
                  <div className="grid gap-2">
                    {data.rapsodo.items.map((item) => (
                      <div
                        key={item.providerSessionId}
                        className="grid gap-2 rounded-lg border border-border/70 bg-white/65 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(item.dateIso)} · {item.swingCount ?? "-"} swings ·{" "}
                            {item.speedSystem ?? "System unknown"}
                          </p>
                        </div>
                        <StatusPill tone={item.detailStatus === "available" ? "green" : "amber"}>
                          {item.detailStatus === "available"
                            ? `${item.detailSwingCount} detail rows`
                            : item.detailStatus === "empty"
                              ? "No detail rows"
                              : "Detail unchecked"}
                        </StatusPill>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Recent sessions"
              description="Manual and future synced speed work."
              action={<Activity className="size-4 text-primary" aria-hidden="true" />}
            />
            <div className="grid gap-2 p-4">
              {data.sessions.length === 0 ? (
                <EmptyState
                  icon={<Gauge className="size-5" aria-hidden="true" />}
                  title="No speed sessions yet"
                  description="Add the R-Speed readings from the Rapsodo app to create your first baseline."
                />
              ) : (
                data.sessions.slice(0, 10).map((session) => (
                  <div
                    key={session.id}
                    className="grid gap-3 rounded-lg border border-border/70 bg-white/65 p-3 md:grid-cols-[minmax(0,1fr)_repeat(4,88px)_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {session.implementLabel}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(session.sessionDateIso)} · {session.swingCount} swings ·{" "}
                        {session.source === "manual" ? "Manual" : "R-Cloud"}
                      </p>
                    </div>
                    <MetricCell label="Avg" value={formatSpeedCompact(session.avgSpeedMph)} />
                    <MetricCell label="Max" value={formatSpeedCompact(session.maxSpeedMph)} />
                    <MetricCell label="Min" value={formatSpeedCompact(session.minSpeedMph)} />
                    <MetricCell label="Target" value={formatSpeedCompact(session.targetSpeedMph)} />
                    <Button asChild variant="outline" size="sm" className="self-center">
                      <Link href={`/speed/sessions/${session.id}`} prefetch={false}>
                        <Pencil aria-hidden="true" />
                        Edit
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DataPanel>
        </div>
      </div>
    </PageShell>
  );
}

function SpeedTrendStarterCard({
  sessionCount,
  currentAverageMph,
  personalBestMph,
}: {
  sessionCount: number;
  currentAverageMph: number | null;
  personalBestMph: number | null;
}) {
  const sessionsNeeded = Math.max(0, 2 - sessionCount);
  const sessionNeedCopy =
    sessionsNeeded === 1 ? "Need 1 more" : `Need ${sessionsNeeded} sessions`;

  return (
    <div className="rounded-lg border border-border/70 bg-white/65 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Speed Trend</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {sessionCount} {sessionCount === 1 ? "session" : "sessions"} recorded
          </p>
        </div>
        <StatusPill tone="amber">{sessionNeedCopy}</StatusPill>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <PotentialMetric label="Current average" value={formatSpeed(currentAverageMph)} />
        <PotentialMetric label="Personal best" value={formatSpeed(personalBestMph)} />
        <PotentialMetric
          label="Next target"
          value={currentAverageMph === null ? "Log session" : `Beat ${formatSpeedCompact(currentAverageMph)}`}
        />
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {sessionsNeeded <= 1
          ? "Add one more speed session and this switches from a baseline card to the trend graph."
          : "Log two speed sessions and this switches from a baseline card to the trend graph."}
      </p>
    </div>
  );
}

function SpeedPrescriptionCard({
  headline,
  recommendation,
  goal,
}: {
  headline: string;
  recommendation: string;
  goal: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-white/65 p-3">
      <div className="flex items-center gap-2">
        <Dumbbell className="size-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-950">{headline}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation}</p>
      <p className="mt-2 text-sm font-medium text-slate-950">{goal}</p>
    </div>
  );
}

function SpeedTimelineCard({
  milestones,
  hasMeasuredTrend,
}: {
  milestones: SpeedTimelinePoint[];
  hasMeasuredTrend: boolean;
}) {
  if (milestones.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/70 bg-white/65 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-950">Estimated timeline</p>
        <span className="text-xs font-medium text-muted-foreground">2 sessions/week</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {milestones.map((milestone) => (
          <div
            key={milestone.speedMph}
            className="rounded-lg border border-border/60 bg-white/70 p-2"
          >
            <p className="text-sm font-semibold tabular-nums text-slate-950">
              {formatMilestoneSpeed(milestone.speedMph)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatTimelineWeeks(milestone.weeks)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {hasMeasuredTrend
          ? "Measured trend will refine these checkpoints as more sessions land."
          : "Planning pace until three sessions give the forecast enough evidence."}
      </p>
    </div>
  );
}

function SpeedProfileUnlocks({
  needsNonDominant,
  needsOverspeed,
}: {
  needsNonDominant: boolean;
  needsOverspeed: boolean;
}) {
  const items = [
    needsNonDominant ? "Non-dominant session logged" : null,
    needsOverspeed ? "Speed-stick session logged" : null,
  ].filter((item): item is string => item !== null);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/70 bg-white/65 p-3">
      <p className="text-sm font-semibold text-slate-950">Additional metrics unlock when:</p>
      <div className="mt-2 grid gap-1.5">
        {items.map((item) => (
          <p key={item} className="text-sm text-muted-foreground">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function SpeedReadingsField() {
  const examples = ["73", "81", "76", "79", "77", "79", "81", "84", "82", "86", "87"];

  return (
    <Field label="Swing speeds">
      <Textarea
        name="speedReadings"
        rows={3}
        placeholder="Paste speeds from Rapsodo: 73 81 76 79 77 79 81 84 82 86 87"
      />
      <div className="flex flex-wrap gap-1.5">
        {examples.map((value, index) => (
          <span
            key={`${value}-${index}`}
            className="rounded-full border border-border/70 bg-white/70 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
          >
            {value}
          </span>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Spaces, commas, or new lines all work. The summary fields below are optional.
      </p>
    </Field>
  );
}

function RCloudConnectCard() {
  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-white/65 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-950">R-Cloud</p>
          <StatusPill tone="amber">Not connected</StatusPill>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Connect when you want automatic R-Speed checks. Manual entry still works.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/rapsodo" prefetch={false}>
          <Cloud aria-hidden="true" />
          Open Rapsodo
        </Link>
      </Button>
    </div>
  );
}

function SpeedTrendChart({ points }: { points: SpeedTrendPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-border/70 bg-white/65">
        <EmptyState
          icon={<TrendingUp className="size-5" aria-hidden="true" />}
          title="Trend starts after two sessions"
          description="Add another speed session to see movement over time."
        />
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const range = Math.max(1, max - min);
  const svgPoints = points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 88 - ((point.value - min) / range) * 72;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-lg border border-border/70 bg-[#111611] p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Average club speed</p>
          <p className="text-xs text-white/65">Session trend</p>
        </div>
        <StatusPill tone="green" className="bg-white/10 text-white ring-white/20">
          {formatGap(points[points.length - 1].value - points[0].value)}
        </StatusPill>
      </div>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="Speed trend chart"
        className="mt-4 h-56 w-full overflow-visible"
      >
        <line x1="0" y1="88" x2="100" y2="88" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
        <line x1="0" y1="16" x2="100" y2="16" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
        <polyline
          points={svgPoints}
          fill="none"
          stroke="#67E8A5"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((point, index) => {
          const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
          const y = 88 - ((point.value - min) / range) * 72;
          return (
            <g key={`${point.label}-${point.value}`}>
              <circle cx={x} cy={y} r="2.2" fill="#F8FAFC" />
              <text
                x={x}
                y={Math.max(10, y - 5)}
                textAnchor="middle"
                className="fill-white text-[4px] font-semibold"
              >
                {Math.round(point.value)}
              </text>
              {index === 0 || index === points.length - 1 ? (
                <text
                  x={x}
                  y="97"
                  textAnchor={index === 0 ? "start" : "end"}
                  className="fill-white/70 text-[4px]"
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ClubSpeedRowCard({ row }: { row: ClubSpeedRow }) {
  const hasTraining = row.trainingSessionCount > 0;
  const hasShots = row.shotSampleSize > 0;

  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-white/65 p-3 lg:grid-cols-[minmax(0,1fr)_repeat(7,minmax(78px,108px))]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">{row.clubLabel}</p>
          {!row.clubId ? <StatusPill tone="amber">Needs club</StatusPill> : null}
          {row.clubId ? (
            <StatusPill tone={transferStatusTone(row.transferStatus)}>
              {transferStatusLabel(row)}
            </StatusPill>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {hasTraining
            ? `${row.trainingSessionCount} speed sessions · ${row.trainingSwingCount} swings`
            : "No speed sessions logged"}
          {hasShots ? ` · ${row.shotSampleSize} shot samples` : " · no shot-speed samples"}
          {row.transferRatioPercent !== null
            ? ` · ${numberFormatter.format(row.transferRatioPercent)}% transfer`
            : ""}
        </p>
      </div>
      <MetricCell label="No-ball avg" value={formatSpeedCompact(row.trainingAvgMph)} />
      <MetricCell label="No-ball PB" value={formatSpeedCompact(row.trainingPbMph)} />
      <MetricCell label="Shot L20" value={formatSpeedCompact(row.shotLast20AvgMph)} />
      <MetricCell label="No-ball gap" value={formatClubTransferGap(row)} />
      <MetricCell label="Shot PB" value={formatSpeedCompact(row.shotPbMph)} />
      <MetricCell
        label={systemTargetLabel(row)}
        value={formatSpeedCompact(row.benchmarkTarget?.targetSpeedMph)}
      />
      <MetricCell
        label="Last"
        value={
          row.trainingLastSessionIso
            ? formatShortDate(row.trainingLastSessionIso)
            : row.latestShotAtIso
              ? formatShortDate(row.latestShotAtIso)
              : "-"
        }
      />
    </div>
  );
}

function PotentialMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-white/65 p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-950">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

function forecastText(points: SpeedTrendPoint[]) {
  if (points.length < 2) {
    return "Need two sessions";
  }

  const first = points[0];
  const last = points[points.length - 1];
  return `${formatGap(last.value - first.value)} across ${points.length} sessions`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date unknown";
  }

  return dateFormatter.format(new Date(value));
}

function formatCarry(value: number | null) {
  return value === null ? "-" : `${value} yd`;
}

function formatGap(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded) < 0.1) {
    return "0.0 mph";
  }

  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} mph`;
}

function formatSignedNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${numberFormatter.format(rounded)}`;
}

function formatNullableGap(value: number | null) {
  return value === null ? "Need trend" : formatGap(value);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTrainingToShotGap(trainingSpeed: number | null, shotSpeed: number | null) {
  if (!trainingSpeed || !shotSpeed) {
    return "Need no-ball and with-ball";
  }

  return formatGap(trainingSpeed - shotSpeed);
}

function formatTransferGap(value: number | null) {
  return value === null ? "Need no-ball and with-ball" : formatGap(value);
}

function formatClubTransferGap(row: ClubSpeedRow) {
  if (row.transferGapMph !== null) {
    return formatGap(row.transferGapMph);
  }

  if (row.trainingSessionCount === 0 && row.shotSampleSize > 0) {
    return "Missing no-ball speed";
  }

  if (row.trainingSessionCount > 0 && row.shotSampleSize === 0) {
    return "Missing shot speed";
  }

  return "Needs speed data";
}

function transferStatusLabel(row: ClubSpeedRow) {
  switch (row.transferStatus) {
    case "Ball faster":
      return "Excellent conversion";
    case "Normal dry gap":
      return "Normal conversion";
    case "Large dry gap":
      return "Conversion gap";
    case "Need both":
      if (row.trainingSessionCount === 0 && row.shotSampleSize > 0) {
        return "Needs speed session";
      }

      if (row.trainingSessionCount > 0 && row.shotSampleSize === 0) {
        return "Needs shot speed";
      }

      return "Needs speed data";
    default:
      return row.transferStatus;
  }
}

function formatTransferRatio(value: number | null) {
  return value === null ? "Need no-ball and with-ball" : `${numberFormatter.format(value)}%`;
}

function strikeEfficiencyLabel(insight: SpeedTransferInsight) {
  if (insight.ratioPercent === null) {
    return "Need no-ball and with-ball";
  }

  if (insight.ratioPercent >= 105) {
    return "Excellent";
  }

  if (insight.ratioPercent >= 97) {
    return "Good";
  }

  if (insight.ratioPercent >= 90) {
    return "Developing";
  }

  return "Leaking speed";
}

function transferStatusTone(status: string): ComponentProps<typeof StatusPill>["tone"] {
  switch (status) {
    case "Matched":
    case "Normal dry gap":
      return "green";
    case "Ball faster":
      return "sky";
    case "Large dry gap":
      return "amber";
    default:
      return "amber";
  }
}

function currentSpeedSourceText(source: "with_ball" | "training" | "none") {
  switch (source) {
    case "with_ball":
      return "With-ball driver";
    case "training":
      return "No-ball speed session";
    default:
      return "No speed data";
  }
}

function speedSavedMessage(value: string) {
  switch (value) {
    case "goals":
      return "Speed goals saved.";
    case "deleted":
      return "Speed session deleted.";
    default:
      return "Speed session saved.";
  }
}

function goalDefault(
  goals: Array<{
    goalKey: string;
    targetSpeedMph: number;
    targetDateIso: string | null;
    notes: string | null;
  }>,
  goalKey: string,
  field: "target" | "date" | "notes",
) {
  const goal = goals.find((item) => item.goalKey === goalKey);

  if (!goal) {
    return "";
  }

  switch (field) {
    case "target":
      return String(goal.targetSpeedMph);
    case "date":
      return goal.targetDateIso ?? "";
    case "notes":
      return goal.notes ?? "";
  }
}

function clubGoalKey(clubId: string) {
  return `club:${clubId}`;
}

function systemTargetPlaceholder(target: ClubSpeedRow["benchmarkTarget"]) {
  return target ? `Recommended goal ${formatSpeedCompact(target.targetSpeedMph)}` : "mph";
}

function systemTargetLabel(row: ClubSpeedRow) {
  return row.benchmarkTarget ? `${row.benchmarkTarget.targetLevelLabel} target` : "System target";
}

function systemTargetCopy(rows: ClubSpeedRow[], clubId: string) {
  const target = rows.find((row) => row.clubId === clubId)?.benchmarkTarget ?? null;

  if (!target) {
    return "Manual override available";
  }

  return `Recommended goal: ${target.targetLevelLabel} ${formatSpeedCompact(target.targetSpeedMph)}`;
}

type SelectedClubTarget = {
  value: number | null;
  label: string;
  detail: string;
};

type SelectedRollingSummary = {
  sevenDayAvgMph: number | null;
  thirtyDayAvgMph: number | null;
  speedGainPercent: number | null;
  monthlyPoints: SpeedMonthPoint[];
};

type SelectedClubContext = {
  row: ClubSpeedRow;
  shortLabel: string;
  sessions: SpeedCentreSession[];
  trend: SpeedTrendPoint[];
  rolling: SelectedRollingSummary;
  prescription: ReturnType<typeof buildSpeedPrescription>;
  target: SelectedClubTarget;
  currentSpeedMph: number | null;
  carryProjection: SpeedCarryProjection;
  transferInsight: SpeedTransferInsight;
  sideSummary: SpeedSideSummary;
  speedMilestones: SpeedMilestone[];
  speedTimeline: SpeedTimelinePoint[];
  confidenceLabel: string;
};

function resolveSelectedClubRow(rows: ClubSpeedRow[], selectedClubId: string | null) {
  if (selectedClubId) {
    const selected = rows.find((row) => row.clubId === selectedClubId);

    if (selected) {
      return selected;
    }
  }

  return rows.find((row) => row.clubType === "driver") ?? rows[0] ?? null;
}

function buildSelectedClubContext(input: {
  row: ClubSpeedRow;
  sessions: SpeedCentreSession[];
  goals: SpeedGoal[];
  futureBag: FutureBagProjectionRow[];
  driverTargetSpeedMph: number | null;
}): SelectedClubContext {
  const sessions = sessionsForClub(input.sessions, input.row.clubId);
  const projection = input.futureBag.find((row) => row.clubId === input.row.clubId) ?? null;
  const shortLabel = shortClubLabel(input.row);
  const target = selectedClubTarget(input.row, input.goals, input.driverTargetSpeedMph);
  const currentSpeedMph = selectedCurrentClubSpeed(input.row, projection);
  const trend = buildSelectedTrendPoints(sessions);
  const rolling = buildSelectedRollingSummary(sessions);
  const carryProjection = buildSelectedCarryProjection({
    row: input.row,
    projection,
    shortLabel,
    currentSpeedMph,
    targetSpeedMph: target.value,
  });
  const transferInsight = buildSelectedTransferInsight(input.row, shortLabel);

  return {
    row: input.row,
    shortLabel,
    sessions,
    trend,
    rolling,
    prescription: buildSpeedPrescription({
      currentSpeedMph,
      targetSpeedMph: target.value,
      thirtyDayAvgMph: rolling.thirtyDayAvgMph,
      sessionsLast7Days: sessionsLastNDays(sessions, 7).length,
    }),
    target,
    currentSpeedMph,
    carryProjection,
    transferInsight,
    sideSummary: buildSelectedSideSummary(sessions),
    speedMilestones: buildSelectedSpeedMilestones({
      currentSpeedMph,
      targetSpeedMph: target.value,
      projection,
    }),
    speedTimeline: buildSpeedTimeline(currentSpeedMph, target.value),
    confidenceLabel: selectedConfidenceLabel(input.row, sessions),
  };
}

function sessionsForClub(sessions: SpeedCentreSession[], clubId: string | null) {
  return sessions.filter((session) =>
    clubId === null ? session.clubId === null : session.clubId === clubId,
  );
}

function shortClubLabel(row: ClubSpeedRow) {
  if (!row.clubId) {
    return "Unassigned";
  }

  return row.clubLabel.split(" - ")[0] ?? row.clubLabel;
}

function selectedCurrentClubSpeed(
  row: ClubSpeedRow,
  projection: FutureBagProjectionRow | null,
) {
  return row.shotLast20AvgMph ?? projection?.currentClubSpeedMph ?? row.trainingAvgMph;
}

function selectedClubTarget(
  row: ClubSpeedRow,
  goals: SpeedGoal[],
  driverTargetSpeedMph: number | null,
): SelectedClubTarget {
  const clubId = row.clubId;
  const clubGoal = clubId ? goals.find((goal) => goal.goalKey === clubGoalKey(clubId)) : null;
  const driverGoal =
    row.clubType === "driver" ? goals.find((goal) => goal.goalKey === "driver_global") : null;
  const savedGoal = clubGoal ?? driverGoal ?? null;

  if (savedGoal) {
    return {
      value: savedGoal.targetSpeedMph,
      label: "Saved target",
      detail: savedGoal.targetDateIso
        ? `Due ${formatShortDate(savedGoal.targetDateIso)}`
        : "Saved override",
    };
  }

  if (row.benchmarkTarget) {
    return {
      value: row.benchmarkTarget.targetSpeedMph,
      label: `${row.benchmarkTarget.targetLevelLabel} target`,
      detail: `${row.benchmarkTarget.currentLevelLabel} now`,
    };
  }

  if (row.clubType === "driver" && driverTargetSpeedMph !== null) {
    return {
      value: driverTargetSpeedMph,
      label: "System target",
      detail: "Driver benchmark",
    };
  }

  return {
    value: null,
    label: "Club target",
    detail: "No benchmark target",
  };
}

function buildSelectedCarryProjection(input: {
  row: ClubSpeedRow;
  projection: FutureBagProjectionRow | null;
  shortLabel: string;
  currentSpeedMph: number | null;
  targetSpeedMph: number | null;
}): SpeedCarryProjection {
  if (!input.projection) {
    return {
      currentCarryYd: null,
      targetCarryYd: null,
      carryGainYd: null,
      yardsPerMph: 0,
      basis: `${input.shortLabel} needs a stock carry number`,
    };
  }

  const currentCarryYd = input.projection.currentCarryYd;

  if (input.currentSpeedMph === null || input.targetSpeedMph === null) {
    return {
      currentCarryYd,
      targetCarryYd: currentCarryYd,
      carryGainYd: null,
      yardsPerMph: input.projection.carryGainPerMph,
      basis: `${input.shortLabel} stock carry`,
    };
  }

  const targetCarryYd = Math.max(
    0,
    Math.round(
      currentCarryYd +
        input.projection.carryGainPerMph * (input.targetSpeedMph - input.currentSpeedMph),
    ),
  );

  return {
    currentCarryYd,
    targetCarryYd,
    carryGainYd: targetCarryYd - currentCarryYd,
    yardsPerMph: input.projection.carryGainPerMph,
    basis: `${input.shortLabel} stock carry`,
  };
}

function buildSelectedTrendPoints(sessions: SpeedCentreSession[]): SpeedTrendPoint[] {
  return [...sessions]
    .filter((session): session is SpeedCentreSession & { avgSpeedMph: number } => {
      return session.avgSpeedMph !== null;
    })
    .slice(0, 12)
    .reverse()
    .map((session) => ({
      label: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(
        new Date(session.sessionDateIso),
      ),
      value: session.avgSpeedMph,
    }));
}

function buildSelectedRollingSummary(sessions: SpeedCentreSession[]): SelectedRollingSummary {
  const sorted = [...sessions]
    .filter((session): session is SpeedCentreSession & { avgSpeedMph: number } => {
      return session.avgSpeedMph !== null;
    })
    .sort(
      (left, right) =>
        new Date(left.sessionDateIso).getTime() - new Date(right.sessionDateIso).getTime(),
    );
  const first = sorted[0] ?? null;
  const last = sorted.at(-1) ?? null;
  const sevenDaySessions = sessionsLastNDays(sorted, 7);
  const thirtyDaySessions = sessionsLastNDays(sorted, 30);
  const monthlyMap = new Map<string, SpeedCentreSession[]>();

  for (const session of sessions) {
    const date = new Date(session.sessionDateIso);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, [...(monthlyMap.get(key) ?? []), session]);
  }

  return {
    sevenDayAvgMph: average(sevenDaySessions.map((session) => session.avgSpeedMph)),
    thirtyDayAvgMph: average(thirtyDaySessions.map((session) => session.avgSpeedMph)),
    speedGainPercent:
      first && last && first.avgSpeedMph > 0
        ? roundOneDecimal(((last.avgSpeedMph - first.avgSpeedMph) / first.avgSpeedMph) * 100)
        : null,
    monthlyPoints: [...monthlyMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-6)
      .map(([key, monthSessions]) => {
        const [year, month] = key.split("-");
        const avgSpeeds = monthSessions
          .map((session) => session.avgSpeedMph)
          .filter((value): value is number => value !== null);
        const maxSpeeds = monthSessions
          .map((session) => session.maxSpeedMph)
          .filter((value): value is number => value !== null);

        return {
          label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
            new Date(Number(year), Number(month) - 1, 1),
          ),
          avgSpeedMph: average(avgSpeeds),
          pbSpeedMph: maxOrNull(maxSpeeds),
          sessionCount: monthSessions.length,
          swingCount: monthSessions.reduce((total, session) => total + session.swingCount, 0),
        };
      }),
  };
}

function sessionsLastNDays<T extends { sessionDateIso: string }>(sessions: T[], days: number) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  return sessions.filter((session) => new Date(session.sessionDateIso).getTime() >= since);
}

function buildSelectedTransferInsight(row: ClubSpeedRow, shortLabel: string): SpeedTransferInsight {
  return {
    gapMph: row.transferGapMph,
    ratioPercent: row.transferRatioPercent,
    status: row.transferStatus,
    coachMessage: selectedTransferCoachMessage(row, shortLabel),
  };
}

function selectedTransferCoachMessage(row: ClubSpeedRow, shortLabel: string) {
  if (row.trainingSessionCount === 0 && row.shotSampleSize === 0) {
    return `No ${shortLabel} speed baseline yet. Add shots or a no-ball speed session before judging speed development for this club.`;
  }

  if (row.trainingSessionCount === 0 && row.shotSampleSize > 0) {
    return `With-ball ${shortLabel} speed exists. A no-ball speed session with this club will show whether training speed is transferring.`;
  }

  if (row.trainingSessionCount > 0 && row.shotSampleSize === 0) {
    return `No-ball ${shortLabel} speed is logged, but there are no with-ball speed samples yet. Keep it separate until shot data confirms transfer.`;
  }

  if (row.transferGapMph !== null && row.transferGapMph < -2) {
    return `Your with-ball ${shortLabel} speed is currently faster than the no-ball speed session, so treat that session as a baseline rather than a playing-speed ceiling.`;
  }

  if (row.transferGapMph !== null && Math.abs(row.transferGapMph) <= 3) {
    return `No-ball and with-ball ${shortLabel} speeds are matched closely enough that speed work is transferring well.`;
  }

  if (row.transferGapMph !== null && row.transferGapMph <= 7) {
    return `No-ball ${shortLabel} speed is ahead of with-ball speed, which can be normal when strike, target, or ball focus holds speed back.`;
  }

  return `No-ball ${shortLabel} speed is well ahead of with-ball speed. The next gain is converting speed while keeping strike quality.`;
}

function buildSelectedSideSummary(sessions: SpeedCentreSession[]): SpeedSideSummary {
  const dominant = sessions.filter(
    (session) => session.handedness === "dominant" || session.handedness === "both",
  );
  const nonDominant = sessions.filter(
    (session) => session.handedness === "non_dominant" || session.handedness === "both",
  );
  const overspeed = sessions.filter((session) => session.implementKind !== "club");
  const dominantAvgMph = average(avgSessionSpeeds(dominant));
  const nonDominantAvgMph = average(avgSessionSpeeds(nonDominant));
  const overspeedMaxMph = maxOrNull(maxSessionSpeeds(overspeed));
  const gamerMaxMph = maxOrNull(maxSessionSpeeds(sessions.filter((session) => session.implementKind === "club")));

  return {
    dominantAvgMph,
    dominantMaxMph: maxOrNull(maxSessionSpeeds(dominant)),
    nonDominantAvgMph,
    nonDominantMaxMph: maxOrNull(maxSessionSpeeds(nonDominant)),
    sideBalancePercent:
      dominantAvgMph && nonDominantAvgMph
        ? Math.round((nonDominantAvgMph / dominantAvgMph) * 100)
        : null,
    overspeedAvgMph: average(avgSessionSpeeds(overspeed)),
    overspeedMaxMph,
    overspeedRatio:
      overspeedMaxMph && gamerMaxMph ? Math.round((overspeedMaxMph / gamerMaxMph) * 100) / 100 : null,
  };
}

function avgSessionSpeeds(sessions: SpeedCentreSession[]) {
  return sessions
    .map((session) => session.avgSpeedMph)
    .filter((value): value is number => value !== null);
}

function maxSessionSpeeds(sessions: SpeedCentreSession[]) {
  return sessions
    .map((session) => session.maxSpeedMph)
    .filter((value): value is number => value !== null);
}

function buildSelectedSpeedMilestones(input: {
  currentSpeedMph: number | null;
  targetSpeedMph: number | null;
  projection: FutureBagProjectionRow | null;
}): SpeedMilestone[] {
  if (input.currentSpeedMph === null || !input.projection) {
    return [];
  }

  const currentSpeedMph = input.currentSpeedMph;
  const projection = input.projection;
  const targetCandidate =
    input.targetSpeedMph === null ? null : Math.round(input.targetSpeedMph);
  const generatedSpeeds = uniqueNumbers([
    targetCandidate,
    Math.ceil(currentSpeedMph + 2),
    Math.ceil(currentSpeedMph + 5),
    Math.ceil(currentSpeedMph + 8),
    Math.ceil(currentSpeedMph + 11),
  ]).filter((speed) => speed > currentSpeedMph + 0.2);

  return generatedSpeeds
    .sort((left, right) => left - right)
    .slice(0, 4)
    .map((speed) => {
      const projectedCarryYd = Math.max(
        0,
        Math.round(
          projection.currentCarryYd +
            projection.carryGainPerMph * (speed - currentSpeedMph),
        ),
      );

      return {
        speedMph: speed,
        projectedCarryYd,
        carryGainYd: projectedCarryYd - projection.currentCarryYd,
        label:
          input.targetSpeedMph !== null && Math.round(input.targetSpeedMph) === speed
            ? "Recommended goal"
            : "Speed checkpoint",
      };
    });
}

function selectedPotentialFocus(context: SelectedClubContext) {
  if (context.row.trainingSessionCount === 0 && context.row.shotSampleSize === 0) {
    return `Add ${context.shortLabel} speed data before projecting gains for this club.`;
  }

  if (context.row.trainingSessionCount === 0) {
    return `With-ball ${context.shortLabel} speed is available. Add a no-ball session to measure the training baseline.`;
  }

  if (context.row.shotSampleSize === 0) {
    return `No-ball ${context.shortLabel} speed is logged. Add shot-speed samples before treating the carry projection as reliable.`;
  }

  if (context.transferInsight.ratioPercent !== null && context.transferInsight.ratioPercent >= 105) {
    return `With-ball ${context.shortLabel} speed is already ahead of the no-ball baseline, so use playing speed as the reference for now.`;
  }

  if (context.transferInsight.gapMph !== null && context.transferInsight.gapMph > 7) {
    return `No-ball ${context.shortLabel} speed is ahead of playing speed. Blend speed work with strike quality so the gain reaches the ball.`;
  }

  return `${context.shortLabel} no-ball and with-ball speeds are close enough to use this carry projection as a practical speed target.`;
}

function selectedConfidenceLabel(row: ClubSpeedRow, sessions: SpeedCentreSession[]) {
  if (sessions.length >= 3) {
    return "3-session trend";
  }

  if (sessions.length > 0) {
    const remaining = 3 - sessions.length;
    return `Needs ${remaining} more ${remaining === 1 ? "session" : "sessions"}`;
  }

  if (row.shotSampleSize > 0) {
    return "Needs no-ball session";
  }

  return "Needs club data";
}

function formatTargetGap(currentSpeedMph: number | null, targetSpeedMph: number | null) {
  if (currentSpeedMph === null || targetSpeedMph === null) {
    return "Set target";
  }

  return formatGap(targetSpeedMph - currentSpeedMph);
}

function maxOrNull(values: number[]) {
  return values.length > 0 ? Math.max(...values) : null;
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

type SpeedMilestone = {
  speedMph: number;
  projectedCarryYd: number;
  carryGainYd: number;
  label: string;
};

type SpeedTimelinePoint = {
  speedMph: number;
  weeks: number;
};

function buildSpeedMilestones(input: {
  currentSpeedMph: number | null;
  targetSpeedMph: number | null;
  carryProjection: SpeedCarryProjection;
}): SpeedMilestone[] {
  if (
    input.currentSpeedMph === null ||
    input.carryProjection.currentCarryYd === null ||
    input.carryProjection.yardsPerMph <= 0
  ) {
    return [];
  }

  const currentSpeedMph = input.currentSpeedMph;
  const currentCarryYd = input.carryProjection.currentCarryYd;
  const yardsPerMph = input.carryProjection.yardsPerMph;
  const targetCandidate =
    input.targetSpeedMph === null ? null : Math.round(input.targetSpeedMph);
  const preferredSpeeds = uniqueNumbers([92, 95, targetCandidate, 100]).filter(
    (speed) => speed > currentSpeedMph + 0.2,
  );
  const generatedSpeeds = uniqueNumbers([
    Math.ceil(currentSpeedMph + 3),
    Math.ceil(currentSpeedMph + 6),
    Math.ceil(currentSpeedMph + 9),
    Math.ceil(currentSpeedMph + 12),
  ]).filter((speed) => speed > currentSpeedMph + 0.2);
  const selectedSpeeds = [...preferredSpeeds];

  for (const speed of generatedSpeeds) {
    if (selectedSpeeds.length >= 4) {
      break;
    }

    if (!selectedSpeeds.includes(speed)) {
      selectedSpeeds.push(speed);
    }
  }

  const sortedMilestoneSpeeds = selectedSpeeds
    .sort((left, right) => left - right)
    .slice(0, 4);

  return sortedMilestoneSpeeds.map((speed) => {
    const projectedCarryYd = Math.round(speed * yardsPerMph);

    return {
      speedMph: speed,
      projectedCarryYd,
      carryGainYd: projectedCarryYd - currentCarryYd,
      label:
        input.targetSpeedMph !== null && Math.round(input.targetSpeedMph) === speed
          ? "Recommended goal"
          : "Speed checkpoint",
    };
  });
}

function buildSpeedTimeline(
  currentSpeedMph: number | null,
  targetSpeedMph: number | null,
): SpeedTimelinePoint[] {
  if (currentSpeedMph === null) {
    return [];
  }

  const targetCandidate = targetSpeedMph === null ? null : Math.round(targetSpeedMph);
  const preferredSpeeds = uniqueNumbers([92, 95, targetCandidate]).filter(
    (speed) => speed > currentSpeedMph + 0.2,
  );
  const generatedSpeeds = uniqueNumbers([
    Math.ceil(currentSpeedMph + 3),
    Math.ceil(currentSpeedMph + 6),
    Math.ceil(currentSpeedMph + 9),
  ]).filter((speed) => speed > currentSpeedMph + 0.2);
  const selectedSpeeds = [...preferredSpeeds];

  for (const speed of generatedSpeeds) {
    if (selectedSpeeds.length >= 3) {
      break;
    }

    if (!selectedSpeeds.includes(speed)) {
      selectedSpeeds.push(speed);
    }
  }

  return selectedSpeeds
    .sort((left, right) => left - right)
    .slice(0, 3)
    .map((speed) => ({
      speedMph: speed,
      weeks: Math.max(2, Math.ceil((speed - currentSpeedMph) / 0.5)),
    }));
}

function uniqueNumbers(values: Array<number | null>) {
  return [...new Set(values.filter((value): value is number => value !== null))];
}

function formatMilestoneSpeed(value: number) {
  return `${numberFormatter.format(value)} mph`;
}

function formatTimelineWeeks(weeks: number) {
  return weeks <= 1 ? "About 1 week" : `About ${weeks} weeks`;
}

function formatCarryGain(value: number) {
  return `${value >= 0 ? "+" : ""}${value} yd`;
}

function firstSearchParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw || null;
}

function todayDateInput() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}
