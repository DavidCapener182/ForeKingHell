"use client";

import { useMemo, useState } from "react";
import { Activity, Gauge, Target, Trophy, Wind, type LucideIcon } from "lucide-react";

import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
} from "@/components/app/ios-mobile";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatClubType } from "@/lib/club-format";
import {
  formatStoredApexFeet,
  formatStoredLateralYards,
  formatStoredSpeedMph,
  formatStoredYards,
  type DistanceUnitPreference,
} from "@/lib/units";
import { cn } from "@/lib/utils";

export type LongestShot = {
  id: string;
  clubId: string;
  clubType: string;
  brandModel: string;
  accent: string;
  sessionId: string;
  sessionSource: string;
  sessionFileName: string | null;
  qualityTag: string | null;
  shotCategory: string | null;
  recordTrust: "trusted" | "raw";
  rawMaximumYd: number | null;
  shotNumber: number | null;
  shotAt: string;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  descentAngleDeg: number | null;
  spinRate: number | null;
  spinAxis: number | null;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function LongestShotsSection({
  shots,
  preferredUnits,
}: {
  shots: LongestShot[];
  preferredUnits: DistanceUnitPreference;
}) {
  const [selectedShotId, setSelectedShotId] = useState(shots[0]?.id ?? "");
  const selectedShot = shots.find((shot) => shot.id === selectedShotId) ?? shots[0] ?? null;

  if (shots.length === 0 || !selectedShot) {
    return null;
  }

  return (
    <section className="space-y-4">
      <Card className="premium-card">
        <CardHeader className="hidden gap-3 lg:flex">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl tracking-normal">
                <Trophy className="size-5 text-amber-500" />
                Longest shots
              </CardTitle>
              <CardDescription>
                Trusted all-time imported records, with any larger raw maximum called out rather
                than silently promoted.
              </CardDescription>
            </div>
            <Badge variant="outline">{shots.length} clubs</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="hidden gap-2 lg:grid lg:grid-cols-4">
            {shots.map((shot) => (
              <LongestShotButton
                key={shot.id}
                shot={shot}
                preferredUnits={preferredUnits}
                selected={shot.id === selectedShot.id}
                onClick={() => setSelectedShotId(shot.id)}
              />
            ))}
          </div>

          <MobileLongestShotSelector
            shots={shots}
            selectedShot={selectedShot}
            preferredUnits={preferredUnits}
            onSelect={setSelectedShotId}
          />

          <ShotSimulator shot={selectedShot} preferredUnits={preferredUnits} />
          <ChartAccessibleFallback
            title="Longest shots"
            summary={longestShotsSummary(shots, selectedShot, preferredUnits)}
            columns={[
              { key: "club", label: "Club" },
              { key: "model", label: "Model" },
              { key: "shot", label: "Shot" },
              { key: "date", label: "Date" },
              { key: "total", label: "Total" },
              { key: "carry", label: "Carry" },
              { key: "offline", label: "Offline" },
              { key: "ballSpeed", label: "Ball speed" },
              { key: "launch", label: "Launch" },
              { key: "apex", label: "Apex" },
            ]}
            rows={longestShotsRows(shots, selectedShot.id, preferredUnits)}
            className="hidden lg:block"
          />
        </CardContent>
      </Card>
    </section>
  );
}

function MobileLongestShotSelector({
  shots,
  selectedShot,
  preferredUnits,
  onSelect,
}: {
  shots: LongestShot[];
  selectedShot: LongestShot;
  preferredUnits: DistanceUnitPreference;
  onSelect: (shotId: string) => void;
}) {
  const warning = recordWarning(selectedShot, preferredUnits);

  return (
    <div className="space-y-3 lg:hidden" data-mobile-longest-selector>
      <label className="block text-[13px] font-semibold uppercase tracking-[0.035em] text-muted-foreground">
        Club record
        <Select value={selectedShot.id} onValueChange={onSelect}>
          <SelectTrigger
            className="mt-1.5 min-h-11 w-full text-base"
            aria-label="Choose a club record to replay"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {shots.map((shot) => (
              <SelectItem key={shot.id} value={shot.id}>
                {formatClubType(shot.clubType)} ·{" "}
                {formatStoredYards(shotDistance(shot), preferredUnits)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <IOSGroupedList label="Selected longest shot summary">
        <IOSListRow
          label={formatClubType(selectedShot.clubType)}
          value={formatStoredYards(shotDistance(selectedShot), preferredUnits)}
          detail={`${selectedShot.brandModel} · ${formatDate(selectedShot.shotAt)}`}
          status={
            <IOSInlineStatus
              label={
                selectedShot.recordTrust === "trusted" ? "Trusted personal best" : "Raw maximum"
              }
              tone={selectedShot.recordTrust === "trusted" ? "positive" : "attention"}
            />
          }
        />
        <IOSListRow
          label="Carry"
          value={formatStoredYards(selectedShot.carryYd, preferredUnits)}
          detail={`Offline ${formatStoredLateralYards(selectedShot.sideCarryYd, preferredUnits)}`}
        />
      </IOSGroupedList>

      {warning ? (
        <Alert data-mobile-record-warning>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function LongestShotButton({
  shot,
  preferredUnits,
  selected,
  onClick,
}: {
  shot: LongestShot;
  preferredUnits: DistanceUnitPreference;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "apple-panel-strong flex min-h-14 items-center gap-3 p-2.5 text-left transition-colors hover:border-emerald-300",
        selected && "border-emerald-300 bg-background",
      )}
      style={{
        borderColor: selected ? shot.accent : "#e5e7eb",
        boxShadow: selected ? `0 0 0 1px ${shot.accent}` : undefined,
        outline: "none",
      }}
    >
      <span
        className="grid size-8 shrink-0 place-items-center rounded-md text-xs font-semibold text-white"
        style={{ background: shot.accent }}
      >
        {formatClubType(shot.clubType).slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-foreground">
          {formatClubType(shot.clubType)}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{shot.brandModel}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold text-foreground">
          {formatStoredYards(shot.totalYd ?? shot.carryYd, preferredUnits)}
        </span>
        <span className="block text-xs text-muted-foreground">
          {shot.recordTrust === "trusted" ? "Trusted" : "Raw only"} / {formatDate(shot.shotAt)}
        </span>
      </span>
    </button>
  );
}

function ShotSimulator({
  shot,
  preferredUnits,
}: {
  shot: LongestShot;
  preferredUnits: DistanceUnitPreference;
}) {
  const geometry = useMemo(() => buildShotGeometry(shot), [shot]);

  return (
    <div className="apple-panel-strong grid overflow-hidden lg:grid-cols-[minmax(320px,560px)_minmax(320px,1fr)]">
      <div className="grid h-[58vh] min-h-[420px] max-h-[600px] place-items-center bg-[#143321] p-3">
        <svg
          viewBox="0 0 644 1024"
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label="Top-down longest-shot distance simulation"
        >
          <defs>
            <filter id="shotGlowLong" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <style>
            {`
              .longest-shot-tracer {
                stroke-dasharray: 720;
                stroke-dashoffset: 720;
                animation: longestShotTrace 2.6s ease-out infinite;
              }
              .longest-shot-pulse {
                transform-origin: center;
                animation: longestShotPulse 2.6s ease-out infinite;
              }
              @keyframes longestShotTrace {
                0% { stroke-dashoffset: 720; opacity: 0.2; }
                55% { stroke-dashoffset: 0; opacity: 1; }
                100% { stroke-dashoffset: 0; opacity: 0.7; }
              }
              @keyframes longestShotPulse {
                0%, 54% { transform: scale(0.75); opacity: 0; }
                72% { transform: scale(1.35); opacity: 0.55; }
                100% { transform: scale(1.7); opacity: 0; }
              }
              @media (prefers-reduced-motion: reduce) {
                .longest-shot-tracer,
                .longest-shot-pulse {
                  animation: none !important;
                }
                .longest-shot-tracer {
                  stroke-dashoffset: 0;
                }
              }
            `}
          </style>

          <image
            href="/assets/hole-350-aerial.jpg"
            x="0"
            y="0"
            width="644"
            height="1024"
            preserveAspectRatio="xMidYMid slice"
          />
          <rect x="0" y="0" width="644" height="1024" fill="#020617" opacity="0.08" />

          {[50, 100, 150, 200, 250, 300, 350].map((yard) => {
            const y = geometry.tee.y - (yard / geometry.maxDistance) * geometry.playHeight;
            const arcWidth = 70 + (yard / 350) * 248;
            return (
              <g key={yard} opacity="0.58">
                <path
                  d={`M ${geometry.tee.x - arcWidth} ${y + 22} Q ${geometry.tee.x} ${y - 24} ${geometry.tee.x + arcWidth} ${y + 22}`}
                  fill="none"
                  stroke="#ffffff"
                  strokeDasharray="10 10"
                  strokeWidth="2.5"
                />
                <text
                  x={Math.min(592, geometry.tee.x + arcWidth + 12)}
                  y={y + 12}
                  fill="#f8fafc"
                  fontSize="18"
                  fontWeight="700"
                >
                  {formatStoredYards(yard, preferredUnits, 0)}
                </text>
              </g>
            );
          })}

          <path
            d={geometry.tracerPath}
            fill="none"
            stroke={shot.accent}
            strokeWidth="6"
            strokeLinecap="round"
            className="longest-shot-tracer"
            filter="url(#shotGlowLong)"
          />
          <path
            d={`M ${geometry.carry.x} ${geometry.carry.y} Q ${geometry.carry.x + geometry.rollControl} ${geometry.carry.y - 10} ${geometry.total.x} ${geometry.total.y}`}
            fill="none"
            stroke="#f8fafc"
            strokeDasharray="8 9"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.78"
          />
          <circle
            cx={geometry.tee.x}
            cy={geometry.tee.y}
            r="8"
            fill="#f8fafc"
            stroke="#111827"
            strokeWidth="3"
          />
          <circle
            cx={geometry.carry.x}
            cy={geometry.carry.y}
            r="10"
            fill={shot.accent}
            stroke="#111827"
            strokeWidth="3"
          />
          <circle
            cx={geometry.total.x}
            cy={geometry.total.y}
            r="15"
            fill="none"
            stroke={shot.accent}
            strokeWidth="4"
            className="longest-shot-pulse"
          />
          <circle
            cx={geometry.total.x}
            cy={geometry.total.y}
            r="7"
            fill="#f8fafc"
            stroke={shot.accent}
            strokeWidth="3"
          />

          <Label
            x={geometry.carryLabel.x}
            y={geometry.carryLabel.y}
            title="Carry"
            value={formatStoredYards(shot.carryYd, preferredUnits)}
          />
          <Label
            x={geometry.totalLabel.x}
            y={geometry.totalLabel.y}
            title="Total"
            value={formatStoredYards(shot.totalYd ?? shot.carryYd, preferredUnits)}
          />
          <Label
            x={geometry.sideLabel.x}
            y={geometry.sideLabel.y}
            title="Offline"
            value={formatStoredLateralYards(shot.sideCarryYd, preferredUnits)}
          />
        </svg>
      </div>

      <div className="hidden flex-col gap-4 p-5 lg:flex">
        <div>
          <Badge className="text-white" style={{ background: shot.accent }}>
            {formatClubType(shot.clubType)}
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal">
            {formatStoredYards(shot.totalYd ?? shot.carryYd, preferredUnits)} longest total
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shot #{shot.shotNumber ?? "-"} on {formatDate(shot.shotAt)} ·{" "}
            {formatSessionSource(shot.sessionSource)}
          </p>
          {shot.recordTrust === "raw" ? (
            <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
              This is the raw maximum, not a trusted personal best. Its source or quality evidence
              does not meet the verified-record rules.
            </p>
          ) : shot.rawMaximumYd !== null &&
            shot.rawMaximumYd > (shot.totalYd ?? shot.carryYd ?? 0) ? (
            <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-950">
              Raw maximum {formatStoredYards(shot.rawMaximumYd, preferredUnits)} · excluded from the
              trusted record by its quality, category, or source evidence.
            </p>
          ) : null}
        </div>

        <FlightProfile shot={shot} preferredUnits={preferredUnits} />

        <div className="grid grid-cols-2 gap-2">
          <SimulationMetric
            icon={Target}
            label="Carry"
            value={formatStoredYards(shot.carryYd, preferredUnits)}
          />
          <SimulationMetric
            icon={Activity}
            label="Launch/loft"
            value={`${formatMetric(shot.launchAngleDeg)} deg`}
          />
          <SimulationMetric
            icon={Gauge}
            label="Apex"
            value={formatStoredApexFeet(shot.apexFt, preferredUnits)}
          />
          <SimulationMetric
            icon={Wind}
            label="Curve"
            value={formatStoredLateralYards(shot.sideCarryYd, preferredUnits)}
          />
          <SimulationMetric
            icon={Gauge}
            label="Ball speed"
            value={formatStoredSpeedMph(shot.ballSpeedMph, preferredUnits)}
          />
          <SimulationMetric
            icon={Activity}
            label="Spin"
            value={`${formatMetric(shot.spinRate)} rpm`}
          />
        </div>
      </div>

      <MobileShotReplayDetails shot={shot} preferredUnits={preferredUnits} />
    </div>
  );
}

function MobileShotReplayDetails({
  shot,
  preferredUnits,
}: {
  shot: LongestShot;
  preferredUnits: DistanceUnitPreference;
}) {
  return (
    <div className="p-3 lg:hidden" data-mobile-replay-details>
      <IOSDisclosureGroup
        label="Longest shot replay details"
        items={[
          {
            value: "flight",
            title: "Flight profile",
            summary: formatStoredApexFeet(shot.apexFt, preferredUnits),
            description: "Launch, apex and descent shape",
            content: <FlightProfile shot={shot} preferredUnits={preferredUnits} />,
            contentClassName: "px-3",
          },
          {
            value: "metrics",
            title: "Shot metrics",
            summary: `${formatMetric(shot.ballSpeedMph)} mph`,
            description: "Launch-monitor evidence for this record",
            content: (
              <IOSGroupedList label="Selected shot metrics">
                <IOSListRow label="Carry" value={formatStoredYards(shot.carryYd, preferredUnits)} />
                <IOSListRow label="Launch" value={`${formatMetric(shot.launchAngleDeg)} deg`} />
                <IOSListRow
                  label="Apex"
                  value={formatStoredApexFeet(shot.apexFt, preferredUnits)}
                />
                <IOSListRow
                  label="Offline"
                  value={formatStoredLateralYards(shot.sideCarryYd, preferredUnits)}
                />
                <IOSListRow
                  label="Ball speed"
                  value={formatStoredSpeedMph(shot.ballSpeedMph, preferredUnits)}
                />
                <IOSListRow label="Spin" value={`${formatMetric(shot.spinRate)} rpm`} />
              </IOSGroupedList>
            ),
            contentClassName: "px-0",
          },
          {
            value: "evidence",
            title: "Record evidence",
            summary: shot.recordTrust === "trusted" ? "Trusted" : "Raw",
            description: "Source, shot number and quality classification",
            content: (
              <IOSGroupedList label="Selected record evidence">
                <IOSListRow
                  label="Session source"
                  value={formatSessionSource(shot.sessionSource)}
                />
                <IOSListRow label="Shot" value={`#${shot.shotNumber ?? "-"}`} />
                <IOSListRow label="Recorded" value={formatDate(shot.shotAt)} />
                <IOSListRow label="Quality" value={shot.qualityTag ?? "Not labelled"} />
                <IOSListRow label="Category" value={shot.shotCategory ?? "Not labelled"} />
              </IOSGroupedList>
            ),
            contentClassName: "px-0",
          },
        ]}
      />
    </div>
  );
}

function FlightProfile({
  shot,
  preferredUnits,
}: {
  shot: LongestShot;
  preferredUnits: DistanceUnitPreference;
}) {
  const carry = Math.max(1, shot.carryYd ?? shot.totalYd ?? 1);
  const apex = Math.max(20, shot.apexFt ?? 80);
  const endX = 282;
  const apexX = 58 + (carry / Math.max(carry, 300)) * 118;
  const apexY = 108 - (apex / Math.max(apex, 150)) * 78;

  return (
    <div className="apple-panel p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Flight profile</p>
      <svg
        viewBox="0 0 320 128"
        className="h-32 w-full"
        role="img"
        aria-label={`${formatClubType(shot.clubType)} flight profile chart. ${flightProfileSummary(shot, preferredUnits)}`}
      >
        <rect x="0" y="0" width="320" height="128" rx="8" fill="#eef5ee" />
        <path d="M24 108 C92 95 206 96 296 106 L296 122 L24 122 Z" fill="#7bb565" opacity="0.5" />
        <line x1="28" x2="296" y1="108" y2="108" stroke="#94a3b8" strokeDasharray="5 7" />
        <path
          d={`M 34 108 Q ${apexX} ${apexY} ${endX} 108`}
          fill="none"
          stroke={shot.accent}
          strokeLinecap="round"
          strokeWidth="4"
        />
        <circle cx={endX} cy="108" r="5" fill={shot.accent} />
        <text x={apexX + 8} y={Math.max(18, apexY - 8)} fill="#475569" fontSize="12">
          apex {formatStoredApexFeet(shot.apexFt, preferredUnits)}
        </text>
        <text x="34" y="28" fill="#475569" fontSize="12">
          launch {formatMetric(shot.launchAngleDeg)} deg
        </text>
      </svg>
      <ChartAccessibleFallback
        title="Flight profile"
        summary={flightProfileSummary(shot, preferredUnits)}
        columns={[
          { key: "club", label: "Club" },
          { key: "carry", label: "Carry" },
          { key: "total", label: "Total" },
          { key: "apex", label: "Apex" },
          { key: "launch", label: "Launch" },
          { key: "descent", label: "Descent" },
          { key: "offline", label: "Offline" },
          { key: "ballSpeed", label: "Ball speed" },
          { key: "spin", label: "Spin" },
        ]}
        rows={flightProfileRows(shot, preferredUnits)}
        className="mt-3 hidden lg:block"
      />
    </div>
  );
}

function SimulationMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="apple-panel-strong p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-muted-foreground">
        <p className="text-xs font-medium">{label}</p>
        <Icon className="size-4 shrink-0" />
      </div>
      <p className="text-lg font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function Label({ x, y, title, value }: { x: number; y: number; title: string; value: string }) {
  return (
    <g>
      <rect x={x} y={y} width="104" height="44" rx="8" fill="#0f172a" opacity="0.82" />
      <text x={x + 10} y={y + 17} fill="#cbd5e1" fontSize="11" fontWeight="600">
        {title}
      </text>
      <text x={x + 10} y={y + 34} fill="#ffffff" fontSize="15" fontWeight="700">
        {value}
      </text>
    </g>
  );
}

function buildShotGeometry(shot: LongestShot) {
  const totalDistance = Math.max(1, shot.totalYd ?? shot.carryYd ?? 1);
  const carryDistance = Math.min(totalDistance, Math.max(1, shot.carryYd ?? totalDistance));
  const maxDistance = Math.max(350, Math.ceil((totalDistance * 1.12) / 25) * 25);
  const playHeight = 830;
  const side = clamp(shot.sideCarryYd ?? (shot.launchDirectionDeg ?? 0) * 4, -90, 90);
  const carrySide = totalDistance === 0 ? side : side * (carryDistance / totalDistance);
  const tee = { x: 322, y: 936 };
  const carry = pointForShot(carryDistance, carrySide, maxDistance, playHeight, tee);
  const total = pointForShot(totalDistance, side, maxDistance, playHeight, tee);
  const curve = clamp(
    (shot.spinAxis ?? side) * 1.2 + (shot.launchDirectionDeg ?? 0) * 7,
    -150,
    150,
  );
  const controlOne = { x: tee.x + curve * 0.25, y: tee.y - playHeight * 0.42 };
  const controlTwo = { x: total.x - curve * 0.42, y: total.y + playHeight * 0.3 };
  const labelDirection = side >= 0 ? 1 : -1;

  return {
    tee,
    carry,
    total,
    maxDistance,
    playHeight,
    rollControl: labelDirection * 34,
    tracerPath: `M ${tee.x} ${tee.y} C ${controlOne.x} ${controlOne.y} ${controlTwo.x} ${controlTwo.y} ${carry.x} ${carry.y}`,
    carryLabel: {
      x: clamp(carry.x - labelDirection * 126, 16, 524),
      y: clamp(carry.y - 70, 16, 964),
    },
    totalLabel: {
      x: clamp(total.x + labelDirection * 22, 16, 524),
      y: clamp(total.y - 20, 16, 964),
    },
    sideLabel: { x: clamp(total.x - 52, 16, 524), y: clamp(total.y + 36, 16, 964) },
  };
}

function longestShotsSummary(
  shots: LongestShot[],
  selectedShot: LongestShot,
  preferredUnits: DistanceUnitPreference,
) {
  const bestShot = shots.reduce((best, shot) =>
    shotDistanceValue(shot) > shotDistanceValue(best) ? shot : best,
  );

  return `${shots.length} clubs have longest-shot records. Selected ${formatClubType(
    selectedShot.clubType,
  )} is ${formatStoredYards(shotDistance(selectedShot), preferredUnits)} total, ${formatStoredYards(
    selectedShot.carryYd,
    preferredUnits,
  )} carry and ${formatStoredLateralYards(selectedShot.sideCarryYd, preferredUnits)} offline. Best visible record is ${formatClubType(
    bestShot.clubType,
  )} at ${formatStoredYards(shotDistance(bestShot), preferredUnits)} total.`;
}

function longestShotsRows(
  shots: LongestShot[],
  selectedShotId: string,
  preferredUnits: DistanceUnitPreference,
) {
  return shots.map((shot) => ({
    _key: shot.id,
    club: `${formatClubType(shot.clubType)}${shot.id === selectedShotId ? " - selected" : ""}`,
    model: shot.brandModel,
    shot: `#${shot.shotNumber ?? "-"}`,
    date: formatDate(shot.shotAt),
    total: formatStoredYards(shotDistance(shot), preferredUnits),
    carry: formatStoredYards(shot.carryYd, preferredUnits),
    offline: formatStoredLateralYards(shot.sideCarryYd, preferredUnits),
    ballSpeed: formatStoredSpeedMph(shot.ballSpeedMph, preferredUnits),
    launch: `${formatMetric(shot.launchAngleDeg)} deg`,
    apex: formatStoredApexFeet(shot.apexFt, preferredUnits),
  }));
}

function flightProfileSummary(shot: LongestShot, preferredUnits: DistanceUnitPreference) {
  return `${formatClubType(shot.clubType)} flight profile for shot #${shot.shotNumber ?? "-"}: ${formatStoredYards(
    shot.carryYd,
    preferredUnits,
  )} carry, ${formatStoredYards(shotDistance(shot), preferredUnits)} total, ${formatStoredApexFeet(
    shot.apexFt,
    preferredUnits,
  )} apex, ${formatMetric(shot.launchAngleDeg)} deg launch and ${formatStoredLateralYards(
    shot.sideCarryYd,
    preferredUnits,
  )} offline.`;
}

function flightProfileRows(shot: LongestShot, preferredUnits: DistanceUnitPreference) {
  return [
    {
      _key: shot.id,
      club: formatClubType(shot.clubType),
      carry: formatStoredYards(shot.carryYd, preferredUnits),
      total: formatStoredYards(shotDistance(shot), preferredUnits),
      apex: formatStoredApexFeet(shot.apexFt, preferredUnits),
      launch: `${formatMetric(shot.launchAngleDeg)} deg`,
      descent: `${formatMetric(shot.descentAngleDeg)} deg`,
      offline: formatStoredLateralYards(shot.sideCarryYd, preferredUnits),
      ballSpeed: formatStoredSpeedMph(shot.ballSpeedMph, preferredUnits),
      spin: `${formatMetric(shot.spinRate)} rpm`,
    },
  ];
}

function shotDistance(shot: LongestShot) {
  return shot.totalYd ?? shot.carryYd ?? null;
}

function shotDistanceValue(shot: LongestShot) {
  return shotDistance(shot) ?? 0;
}

function pointForShot(
  distance: number,
  side: number,
  maxDistance: number,
  playHeight: number,
  tee: { x: number; y: number },
) {
  return {
    x: tee.x + (side / 90) * 158,
    y: tee.y - (distance / maxDistance) * playHeight,
  };
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatSessionSource(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function recordWarning(shot: LongestShot, preferredUnits: DistanceUnitPreference) {
  if (shot.recordTrust === "raw") {
    return "This is the raw maximum, not a trusted personal best. Its source or quality evidence does not meet the verified-record rules.";
  }

  if (shot.rawMaximumYd !== null && shot.rawMaximumYd > (shot.totalYd ?? shot.carryYd ?? 0)) {
    return `Raw maximum ${formatStoredYards(shot.rawMaximumYd, preferredUnits)} was excluded from the trusted record by its quality, category or source evidence.`;
  }

  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
