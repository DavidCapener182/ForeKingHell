"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Target, TrendingUp } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { calculateSpeedIndex, formatSpeed, formatSpeedCompact } from "@/lib/speed-training";
import type { ClubSpeedRow, FutureBagProjectionRow, SpeedGoal } from "@/lib/speed-training-data";
import { cn } from "@/lib/utils";

type ClubSpeedFocusProps = {
  rows: ClubSpeedRow[];
  goals: SpeedGoal[];
  futureBag: FutureBagProjectionRow[];
  driverTargetSpeedMph: number | null;
  selectedClubId: string | null;
};

type Tone = "amber" | "green" | "sky" | "slate";

type ClubTarget = {
  value: number | null;
  label: string;
  detail: string;
  source: "saved" | "system" | "fallback" | "none";
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function ClubSpeedFocus({
  rows,
  goals,
  futureBag,
  driverTargetSpeedMph,
  selectedClubId,
}: ClubSpeedFocusProps) {
  const router = useRouter();
  const selectedKeyFromProps = useMemo(
    () => selectedClubKey(rows, selectedClubId),
    [rows, selectedClubId],
  );
  const selectedRow =
    rows.find((row) => clubRowKey(row) === selectedKeyFromProps) ?? rows[0] ?? null;

  if (!selectedRow) {
    return null;
  }

  const projection = futureBag.find((row) => row.clubId === selectedRow.clubId) ?? null;
  const target = selectedClubTarget(selectedRow, goals, driverTargetSpeedMph);
  const currentSpeed = currentClubSpeed(selectedRow, projection);
  const speedIndex = calculateSpeedIndex(currentSpeed.value, target.value);
  const carry = carryProjection(selectedRow, projection, target.value);
  const carryValue = carry.targetCarryYd === null ? "Need stock" : `${carry.targetCarryYd} yd`;
  const carryDetail = carryDetailText(carry, target.value);

  return (
    <div className="grid gap-4 p-4">
      <div className="overflow-x-auto pb-1">
        <ToggleGroup
          type="single"
          value={clubRowKey(selectedRow)}
          onValueChange={(value) => {
            const nextRow = rows.find((row) => clubRowKey(row) === value);

            if (nextRow) {
              replaceSelectedClub(router, nextRow.clubId);
            }
          }}
          variant="outline"
          spacing={2}
          aria-label="Speed club focus"
          className="min-w-max"
        >
          {rows.map((row) => (
            <ToggleGroupItem
              key={clubRowKey(row)}
              value={clubRowKey(row)}
              aria-label={`Focus ${shortClubLabel(row)} speed evidence`}
              className="h-8 max-w-[180px] justify-start overflow-hidden px-2.5 text-xs"
            >
              <span className="truncate">{shortClubLabel(row)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Selected club
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold tracking-normal text-foreground">
                {selectedRow.clubLabel}
              </h2>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                transferToneClass(selectedRow.transferStatus),
              )}
            >
              {transferStatusLabel(selectedRow)}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <FocusMetric
              label="Current average"
              value={formatSpeed(currentSpeed.value)}
              detail={currentSpeed.detail}
              tone="sky"
            />
            <FocusMetric
              label="No-ball speed"
              value={formatSpeed(selectedRow.trainingAvgMph)}
              detail={
                selectedRow.trainingSessionCount > 0
                  ? `${selectedRow.trainingSessionCount} no-ball sessions`
                  : "No speed sessions"
              }
              tone="slate"
            />
            <FocusMetric
              label="With ball"
              value={formatSpeed(selectedRow.shotLast20AvgMph)}
              detail={
                selectedRow.shotSampleSize > 0
                  ? `${selectedRow.shotSampleSize} shot samples`
                  : "No shot-speed samples"
              }
              tone="green"
            />
            <FocusMetric
              label="PB speed"
              value={formatSpeed(bestClubSpeed(selectedRow))}
              detail={bestSpeedDetail(selectedRow)}
              tone="amber"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <FocusMetric
              label={target.label}
              value={formatSpeed(target.value)}
              detail={target.detail}
              tone={target.value === null ? "amber" : "green"}
            />
            <FocusMetric
              label="Speed index"
              value={
                speedIndex.value === null ? "Set target" : `${Math.round(speedIndex.value * 100)}%`
              }
              detail={speedIndex.label}
              tone={speedIndex.tone}
            />
            <FocusMetric
              label="Speed conversion"
              value={formatTransferRatio(selectedRow)}
              detail={transferDetail(selectedRow)}
              tone={transferTone(selectedRow.transferStatus)}
            />
            <FocusMetric
              label="Carry potential"
              value={carryValue}
              detail={carryDetail}
              tone="sky"
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-border/70 bg-card/65 p-4">
          <div className="flex items-center gap-2">
            <Gauge className="size-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">Club readout</p>
          </div>
          <div className="grid gap-2">
            <MiniPair label="No-ball PB" value={formatSpeedCompact(selectedRow.trainingPbMph)} />
            <MiniPair label="Shot PB" value={formatSpeedCompact(selectedRow.shotPbMph)} />
            <MiniPair
              label="30-day shot avg"
              value={formatSpeedCompact(selectedRow.shotThirtyDayAvgMph)}
            />
            <MiniPair
              label="Current carry"
              value={projection ? `${projection.currentCarryYd} yd` : "No stock"}
            />
          </div>
          <div className="rounded-lg border border-border/70 bg-card/70 p-3 text-sm leading-6 text-muted-foreground">
            {clubInsight(selectedRow, target, carry)}
          </div>
        </div>
      </div>
    </div>
  );
}

function FocusMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/65 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        {tone === "green" ? (
          <TrendingUp
            className="size-3.5 text-[var(--status-success-foreground)]"
            aria-hidden="true"
          />
        ) : tone === "amber" ? (
          <Target className="size-3.5 text-[var(--status-warning-foreground)]" aria-hidden="true" />
        ) : null}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className={cn("mt-1 text-xs leading-5", metricDetailClass(tone))}>{detail}</p>
    </div>
  );
}

function MiniPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function defaultClubKey(rows: ClubSpeedRow[]) {
  const driver = rows.find((row) => row.clubType === "driver");
  return clubRowKey(driver ?? rows[0] ?? null);
}

function selectedClubKey(rows: ClubSpeedRow[], selectedClubId: string | null) {
  if (selectedClubId) {
    const selected = rows.find((row) => row.clubId === selectedClubId);

    if (selected) {
      return clubRowKey(selected);
    }
  }

  return defaultClubKey(rows);
}

function clubRowKey(row: ClubSpeedRow | null) {
  return row?.clubId ?? "__unassigned";
}

function replaceSelectedClub(router: ReturnType<typeof useRouter>, clubId: string | null) {
  const nextUrl = new URL(window.location.href);

  if (clubId) {
    nextUrl.searchParams.set("club", clubId);
  } else {
    nextUrl.searchParams.delete("club");
  }

  nextUrl.searchParams.delete("speed_error");
  nextUrl.searchParams.delete("speed_saved");
  router.replace(`${nextUrl.pathname}${nextUrl.search}`, { scroll: false });
}

function shortClubLabel(row: ClubSpeedRow) {
  if (!row.clubId) {
    return "Unassigned";
  }

  return row.clubLabel.split(" - ")[0] ?? row.clubLabel;
}

function selectedClubTarget(
  row: ClubSpeedRow,
  goals: SpeedGoal[],
  driverTargetSpeedMph: number | null,
): ClubTarget {
  const clubGoal = row.clubId ? goals.find((goal) => goal.goalKey === `club:${row.clubId}`) : null;
  const driverGoal =
    row.clubType === "driver" ? goals.find((goal) => goal.goalKey === "driver_global") : null;
  const savedGoal = clubGoal ?? driverGoal ?? null;

  if (savedGoal) {
    return {
      value: savedGoal.targetSpeedMph,
      label: "Saved target",
      detail: savedTargetDetail(row, savedGoal.targetDateIso),
      source: "saved",
    };
  }

  if (row.benchmarkTarget) {
    return {
      value: row.benchmarkTarget.targetSpeedMph,
      label: `${row.benchmarkTarget.targetLevelLabel} target`,
      detail: `${row.benchmarkTarget.currentLevelLabel} now · recent-average basis`,
      source: "system",
    };
  }

  if (row.clubType === "driver" && driverTargetSpeedMph !== null) {
    return {
      value: driverTargetSpeedMph,
      label: "System target",
      detail: "Driver benchmark",
      source: "fallback",
    };
  }

  return {
    value: null,
    label: "Club target",
    detail: "No benchmark target",
    source: "none",
  };
}

function currentClubSpeed(row: ClubSpeedRow, projection: FutureBagProjectionRow | null) {
  if (row.shotLast20AvgMph !== null) {
    return {
      value: row.shotLast20AvgMph,
      detail: "Last 20 with-ball avg",
    };
  }

  if (projection?.currentClubSpeedMph !== null && projection?.currentClubSpeedMph !== undefined) {
    return {
      value: projection.currentClubSpeedMph,
      detail: "Last 20 shot avg",
    };
  }

  return {
    value: row.trainingAvgMph,
    detail: row.trainingAvgMph === null ? "Need club data" : "Latest no-ball session avg",
  };
}

function bestClubSpeed(row: ClubSpeedRow) {
  const speeds = [row.trainingPbMph, row.shotPbMph].filter(
    (value): value is number => value !== null,
  );

  return speeds.length === 0 ? null : Math.max(...speeds);
}

function bestSpeedDetail(row: ClubSpeedRow) {
  const noBallPb = row.trainingPbMph;
  const shotPb = row.shotPbMph;

  if (noBallPb === null && shotPb === null) {
    return "No PB logged";
  }

  if ((noBallPb ?? 0) >= (shotPb ?? 0)) {
    return "No-ball PB · single swing";
  }

  return "With-ball PB · single swing";
}

function carryProjection(
  row: ClubSpeedRow,
  projection: FutureBagProjectionRow | null,
  targetSpeedMph: number | null,
) {
  if (!projection) {
    return {
      targetCarryYd: null,
      gainYd: null,
    };
  }

  const baselineSpeed = projection.currentClubSpeedMph ?? row.shotLast20AvgMph;

  if (targetSpeedMph === null || baselineSpeed === null) {
    return {
      targetCarryYd: projection.currentCarryYd,
      gainYd: null,
    };
  }

  const targetCarryYd = Math.max(
    0,
    Math.round(
      projection.currentCarryYd + projection.carryGainPerMph * (targetSpeedMph - baselineSpeed),
    ),
  );

  return {
    targetCarryYd,
    gainYd: targetCarryYd - projection.currentCarryYd,
  };
}

function carryDetailText(carry: ReturnType<typeof carryProjection>, targetSpeedMph: number | null) {
  if (carry.targetCarryYd === null) {
    return "No stock projection";
  }

  if (targetSpeedMph === null || carry.gainYd === null) {
    return "Current stock carry";
  }

  return `${carry.gainYd >= 0 ? "+" : ""}${carry.gainYd} yd at target`;
}

function clubInsight(
  row: ClubSpeedRow,
  target: ClubTarget,
  carry: ReturnType<typeof carryProjection>,
) {
  if (row.trainingSessionCount === 0 && row.shotSampleSize === 0) {
    return "No speed baseline for this club yet. Once shots or speed sessions exist, this panel will split no-ball training speed from with-ball speed.";
  }

  if (row.trainingSessionCount > 0 && row.shotSampleSize === 0) {
    return "No-ball speed is logged, but there is no with-ball speed for this club yet. Keep it separate until shot data confirms transfer.";
  }

  if (row.trainingSessionCount === 0 && row.shotSampleSize > 0) {
    return "With-ball speed exists. A no-ball speed session with this club will show whether training speed is transferring.";
  }

  if (row.transferGapMph !== null && row.transferGapMph > 7) {
    return "No-ball speed is well ahead of with-ball speed. The next gain is converting the speed while keeping strike quality.";
  }

  if (row.transferGapMph !== null && row.transferGapMph < -2) {
    return "With-ball speed is ahead of the no-ball session baseline. Use this as the playing-speed reference for the club.";
  }

  if (target.value !== null && carry.gainYd !== null) {
    const targetSource = target.source === "saved" ? "saved target" : "system target";

    return `At the ${targetSource}, this club projects to ${carry.targetCarryYd} yd, a ${carry.gainYd >= 0 ? "+" : ""}${carry.gainYd} yd move from the current stock number.`;
  }

  if (target.source === "system") {
    return "The system target is the next benchmark speed from the same ladder used on the bag page. Progress is judged against the recent average, not one peak swing.";
  }

  return "No-ball and with-ball speeds are close enough to compare. Add a manual override if this club needs a custom target.";
}

function savedTargetDetail(row: ClubSpeedRow, targetDateIso: string | null) {
  const dueText = targetDateIso ? `Due ${formatShortDate(targetDateIso)} · ` : "";

  if (!row.benchmarkTarget) {
    return `${dueText}Saved override`;
  }

  return `${dueText}${row.benchmarkTarget.targetLevelLabel} target ${formatSpeedCompact(row.benchmarkTarget.targetSpeedMph)} · saved override`;
}

function transferDetail(row: ClubSpeedRow) {
  if (row.transferRatioPercent === null) {
    return missingTransferDetail(row);
  }

  return `No-ball to with-ball ${formatGap(row.transferGapMph)}`;
}

function formatTransferRatio(row: ClubSpeedRow) {
  if (row.transferRatioPercent === null) {
    return missingTransferValue(row);
  }

  return `${numberFormatter.format(row.transferRatioPercent)}%`;
}

function formatGap(value: number | null) {
  if (value === null) {
    return "Missing data";
  }

  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded) < 0.1) {
    return "0.0 mph";
  }

  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} mph`;
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
      return missingTransferValue(row);
    default:
      return row.transferStatus;
  }
}

function missingTransferValue(row: ClubSpeedRow) {
  if (row.trainingSessionCount === 0 && row.shotSampleSize > 0) {
    return "Needs speed session";
  }

  if (row.trainingSessionCount > 0 && row.shotSampleSize === 0) {
    return "Needs shot speed";
  }

  return "Needs speed data";
}

function missingTransferDetail(row: ClubSpeedRow) {
  if (row.trainingSessionCount === 0 && row.shotSampleSize > 0) {
    return "Missing no-ball speed";
  }

  if (row.trainingSessionCount > 0 && row.shotSampleSize === 0) {
    return "Missing with-ball speed";
  }

  return "Need no-ball and with-ball speeds";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function transferTone(status: string): Tone {
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

function transferToneClass(status: string) {
  switch (transferTone(status)) {
    case "green":
      return "bg-[var(--status-success-surface)] text-[var(--status-success-foreground)] ring-[var(--status-success-border)]";
    case "sky":
      return "bg-[var(--status-information-surface)] text-[var(--status-information-foreground)] ring-[var(--status-information-border)]";
    case "amber":
      return "bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)] ring-[var(--status-warning-border)]";
    default:
      return "bg-muted text-muted-foreground ring-border";
  }
}

function metricDetailClass(tone: Tone) {
  switch (tone) {
    case "green":
      return "text-[var(--status-success-foreground)]";
    case "sky":
      return "text-[var(--status-information-foreground)]";
    case "amber":
      return "text-[var(--status-warning-foreground)]";
    default:
      return "text-muted-foreground";
  }
}
