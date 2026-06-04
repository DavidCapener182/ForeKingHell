"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { ClubArtwork } from "@/components/visuals/club-artwork";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CardContent } from "@/components/ui/card";
import { DataPanel, SectionHeader, StatusPill, type Tone } from "@/components/premium";
import { cn } from "@/lib/utils";

export type ClubIntelligenceItem = {
  id: string;
  type: string;
  label: string;
  brand: string | null;
  model: string | null;
  brandModel: string;
  accent: string;
  primaryLabel: string;
  primaryCarryLabel: string;
  secondaryLabel: string;
  secondaryCarryLabel: string;
  bestStockLabel: string;
  latestReliableLabel: string;
  latestReliableRangeLabel: string;
  personalBestLabel: string;
  trustScore: number;
  sampleSize: number;
  shotCount: number;
  decisionLabel: string;
  health: ClubIntelligenceSignal;
  miss: ClubIntelligenceSignal;
  trend: ClubIntelligenceSignal | null;
  carryMedianYd: number | null;
  shots: Array<{
    carryYd: number;
    sideCarryYd: number | null;
  }>;
};

type ClubIntelligenceSignal = {
  label: string;
  detail: string;
  tone: Tone;
};

export function ClubIntelligencePanel({
  clubs,
  initialClubId,
}: {
  clubs: ClubIntelligenceItem[];
  initialClubId?: string | null;
}) {
  const [selectedClubId, setSelectedClubId] = useState(initialClubId ?? clubs[0]?.id ?? null);
  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === selectedClubId) ?? clubs[0] ?? null,
    [clubs, selectedClubId],
  );

  if (clubs.length === 0 || selectedClub === null) {
    return null;
  }

  return (
    <DataPanel id="club-intelligence" className="scroll-mt-28">
      <SectionHeader
        title="Club intelligence"
        description="One selected club at a time, with the supporting numbers kept visible but not repeated down the page."
        action={
          <StatusPill tone={selectedClub.health.tone}>{selectedClub.health.label}</StatusPill>
        }
      />
      <CardContent className="grid gap-4 p-4 sm:p-5">
        <div
          aria-label="Select a club"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 outline-none sm:mx-0 sm:px-0"
        >
          {clubs.map((club) => {
            const active = club.id === selectedClub.id;

            return (
              <button
                key={club.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedClubId(club.id)}
                className={cn(
                  "min-h-10 shrink-0 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "border-emerald-700 bg-[#0B7A3B] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300",
                )}
              >
                {club.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
          <div className="grid gap-3">
            <div className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
              <ClubArtwork
                clubType={selectedClub.type}
                brand={selectedClub.brand}
                model={selectedClub.model}
                alt=""
                className="h-36 rounded-lg"
                sizes="(min-width: 1280px) 320px, 90vw"
                priority
              />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">
                    {selectedClub.brandModel}
                  </p>
                  <h3 className="mt-1 text-3xl font-semibold tracking-normal">
                    {selectedClub.label}
                  </h3>
                </div>
                <StatusPill tone={selectedClub.health.tone}>
                  {selectedClub.decisionLabel}
                </StatusPill>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ClubIntelligenceMetric
                label={selectedClub.primaryLabel}
                value={selectedClub.primaryCarryLabel}
                tone="green"
              />
              <ClubIntelligenceMetric
                label={selectedClub.secondaryLabel}
                value={selectedClub.secondaryCarryLabel}
                tone="sky"
              />
              <ClubIntelligenceMetric
                label="Latest reliable"
                value={selectedClub.latestReliableLabel}
                detail={selectedClub.latestReliableRangeLabel}
                tone="slate"
              />
              <ClubIntelligenceMetric
                label="Personal best"
                value={selectedClub.personalBestLabel}
                tone="amber"
              />
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-3">
              <ClubSignal signal={selectedClub.health} label="Health" />
              <ClubSignal signal={selectedClub.miss} label="Current miss" />
              <ClubSignal
                signal={
                  selectedClub.trend ?? {
                    label: "Trend building",
                    detail: "Need two clean stock samples.",
                    tone: "slate",
                  }
                }
                label="Trend"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Shot pattern</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last {selectedClub.shots.length} usable carries for this club.
                  </p>
                </div>
                <StatusPill tone={selectedClub.trustScore >= 75 ? "green" : "amber"}>
                  {selectedClub.trustScore}% trust
                </StatusPill>
              </div>
              <ClubDispersionChart club={selectedClub} />
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <ClubIntelligenceMetric
                  label="Sample"
                  value={`${selectedClub.sampleSize}`}
                  detail={`${selectedClub.shotCount} saved shots`}
                  tone="slate"
                />
                <ClubIntelligenceMetric
                  label="Best stock"
                  value={selectedClub.bestStockLabel}
                  tone="sky"
                />
                <ClubIntelligenceMetric
                  label="Recommended"
                  value={selectedClub.primaryCarryLabel}
                  tone="green"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Full detail remains available</p>
                <p className="text-xs text-muted-foreground">
                  Open the club page for deeper filters, analytics and saved-shot context.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link href={`/bag/${selectedClub.id}`} prefetch={false}>
                  Open {selectedClub.label}
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function ClubIntelligenceMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone: Tone;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", metricToneClass(tone))}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-6 tracking-normal text-slate-950">{value}</p>
      {detail ? <p className="mt-0.5 truncate text-xs text-slate-600">{detail}</p> : null}
    </div>
  );
}

function ClubSignal({ label, signal }: { label: string; signal: ClubIntelligenceSignal }) {
  return (
    <div className={cn("min-h-28 rounded-lg border px-3 py-3", metricToneClass(signal.tone))}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">{label}</p>
      <p className="mt-1 text-base font-semibold leading-5 text-slate-950">{signal.label}</p>
      <p className="mt-1 text-xs leading-4 text-slate-600">{signal.detail}</p>
      {label === "Health" ? (
        <Progress
          value={
            signal.tone === "green"
              ? 92
              : signal.tone === "sky"
                ? 72
                : signal.tone === "amber"
                  ? 48
                  : 32
          }
          className="mt-3 h-1.5"
        />
      ) : null}
    </div>
  );
}

function ClubDispersionChart({ club }: { club: ClubIntelligenceItem }) {
  if (club.shots.length === 0) {
    return (
      <div className="mt-3 grid h-44 place-items-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-muted-foreground">
        Shot chart building
      </div>
    );
  }

  const maxCarry = Math.max(240, ...club.shots.map((shot) => shot.carryYd));
  const maxSide = Math.max(45, ...club.shots.map((shot) => Math.abs(shot.sideCarryYd ?? 0)));

  return (
    <svg
      viewBox="0 0 360 160"
      className="mt-3 h-44 w-full rounded-lg border border-slate-200 bg-white"
      role="img"
      aria-label={`${club.label} carry and offline shot pattern`}
    >
      <rect x="0" y="0" width="360" height="160" fill="#F8FAFC" />
      {[60, 120, 180, 240].map((yard) => {
        const y = 148 - (yard / maxCarry) * 126;

        return (
          <g key={yard}>
            <line x1="18" x2="344" y1={y} y2={y} stroke="#E5E7EB" />
            <text x="24" y={y - 5} fill="#94A3B8" fontSize="10" fontWeight="700">
              {yard}
            </text>
          </g>
        );
      })}
      <line x1="180" x2="180" y1="14" y2="148" stroke="#CBD5E1" strokeDasharray="4 5" />
      {club.carryMedianYd ? (
        <line
          x1="18"
          x2="344"
          y1={148 - (club.carryMedianYd / maxCarry) * 126}
          y2={148 - (club.carryMedianYd / maxCarry) * 126}
          stroke={club.accent}
          strokeDasharray="7 5"
          strokeOpacity="0.85"
          strokeWidth="2"
        />
      ) : null}
      {club.shots.map((shot, index) => {
        const x = 180 + ((shot.sideCarryYd ?? 0) / maxSide) * 145;
        const y = 148 - (shot.carryYd / maxCarry) * 126;

        return <circle key={index} cx={x} cy={y} r="4.5" fill={club.accent} opacity="0.72" />;
      })}
    </svg>
  );
}

function metricToneClass(tone: Tone) {
  if (tone === "green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "sky") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (tone === "pink") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}
