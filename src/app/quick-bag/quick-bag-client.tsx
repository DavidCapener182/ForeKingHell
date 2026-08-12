"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Target } from "lucide-react";

import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { rankQuickBagForTarget, type TargetPreference } from "@/lib/quick-bag-ranking";

export type QuickBagClub = {
  id: string;
  label: string;
  model: string;
  trustedCarryYd: number | null;
  playNumberYd: number | null;
  lowYd: number | null;
  highYd: number | null;
  typicalMiss: string | null;
  widerSide: string | null;
  medianLateralYd: number | null;
  lateralLowYd: number | null;
  lateralHighYd: number | null;
  patternSampleSize: number;
  confidence: number;
  sampleSize: number;
};

const quickTargets = [100, 125, 150, 175, 200];

export function QuickBagClient({ clubs, accountId }: { clubs: QuickBagClub[]; accountId: string }) {
  const [query, setQuery] = useState("");
  const [targetDistance, setTargetDistance] = useState("");
  const [preference, setPreference] = useState<TargetPreference>("finish");
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const target = Number(targetDistance);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matching = clubs.filter(
      (club) =>
        !normalizedQuery || `${club.label} ${club.model}`.toLowerCase().includes(normalizedQuery),
    );
    return Number.isFinite(target) && target > 0
      ? rankQuickBagForTarget(matching, target, preference)
      : matching;
  }, [clubs, preference, query, target]);
  const bestMatch = Number.isFinite(target) && target > 0 ? (filtered[0] ?? null) : null;
  const selectedClub =
    (selectedClubId ? clubs.find((club) => club.id === selectedClubId) : null) ??
    bestMatch ??
    filtered[0] ??
    null;

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `fkh:quick-bag:${accountId}`,
        JSON.stringify({ version: 2, storedAt: new Date().toISOString(), clubs }),
      );
    } catch {
      // Storage can be unavailable in strict or private browsing modes.
    }
  }, [accountId, clubs]);

  return (
    <>
      <section
        className="ios-grouped-list grid gap-3 p-4"
        aria-label="Quick Bag search"
        data-quick-bag-hydrated={hydrated ? "true" : "false"}
      >
        <label className="relative block">
          <span className="sr-only">Search by club</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by club"
            className="ios-sheet-search min-h-12 w-full pl-10 pr-3 text-base outline-none"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Target distance
          <div className="relative">
            <Target
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              inputMode="numeric"
              value={targetDistance}
              onChange={(event) => {
                setTargetDistance(event.target.value.replace(/[^0-9]/g, ""));
                setSelectedClubId(null);
              }}
              placeholder="e.g. 165 yards"
              className="ios-sheet-search min-h-12 w-full pl-10 pr-3 text-base outline-none"
            />
          </div>
        </label>
        <div className="flex gap-2 overflow-x-auto" aria-label="Common target distances">
          {quickTargets.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTargetDistance(String(value));
                setSelectedClubId(null);
              }}
              aria-pressed={target === value}
              className="focus-aaa min-h-11 shrink-0 rounded-full border bg-card px-3 text-sm font-semibold"
            >
              {value}
            </button>
          ))}
        </div>
        <div
          className="grid grid-cols-2 rounded-xl bg-secondary p-1"
          role="group"
          aria-label="Target preference"
        >
          <button
            type="button"
            aria-pressed={preference === "carry"}
            onClick={() => {
              setPreference("carry");
              setSelectedClubId(null);
            }}
            className={`focus-aaa min-h-11 rounded-lg text-sm font-semibold ${preference === "carry" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            Carry the number
          </button>
          <button
            type="button"
            aria-pressed={preference === "finish"}
            onClick={() => {
              setPreference("finish");
              setSelectedClubId(null);
            }}
            className={`focus-aaa min-h-11 rounded-lg text-sm font-semibold ${preference === "finish" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            Finish at it
          </button>
        </div>
      </section>

      {bestMatch ? (
        <section
          className="ios-grouped-list grid gap-3 border-primary/25 bg-primary/5 p-5"
          data-quick-bag-best-match
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Best match for {Math.round(target)} yards
              </p>
              <h2 className="mt-1 text-2xl font-bold">{bestMatch.label}</h2>
              <p className="text-sm text-muted-foreground">{bestMatch.model}</p>
            </div>
            <IOSInlineStatus
              label={`${bestMatch.confidence}% confidence`}
              tone={
                bestMatch.confidence >= 75
                  ? "positive"
                  : bestMatch.confidence >= 55
                    ? "info"
                    : "attention"
              }
            />
          </div>
          <IOSGroupedList label="Best target match" className="bg-card">
            <IOSMetricRow label="Play number" value={yardValue(bestMatch.playNumberYd)} />
            <IOSMetricRow label="Trusted carry" value={yardValue(bestMatch.trustedCarryYd)} />
            <IOSMetricRow label="Measured range" value={rangeLabel(bestMatch)} />
            <IOSMetricRow label="Typical pattern" value={patternLabel(bestMatch)} />
          </IOSGroupedList>
        </section>
      ) : null}

      {selectedClub ? (
        <section className="grid gap-2.5">
          <IOSSectionHeader
            title={`${selectedClub.label} lateral range`}
            description="Recent trusted-shot distribution"
          />
          <LateralRange club={selectedClub} />
        </section>
      ) : null}

      <section className="grid gap-2.5">
        <IOSSectionHeader
          title={bestMatch ? "Alternatives" : "Trusted numbers"}
          description={`${filtered.length} active ${filtered.length === 1 ? "club" : "clubs"}`}
        />
        <IOSGroupedList label="Quick Bag trusted numbers">
          {(bestMatch ? filtered.slice(1) : filtered).map((club) => (
            <IOSListRow
              key={club.id}
              icon={Target}
              label={club.label}
              detail={`${club.model} · ${rangeLabel(club)} · ${patternLabel(club)}${club.playNumberYd === null ? "" : ` · Play number ${Math.round(club.playNumberYd)} yd`}`}
              value={yardValue(club.trustedCarryYd)}
              onClick={() => setSelectedClubId(club.id)}
              status={
                <IOSInlineStatus
                  label={confidenceLabel(club)}
                  tone={
                    club.confidence >= 75
                      ? "positive"
                      : club.confidence >= 55
                        ? "info"
                        : "attention"
                  }
                />
              }
            />
          ))}
        </IOSGroupedList>
        <p className="px-1 text-xs leading-5 text-muted-foreground">
          Play number is the recommended stock number. “Plays like” is reserved for a live
          conditions-adjusted value.
        </p>
      </section>
    </>
  );
}

function LateralRange({ club }: { club: QuickBagClub }) {
  const low = club.lateralLowYd;
  const high = club.lateralHighYd;
  const median = club.medianLateralYd;
  const bound = Math.max(10, Math.abs(low ?? 0), Math.abs(high ?? 0));
  const position = (value: number) => 50 + (value / bound) * 44;
  return (
    <div
      className="ios-grouped-list p-4"
      role="img"
      aria-label={`${club.label} lateral measured range. ${patternLabel(club)}.`}
    >
      <div className="relative h-14">
        <div className="absolute left-[6%] right-[6%] top-6 h-1 rounded-full bg-secondary" />
        <div className="absolute left-1/2 top-2 h-9 w-px bg-foreground/40" />
        {low !== null && high !== null ? (
          <div
            className="absolute top-5 h-3 rounded-full bg-primary/30"
            style={{
              left: `${position(low)}%`,
              width: `${Math.max(2, position(high) - position(low))}%`,
            }}
          />
        ) : null}
        {median !== null ? (
          <div
            className="absolute top-4 size-5 -translate-x-1/2 rounded-full border-2 border-background bg-primary shadow"
            style={{ left: `${position(median)}%` }}
          />
        ) : null}
        <span className="absolute bottom-0 left-0 text-xs text-muted-foreground">Left</span>
        <span className="absolute bottom-0 right-0 text-xs text-muted-foreground">Right</span>
      </div>
      <p className="mt-2 text-sm font-medium">
        {patternLabel(club)} · {club.patternSampleSize} trusted shots
      </p>
    </div>
  );
}

function yardValue(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} yd`;
}
function rangeLabel(club: QuickBagClub) {
  return club.lowYd === null || club.highYd === null
    ? "Range not measured"
    : `${Math.round(Math.min(club.lowYd, club.highYd))}–${Math.round(Math.max(club.lowYd, club.highYd))} yd`;
}
function patternLabel(club: QuickBagClub) {
  if (club.typicalMiss) return `Typical miss: ${club.typicalMiss}`;
  if (club.widerSide) return `Wider side: ${club.widerSide}`;
  return "Direction not established";
}
function confidenceLabel(club: QuickBagClub) {
  return club.sampleSize === 0 ? "No measured sample" : `${club.confidence}% confidence`;
}
