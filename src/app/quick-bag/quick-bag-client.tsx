"use client";

import dynamic from "next/dynamic";
import { yardsToDisplay, distanceUnitLabel, type DistanceUnitPreference } from "@/lib/units";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { rankQuickBagForTarget, targetInsideRange } from "@/lib/quick-bag-ranking";

export type QuickBagClub = {
  id: string;
  clubType?: string;
  label: string;
  model: string;
  trustedCarryYd: number | null;
  totalYd?: number | null;
  totalSampleSize?: number;
  playNumberYd: number | null;
  lowYd: number | null;
  highYd: number | null;
  typicalMiss: string | null;
  widerSide: string | null;
  medianLateralYd: number | null;
  lateralLowYd: number | null;
  lateralHighYd: number | null;
  patternSampleSize: number;
  observedLeftYd?: number | null;
  observedRightYd?: number | null;
  confidence: number;
  sampleSize: number;
  latestEvidenceDate: string | null;
  evidenceKind?: "full" | "touch";
};

type QuickBagMode = "target" | "club";

const quickTargets = [100, 125, 150, 175, 200];

const QuickBagClubDrawer = dynamic(() =>
  import("@/app/quick-bag/quick-bag-club-drawer").then((module) => module.QuickBagClubDrawer),
);

export function QuickBagClient({
  clubs,
  preferredUnits = "yards",
}: {
  clubs: QuickBagClub[];
  accountId: string;
  preferredUnits?: DistanceUnitPreference;
}) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<QuickBagMode>("target");
  const [targetDistance, setTargetDistance] = useState("");
  // Ranking and preset selection use exact canonical yards. Display rounding must
  // never feed back into the golf calculation when the player changes units.
  const [targetYd, setTargetYd] = useState<number | null>(null);
  const [clubSearch, setClubSearch] = useState("");
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [displayUnits, setDisplayUnits] = useState(preferredUnits);
  const factor = yardsToDisplay(1, displayUnits);
  const unit = distanceUnitLabel(displayUnits);
  const target = targetYd ?? Number.NaN;
  const hasTarget = Number.isFinite(target) && target >= 40 && target <= 350;
  const rankedClubs = useMemo(
    () => (hasTarget ? rankQuickBagForTarget(clubs, target, "finish") : clubs),
    [clubs, hasTarget, target],
  );
  const bestMatch = hasTarget ? (rankedClubs[0] ?? null) : null;
  const searchResults = useMemo(() => {
    const query = clubSearch.trim().toLocaleLowerCase();
    if (!query) return clubs;
    return clubs.filter((club) =>
      `${club.label} ${club.model}`.toLocaleLowerCase().includes(query),
    );
  }, [clubSearch, clubs]);
  const selectedClub = selectedClubId
    ? (clubs.find((club) => club.id === selectedClubId) ?? null)
    : null;

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const openClub = (club: QuickBagClub) => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedClubId(club.id);
    setDetailOpen(true);
  };

  return (
    <div
      className="grid gap-4"
      aria-label="Quick Bag"
      data-quick-bag-hydrated={hydrated ? "true" : "false"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {searchResults.length} clubs · target{" "}
          {hasTarget ? `${Number(targetDistance)} ${unit}` : "not set"}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const next = displayUnits === "yards" ? "metres" : "yards";
            if (targetDistance.trim() && Number.isFinite(target))
              setTargetDistance(String(Number((target * yardsToDisplay(1, next)).toFixed(3))));
            setDisplayUnits(next);
          }}
        >
          Use {displayUnits === "yards" ? "metres" : "yards"}
        </Button>
      </div>
      <MobileSegmentedControl
        value={mode}
        onValueChange={(value) => setMode(value as QuickBagMode)}
        ariaLabel="Quick Bag mode"
        options={[
          { value: "target", label: "Target distance" },
          { value: "club", label: "Search club" },
        ]}
      />

      {mode === "target" ? (
        <>
          <section className="grid gap-2" aria-labelledby="target-distance-label">
            <label
              id="target-distance-label"
              htmlFor="quick-bag-target"
              className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Target distance
            </label>
            <div className="relative">
              <Input
                id="quick-bag-target"
                value={targetDistance}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setTargetDistance(nextValue);
                  const parsed = Number(nextValue);
                  setTargetYd(nextValue.trim() && Number.isFinite(parsed) ? parsed / factor : null);
                }}
                type="number"
                min={40 * factor}
                max={350 * factor}
                step="any"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                placeholder="150"
                aria-label="Target distance"
                aria-describedby="quick-bag-target-help"
                className="h-[4.75rem] rounded-2xl border-primary/25 bg-card pl-5 pr-16 font-heading text-[2.75rem] font-bold tracking-[-0.04em] shadow-sm focus-visible:border-primary focus-visible:ring-primary/20"
              />
              <span className="pointer-events-none absolute inset-y-0 right-5 grid place-items-center text-base font-semibold text-muted-foreground">
                {unit}
              </span>
            </div>
            <p id="quick-bag-target-help" className="sr-only">
              Enter a distance from {(40 * factor).toFixed(1)} to {(350 * factor).toFixed(1)} {unit}
              .
            </p>
            <div className="grid grid-cols-5 gap-1.5" aria-label="Quick target distances">
              {quickTargets.map((value) => {
                const selected = target === value;
                return (
                  <Button
                    key={value}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    aria-pressed={selected}
                    onClick={() => {
                      setTargetYd(value);
                      setTargetDistance(String(Number((value * factor).toFixed(1))));
                    }}
                    className="min-h-11 rounded-full px-1 text-sm font-bold active:scale-[0.97] motion-reduce:transform-none"
                  >
                    {Number((value * factor).toFixed(1))}
                  </Button>
                );
              })}
            </div>
          </section>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-fit"
            onClick={() => {
              setTargetDistance("");
              setTargetYd(null);
              setClubSearch("");
              setSelectedClubId(null);
              setDetailOpen(false);
            }}
          >
            Clear target and search
          </Button>

          {targetDistance && !hasTarget ? (
            <p role="status" className="text-sm text-muted-foreground">
              Enter a target between {(40 * factor).toFixed(1)} and {(350 * factor).toFixed(1)}{" "}
              {unit}.
            </p>
          ) : null}
          <BestMatchCard
            club={bestMatch}
            target={hasTarget ? target : null}
            onOpen={openClub}
            units={displayUnits}
          />

          {bestMatch ? (
            <section className="grid gap-2" aria-labelledby="quick-bag-alternatives">
              <div className="flex items-baseline justify-between gap-3 px-0.5">
                <h2 id="quick-bag-alternatives" className="text-base font-bold">
                  Alternatives
                </h2>
                <span className="text-xs text-muted-foreground">Nearest by play number</span>
              </div>
              <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                {rankedClubs.slice(1, 4).map((club, index) => (
                  <CompactClubRow
                    key={club.id}
                    club={club}
                    onOpen={openClub}
                    divided={index > 0}
                    units={displayUnits}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="grid gap-3" aria-labelledby="search-club-label">
          <div className="grid gap-2">
            <label
              id="search-club-label"
              htmlFor="quick-bag-club-search"
              className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Search club
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="quick-bag-club-search"
                type="search"
                value={clubSearch}
                onChange={(event) => setClubSearch(event.target.value)}
                placeholder="Driver, 7 iron, wedge…"
                aria-label="Search by club"
                autoComplete="off"
                className="h-14 rounded-2xl bg-card pl-12 pr-4 text-base shadow-sm"
              />
            </div>
          </div>

          {searchResults.length > 0 ? (
            <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {searchResults.map((club, index) => (
                <SearchClubRow
                  key={club.id}
                  club={club}
                  onOpen={openClub}
                  divided={index > 0}
                  units={displayUnits}
                />
              ))}
            </div>
          ) : (
            <AppEmptyState
              title="No matching club"
              description="Try the club type, such as 7 iron or wedge."
              primaryAction={
                <Button type="button" size="sm" onClick={() => setClubSearch("")}>
                  Clear search
                </Button>
              }
              className="p-5"
            />
          )}
        </section>
      )}

      {detailOpen ? (
        <QuickBagClubDrawer
          club={selectedClub}
          open
          preferredUnits={displayUnits}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        />
      ) : null}
    </div>
  );
}

function BestMatchCard({
  club,
  target,
  onOpen,
  units,
}: {
  units: DistanceUnitPreference;
  club: QuickBagClub | null;
  target: number | null;
  onOpen: (club: QuickBagClub) => void;
}) {
  if (!club || target === null) {
    return (
      <Card
        className="min-h-40 justify-center border-dashed bg-card/70 py-5"
        data-quick-bag-best-match
      >
        <CardContent className="grid gap-2 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Best match</p>
          <p className="font-heading text-xl font-bold">Enter the target to get your club</p>
          <p className="text-sm text-muted-foreground">
            Your measured play number decides the match.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="gap-0 rounded-2xl bg-primary py-0 text-primary-foreground shadow-[0_18px_40px_rgba(11,122,59,0.22)] ring-primary/30"
      data-quick-bag-best-match
      data-quick-bag-answer
      style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
    >
      <CardContent className="grid gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground/75">
            Nearest measured option for {yardValue(target, units)}
          </p>
          <span className="rounded-full bg-primary-foreground/12 px-2.5 py-1 text-xs font-bold">
            {confidenceLabel(club)}
          </span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-primary-foreground/15 pb-4">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/65">
              Club
            </p>
            <h2 className="mt-1 font-heading text-[2.6rem] font-bold leading-none tracking-[-0.045em]">
              {club.label}
            </h2>
            <p className="mt-1.5 text-sm text-primary-foreground/75">{club.model}</p>
          </div>
          <div className="text-right">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/65">
              Play number
            </p>
            <p className="mt-1 font-heading text-[2.6rem] font-bold leading-none tracking-[-0.045em] tabular-nums">
              {club.playNumberYd === null
                ? "—"
                : Math.round(yardsToDisplay(club.playNumberYd, units))}
              <span className="ml-1 text-base tracking-normal text-primary-foreground/65">
                {distanceUnitLabel(units)}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <ResultMetric label="Trusted carry" value={yardValue(club.trustedCarryYd, units)} />
          <ResultMetric label="Measured range" value={rangeLabel(club, units)} />
          <ResultMetric
            label="Confidence"
            value={club.sampleSize === 0 ? "Not measured" : `${club.confidence}%`}
          />
          <ResultMetric label="Typical miss" value={missLabel(club)} />
        </div>

        {!targetInsideRange(club, target) || club.playNumberYd === null || club.sampleSize < 5 ? (
          <p className="text-sm leading-6">
            This target is outside a supported range or has too little evidence. The nearest club is
            a reference, not a confirmed recommendation.
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpen(club)}
          className="min-h-11 w-full justify-between rounded-xl border-primary-foreground/15 bg-primary-foreground/12 px-3 text-primary-foreground shadow-none hover:bg-primary-foreground/18 hover:text-primary-foreground"
        >
          See club evidence
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}

function CompactClubRow({
  club,
  onOpen,
  divided,
  units,
}: {
  units: DistanceUnitPreference;
  club: QuickBagClub;
  onOpen: (club: QuickBagClub) => void;
  divided: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(club)}
      className={`focus-aaa flex min-h-14 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-muted/55 active:bg-muted motion-reduce:transition-none ${divided ? "border-t border-border/70" : ""}`}
      aria-label={`Open ${club.label} evidence`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{club.label}</p>
        <p className="text-xs text-muted-foreground">
          Carry {yardValue(club.trustedCarryYd, units)} · {missLabel(club)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-heading text-lg font-bold tabular-nums">
          {yardValue(club.playNumberYd, units)}
        </p>
        <p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">Play</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function SearchClubRow({
  club,
  onOpen,
  divided,
  units,
}: {
  units: DistanceUnitPreference;
  club: QuickBagClub;
  onOpen: (club: QuickBagClub) => void;
  divided: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(club)}
      className={`focus-aaa flex min-h-16 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-muted/55 active:bg-muted motion-reduce:transition-none ${divided ? "border-t border-border/70" : ""}`}
      aria-label={`Open ${club.label} evidence`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{club.label}</p>
        <p className="text-xs text-muted-foreground">{club.model}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-heading text-base font-bold tabular-nums">
          {yardValue(club.trustedCarryYd, units)}
        </p>
        <Badge variant="outline" className="mt-0.5 border-0 px-0 py-0 text-[0.65rem] font-medium">
          {confidenceLabel(club)}
        </Badge>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-primary-foreground/60">
        {label}
      </p>
      <p className="mt-1 font-semibold text-primary-foreground">{value}</p>
    </div>
  );
}

function yardValue(value: number | null, units: DistanceUnitPreference) {
  return value === null
    ? "—"
    : `${Math.round(yardsToDisplay(value, units))} ${distanceUnitLabel(units)}`;
}

function rangeLabel(club: QuickBagClub, units: DistanceUnitPreference) {
  return club.lowYd === null || club.highYd === null
    ? "Not measured"
    : `${Math.round(yardsToDisplay(Math.min(club.lowYd, club.highYd), units))}–${Math.round(yardsToDisplay(Math.max(club.lowYd, club.highYd), units))} ${distanceUnitLabel(units)}`;
}

function missLabel(club: QuickBagClub) {
  if (club.typicalMiss) return club.typicalMiss;
  if (club.widerSide) return `Wider ${club.widerSide}`;
  return "Not established";
}

function confidenceLabel(club: QuickBagClub) {
  return club.sampleSize === 0 ? "No sample" : `${club.confidence}% confidence`;
}
