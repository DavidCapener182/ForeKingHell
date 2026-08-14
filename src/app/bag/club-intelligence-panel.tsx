"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import {
  ChartAccessibleFallback,
  type ChartFallbackColumn,
  type ChartFallbackRow,
} from "@/components/app/chart-accessible-fallback";
import { EntityCombobox } from "@/components/app/entity-combobox";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { ClubArtwork } from "@/components/visuals/club-artwork";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  const [detailOpen, setDetailOpen] = useState(true);
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
        <div className="max-w-sm" data-club-intelligence-combobox>
          <EntityCombobox
            value={selectedClub.id}
            onValueChange={(value) => {
              setSelectedClubId(value);
              setDetailOpen(true);
            }}
            options={clubs.map((club) => ({
              value: club.id,
              label: club.label,
              description: `${club.brandModel} · ${club.trustScore}% trust`,
            }))}
            label="Select a club"
            placeholder="Choose a club"
            searchPlaceholder="Search clubs…"
            emptyLabel="No matching club."
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
          <div className="grid gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
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

          <div className="grid content-start gap-3">
            <ResponsiveDetailPanel
              open={detailOpen}
              onOpenChange={setDetailOpen}
              inlineAtUltrawide
              title={`${selectedClub.label} intelligence`}
              description="Measured carry, trust, miss and dispersion evidence for the selected club."
              trigger={
                <Button type="button" className="w-fit" data-selected-club-detail-trigger>
                  Review {selectedClub.label}
                  <ChevronRight className="size-4" />
                </Button>
              }
              className="shadow-sm"
              contentClassName="grid gap-3"
            >
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

              <section className="grid gap-3" aria-label="Selected club shot pattern">
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
                <ConnectedMetricBar
                  embedded
                  label="Selected club shot evidence"
                  className="sm:grid-cols-3 xl:grid-cols-3"
                  metrics={[
                    {
                      label: "Sample",
                      value: `${selectedClub.sampleSize}`,
                      detail: `${selectedClub.shotCount} saved shots`,
                    },
                    { label: "Best stock", value: selectedClub.bestStockLabel },
                    { label: "Recommended", value: selectedClub.primaryCarryLabel },
                  ]}
                />
              </section>

              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-3">
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
            </ResponsiveDetailPanel>
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-6 tracking-normal text-foreground">
        {value}
      </p>
      {detail ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function ClubSignal({ label, signal }: { label: string; signal: ClubIntelligenceSignal }) {
  return (
    <div className={cn("min-h-28 rounded-lg border px-3 py-3", metricToneClass(signal.tone))}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</p>
      <p className="mt-1 text-base font-semibold leading-5 text-foreground">{signal.label}</p>
      <p className="mt-1 text-xs leading-4 text-muted-foreground">{signal.detail}</p>
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
      <div className="mt-3 grid h-44 place-items-center rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground">
        Shot chart building
      </div>
    );
  }

  const maxCarry = Math.max(240, ...club.shots.map((shot) => shot.carryYd));
  const maxSide = Math.max(45, ...club.shots.map((shot) => Math.abs(shot.sideCarryYd ?? 0)));
  const chartTitle = `${club.label} dispersion`;

  return (
    <div className="mt-3 grid gap-3">
      <svg
        viewBox="0 0 360 160"
        className="h-44 w-full rounded-lg border border-border bg-card"
        role="img"
        aria-label={`${club.label} carry and offline shot pattern`}
      >
        <rect x="0" y="0" width="360" height="160" fill="var(--card)" />
        {[60, 120, 180, 240].map((yard) => {
          const y = 148 - (yard / maxCarry) * 126;

          return (
            <g key={yard}>
              <line x1="18" x2="344" y1={y} y2={y} stroke="var(--border)" />
              <text x="24" y={y - 5} fill="var(--muted-foreground)" fontSize="10" fontWeight="700">
                {yard}
              </text>
            </g>
          );
        })}
        <line x1="180" x2="180" y1="14" y2="148" stroke="var(--border)" strokeDasharray="4 5" />
        {club.carryMedianYd ? (
          <line
            x1="18"
            x2="344"
            y1={148 - (club.carryMedianYd / maxCarry) * 126}
            y2={148 - (club.carryMedianYd / maxCarry) * 126}
            stroke="var(--primary)"
            strokeDasharray="7 5"
            strokeOpacity="0.85"
            strokeWidth="2"
          />
        ) : null}
        {club.shots.map((shot, index) => {
          const x = 180 + ((shot.sideCarryYd ?? 0) / maxSide) * 145;
          const y = 148 - (shot.carryYd / maxCarry) * 126;

          return <circle key={index} cx={x} cy={y} r="4.5" fill="var(--primary)" opacity="0.72" />;
        })}
      </svg>
      <ChartAccessibleFallback
        title={chartTitle}
        summary={clubDispersionSummary(club)}
        columns={clubDispersionColumns}
        rows={clubDispersionRows(club)}
      />
    </div>
  );
}

const clubDispersionColumns: ChartFallbackColumn[] = [
  { key: "shot", label: "Shot" },
  { key: "carry", label: "Carry" },
  { key: "offline", label: "Offline" },
  { key: "context", label: "Context" },
];

function clubDispersionSummary(club: ClubIntelligenceItem) {
  const avgCarry =
    club.shots.reduce((total, shot) => total + shot.carryYd, 0) / Math.max(1, club.shots.length);
  const avgOffline =
    club.shots.reduce((total, shot) => total + Math.abs(shot.sideCarryYd ?? 0), 0) /
    Math.max(1, club.shots.length);

  return `${club.label} dispersion uses ${club.shots.length} supporting shots. Average carry is ${formatChartYards(
    avgCarry,
  )}, average offline is ${formatChartYards(avgOffline)}, and the stock carry marker is ${
    club.carryMedianYd === null ? "still building" : formatChartYards(club.carryMedianYd)
  }.`;
}

function clubDispersionRows(club: ClubIntelligenceItem): ChartFallbackRow[] {
  return club.shots.map((shot, index) => ({
    _key: `${club.id}-${index}`,
    shot: `Shot ${index + 1}`,
    carry: formatChartYards(shot.carryYd),
    offline: formatSignedChartYards(shot.sideCarryYd),
    context:
      club.carryMedianYd === null
        ? "Stock carry marker is still building."
        : `${formatChartYards(shot.carryYd - club.carryMedianYd)} from stock carry.`,
  }));
}

function formatChartYards(value: number) {
  return `${Math.round(value).toLocaleString("en-GB")} yd`;
}

function formatSignedChartYards(value: number | null) {
  if (value === null) {
    return "No offline value";
  }

  const rounded = Math.round(value);

  if (rounded === 0) {
    return "0 yd";
  }

  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("en-GB")} yd`;
}

function metricToneClass(tone: Tone) {
  if (tone === "green") {
    return "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]";
  }

  if (tone === "sky") {
    return "border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]";
  }

  if (tone === "amber") {
    return "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]";
  }

  if (tone === "pink") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-border bg-muted/50 text-muted-foreground";
}
