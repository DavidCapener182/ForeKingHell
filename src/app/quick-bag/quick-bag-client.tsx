"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Target } from "lucide-react";

import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";

export type QuickBagClub = {
  id: string;
  label: string;
  model: string;
  trustedCarryYd: number | null;
  playsLikeYd: number | null;
  lowYd: number | null;
  highYd: number | null;
  commonMiss: string;
  confidence: number;
  sampleSize: number;
};

export function QuickBagClient({ clubs, accountId }: { clubs: QuickBagClub[]; accountId: string }) {
  const [query, setQuery] = useState("");
  const [targetDistance, setTargetDistance] = useState("");
  const target = Number(targetDistance);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return clubs
      .filter(
        (club) =>
          !normalizedQuery || `${club.label} ${club.model}`.toLowerCase().includes(normalizedQuery),
      )
      .sort((left, right) => {
        if (!Number.isFinite(target) || target <= 0) return 0;
        return (
          distanceFrom(left.trustedCarryYd, target) - distanceFrom(right.trustedCarryYd, target)
        );
      });
  }, [clubs, query, target]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `fkh:quick-bag:${accountId}`,
        JSON.stringify({ version: 1, storedAt: new Date().toISOString(), clubs }),
      );
    } catch {
      // Storage can be unavailable in strict or private browsing modes.
    }
  }, [accountId, clubs]);

  return (
    <>
      <section className="ios-grouped-list grid gap-3 p-4" aria-label="Quick Bag search">
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
              onChange={(event) => setTargetDistance(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 165 yards"
              className="ios-sheet-search min-h-12 w-full pl-10 pr-3 text-base outline-none"
            />
          </div>
        </label>
      </section>

      <section className="grid gap-2.5">
        <IOSSectionHeader
          title="Trusted numbers"
          description={`${filtered.length} active ${filtered.length === 1 ? "club" : "clubs"}`}
        />
        <IOSGroupedList label="Quick Bag trusted numbers">
          {filtered.map((club) => (
            <IOSListRow
              key={club.id}
              icon={Target}
              label={club.label}
              detail={`${club.model} · ${rangeLabel(club)} · Miss ${club.commonMiss}${club.playsLikeYd === null ? "" : ` · Plays like ${Math.round(club.playsLikeYd)} yd`}`}
              value={club.trustedCarryYd === null ? "--" : `${Math.round(club.trustedCarryYd)} yd`}
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
          Plays-like values appear only when the trusted yardage calculation supplies one. Missing
          values are not estimated.
        </p>
      </section>
    </>
  );
}

function distanceFrom(value: number | null, target: number) {
  return value === null ? Number.POSITIVE_INFINITY : Math.abs(value - target);
}

function rangeLabel(club: QuickBagClub) {
  if (club.lowYd === null || club.highYd === null) return "Range not measured";
  return `${Math.round(Math.min(club.lowYd, club.highYd))}-${Math.round(Math.max(club.lowYd, club.highYd))} yd`;
}

function confidenceLabel(club: QuickBagClub) {
  if (club.sampleSize === 0) return "No measured sample";
  return `${club.confidence}% confidence`;
}
