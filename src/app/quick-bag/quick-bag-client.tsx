"use client";

import dynamic from "next/dynamic";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { rankQuickBagForTarget } from "@/lib/quick-bag-ranking";

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

export function QuickBagClient({ clubs, accountId }: { clubs: QuickBagClub[]; accountId: string }) {
  const [mode, setMode] = useState<QuickBagMode>("target");
  const [targetDistance, setTargetDistance] = useState("");
  const [clubSearch, setClubSearch] = useState("");
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const target = Number(targetDistance);
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

  useEffect(() => {
    try {
      // The companion snapshot contains a consistent, newer trusted evidence window.
      const existing = JSON.parse(
        window.localStorage.getItem(`fkh:quick-bag:${accountId}`) ?? "null",
      );
      if (existing?.version === 4 && existing.accountId === accountId) return;
      window.localStorage.setItem(
        `fkh:quick-bag:${accountId}`,
        JSON.stringify({ version: 3, storedAt: new Date().toISOString(), clubs }),
      );
    } catch {
      // Storage can be unavailable in strict or private browsing modes.
    }
  }, [accountId, clubs]);

  const openClub = (club: QuickBagClub) => {
    setSelectedClubId(club.id);
    setDetailOpen(true);
  };

  return (
    <div
      className="grid gap-4"
      aria-label="Quick Bag"
      data-quick-bag-hydrated={hydrated ? "true" : "false"}
    >
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
                  const nextValue = event.target.value.replace(/\D/g, "").slice(0, 3);
                  setTargetDistance(nextValue);
                }}
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                placeholder="150"
                aria-label="Target distance"
                aria-describedby="quick-bag-target-help"
                className="h-[4.75rem] rounded-2xl border-primary/25 bg-card pl-5 pr-16 font-heading text-[2.75rem] font-bold tracking-[-0.04em] shadow-sm focus-visible:border-primary focus-visible:ring-primary/20"
              />
              <span className="pointer-events-none absolute inset-y-0 right-5 grid place-items-center text-base font-semibold text-muted-foreground">
                yd
              </span>
            </div>
            <p id="quick-bag-target-help" className="sr-only">
              Enter a distance from 40 to 350 yards.
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
                    onClick={() => setTargetDistance(String(value))}
                    className="min-h-11 rounded-full px-1 text-sm font-bold active:scale-[0.97] motion-reduce:transform-none"
                  >
                    {value}
                  </Button>
                );
              })}
            </div>
          </section>

          <BestMatchCard club={bestMatch} target={hasTarget ? target : null} onOpen={openClub} />

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
                  <CompactClubRow key={club.id} club={club} onOpen={openClub} divided={index > 0} />
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
                <SearchClubRow key={club.id} club={club} onOpen={openClub} divided={index > 0} />
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
        <QuickBagClubDrawer club={selectedClub} open onOpenChange={setDetailOpen} />
      ) : null}
    </div>
  );
}

function BestMatchCard({
  club,
  target,
  onOpen,
}: {
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
            Best match for {Math.round(target)} yd
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
            <h2 className="mt-1 truncate font-heading text-[2.6rem] font-bold leading-none tracking-[-0.045em]">
              {club.label}
            </h2>
            <p className="mt-1.5 truncate text-sm text-primary-foreground/75">{club.model}</p>
          </div>
          <div className="text-right">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary-foreground/65">
              Play number
            </p>
            <p className="mt-1 font-heading text-[2.6rem] font-bold leading-none tracking-[-0.045em] tabular-nums">
              {yardNumber(club.playNumberYd)}
              <span className="ml-1 text-base tracking-normal text-primary-foreground/65">yd</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <ResultMetric label="Trusted carry" value={yardValue(club.trustedCarryYd)} />
          <ResultMetric label="Measured range" value={rangeLabel(club)} />
          <ResultMetric
            label="Confidence"
            value={club.sampleSize === 0 ? "Not measured" : `${club.confidence}%`}
          />
          <ResultMetric label="Typical miss" value={missLabel(club)} />
        </div>

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
}: {
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
        <p className="truncate font-semibold">{club.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          Carry {yardValue(club.trustedCarryYd)} · {missLabel(club)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-heading text-lg font-bold tabular-nums">
          {yardValue(club.playNumberYd)}
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
}: {
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
        <p className="truncate font-semibold">{club.label}</p>
        <p className="truncate text-xs text-muted-foreground">{club.model}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-heading text-base font-bold tabular-nums">
          {yardValue(club.trustedCarryYd)}
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
      <p className="mt-1 truncate font-semibold text-primary-foreground">{value}</p>
    </div>
  );
}

function yardNumber(value: number | null) {
  return value === null ? "—" : String(Math.round(value));
}

function yardValue(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} yd`;
}

function rangeLabel(club: QuickBagClub) {
  return club.lowYd === null || club.highYd === null
    ? "Not measured"
    : `${Math.round(Math.min(club.lowYd, club.highYd))}–${Math.round(Math.max(club.lowYd, club.highYd))} yd`;
}

function missLabel(club: QuickBagClub) {
  if (club.typicalMiss) return club.typicalMiss;
  if (club.widerSide) return `Wider ${club.widerSide}`;
  return "Not established";
}

function confidenceLabel(club: QuickBagClub) {
  return club.sampleSize === 0 ? "No sample" : `${club.confidence}% confidence`;
}
