"use client";

import { useMemo, useState } from "react";
import { Activity, Gauge, Target, Trophy, Wind, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatClubType } from "@/lib/club-format";
import { cn } from "@/lib/utils";

export type LongestShot = {
  id: string;
  clubId: string;
  clubType: string;
  brandModel: string;
  accent: string;
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

export function LongestShotsSection({ shots }: { shots: LongestShot[] }) {
  const [selectedShotId, setSelectedShotId] = useState(shots[0]?.id ?? "");
  const selectedShot = shots.find((shot) => shot.id === selectedShotId) ?? shots[0] ?? null;

  if (shots.length === 0 || !selectedShot) {
    return null;
  }

  return (
    <section className="space-y-4">
      <Card className="premium-card">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl tracking-normal">
                <Trophy className="size-5 text-amber-500" />
                Longest shots
              </CardTitle>
              <CardDescription>
                Best total-distance shot recorded for each club.
              </CardDescription>
            </div>
            <Badge variant="outline">{shots.length} clubs</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {shots.map((shot) => (
              <LongestShotButton
                key={shot.id}
                shot={shot}
                selected={shot.id === selectedShot.id}
                onClick={() => setSelectedShotId(shot.id)}
              />
            ))}
          </div>

          <ShotSimulator shot={selectedShot} />
        </CardContent>
      </Card>
    </section>
  );
}

function LongestShotButton({
  shot,
  selected,
  onClick,
}: {
  shot: LongestShot;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "apple-panel-strong flex min-h-28 flex-col gap-3 p-3 text-left transition-colors hover:border-emerald-300",
        selected && "border-emerald-300 bg-white",
      )}
      style={{
        borderColor: selected ? shot.accent : "#e5e7eb",
        boxShadow: selected ? `0 0 0 1px ${shot.accent}` : undefined,
        outline: "none",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
          style={{ background: shot.accent }}
        >
          {formatClubType(shot.clubType).slice(0, 2)}
        </span>
        <span className="min-w-0">
          <span className="block text-sm text-muted-foreground">{shot.brandModel}</span>
          <span className="block font-semibold text-foreground">{formatClubType(shot.clubType)}</span>
        </span>
      </div>
      <span className="mt-auto flex items-end justify-between gap-3">
        <span>
          <span className="block text-xs text-muted-foreground">Longest total</span>
          <span className="text-2xl font-semibold tracking-normal text-foreground">
            {formatMetric(shot.totalYd ?? shot.carryYd)}
            <span className="ml-1 text-sm text-muted-foreground">yd</span>
          </span>
        </span>
        <span className="text-right text-xs text-muted-foreground">
          #{shot.shotNumber ?? "-"}
          <br />
          {formatDate(shot.shotAt)}
        </span>
      </span>
    </button>
  );
}

function ShotSimulator({ shot }: { shot: LongestShot }) {
  const geometry = useMemo(() => buildShotGeometry(shot), [shot]);

  return (
    <div className="apple-panel-strong grid overflow-hidden lg:grid-cols-[minmax(320px,560px)_minmax(320px,1fr)]">
      <div className="grid h-[58vh] min-h-[420px] max-h-[600px] place-items-center bg-[#143321] p-3">
        <svg
          viewBox="0 0 644 1024"
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label="Course shot simulation on a 350 yard hole"
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
            `}
          </style>

          <image href="/assets/hole-350-aerial.jpg" x="0" y="0" width="644" height="1024" preserveAspectRatio="xMidYMid slice" />
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
                <text x={Math.min(592, geometry.tee.x + arcWidth + 12)} y={y + 12} fill="#f8fafc" fontSize="18" fontWeight="700">
                  {yard}
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
          <circle cx={geometry.tee.x} cy={geometry.tee.y} r="8" fill="#f8fafc" stroke="#111827" strokeWidth="3" />
          <circle cx={geometry.carry.x} cy={geometry.carry.y} r="10" fill={shot.accent} stroke="#111827" strokeWidth="3" />
          <circle cx={geometry.total.x} cy={geometry.total.y} r="15" fill="none" stroke={shot.accent} strokeWidth="4" className="longest-shot-pulse" />
          <circle cx={geometry.total.x} cy={geometry.total.y} r="7" fill="#f8fafc" stroke={shot.accent} strokeWidth="3" />

          <Label x={geometry.carryLabel.x} y={geometry.carryLabel.y} title="Carry" value={`${formatMetric(shot.carryYd)} yd`} />
          <Label x={geometry.totalLabel.x} y={geometry.totalLabel.y} title="Total" value={`${formatMetric(shot.totalYd ?? shot.carryYd)} yd`} />
          <Label x={geometry.sideLabel.x} y={geometry.sideLabel.y} title="Offline" value={formatSide(shot.sideCarryYd)} />
        </svg>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div>
          <Badge className="text-white" style={{ background: shot.accent }}>
            {formatClubType(shot.clubType)}
          </Badge>
          <h3 className="mt-3 text-2xl font-semibold tracking-normal">
            {formatMetric(shot.totalYd ?? shot.carryYd)} yd longest total
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Shot #{shot.shotNumber ?? "-"} on {formatDate(shot.shotAt)}
          </p>
        </div>

        <FlightProfile shot={shot} />

        <div className="grid grid-cols-2 gap-2">
          <SimulationMetric icon={Target} label="Carry" value={`${formatMetric(shot.carryYd)} yd`} />
          <SimulationMetric icon={Activity} label="Launch/loft" value={`${formatMetric(shot.launchAngleDeg)} deg`} />
          <SimulationMetric icon={Gauge} label="Apex" value={`${formatMetric(shot.apexFt)} ft`} />
          <SimulationMetric icon={Wind} label="Curve" value={formatSide(shot.sideCarryYd)} />
          <SimulationMetric icon={Gauge} label="Ball speed" value={`${formatMetric(shot.ballSpeedMph)} mph`} />
          <SimulationMetric icon={Activity} label="Spin" value={`${formatMetric(shot.spinRate)} rpm`} />
        </div>
      </div>
    </div>
  );
}

function FlightProfile({ shot }: { shot: LongestShot }) {
  const carry = Math.max(1, shot.carryYd ?? shot.totalYd ?? 1);
  const apex = Math.max(20, shot.apexFt ?? 80);
  const endX = 282;
  const apexX = 58 + (carry / Math.max(carry, 300)) * 118;
  const apexY = 108 - (apex / Math.max(apex, 150)) * 78;

  return (
    <div className="apple-panel p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Flight profile</p>
      <svg viewBox="0 0 320 128" className="h-32 w-full">
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
          apex {formatMetric(shot.apexFt)} ft
        </text>
        <text x="34" y="28" fill="#475569" fontSize="12">
          launch {formatMetric(shot.launchAngleDeg)} deg
        </text>
      </svg>
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

function Label({
  x,
  y,
  title,
  value,
}: {
  x: number;
  y: number;
  title: string;
  value: string;
}) {
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
  const curve = clamp((shot.spinAxis ?? side) * 1.2 + (shot.launchDirectionDeg ?? 0) * 7, -150, 150);
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
    carryLabel: { x: clamp(carry.x - labelDirection * 126, 16, 524), y: clamp(carry.y - 70, 16, 964) },
    totalLabel: { x: clamp(total.x + labelDirection * 22, 16, 524), y: clamp(total.y - 20, 16, 964) },
    sideLabel: { x: clamp(total.x - 52, 16, 524), y: clamp(total.y + 36, 16, 964) },
  };
}

function pointForShot(distance: number, side: number, maxDistance: number, playHeight: number, tee: { x: number; y: number }) {
  return {
    x: tee.x + (side / 90) * 158,
    y: tee.y - (distance / maxDistance) * playHeight,
  };
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function formatSide(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value < 0) {
    return `${numberFormatter.format(Math.abs(value))}L`;
  }

  if (value > 0) {
    return `${numberFormatter.format(value)}R`;
  }

  return "0";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
