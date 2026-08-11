"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Cuboid, Download } from "lucide-react";

import { IOSGroupedList, IOSInlineStatus, IOSListRow } from "@/components/app/ios-mobile";
import { Button } from "@/components/ui/button";
import type { HoleStrategy } from "@/lib/course-strategy";

export function MobileHoleStrategy({
  strategies,
  course,
  accountId,
  trustedBag = [],
  tee = null,
}: {
  strategies: HoleStrategy[];
  course: { id: string; name: string };
  accountId: string;
  trustedBag?: Array<{
    clubId: string;
    clubType: string;
    label: string;
    carryYd: number;
    minCarryYd: number;
    maxCarryYd: number;
    confidence: number;
    sampleSize: number;
  }>;
  tee?: { id: string; name: string; yards: number | null } | null;
}) {
  const [index, setIndex] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const strategy = strategies[index];

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!strategy) return null;

  return (
    <div
      className="grid gap-3"
      data-mobile-one-hole-strategy
      data-hydrated={hydrated ? "true" : "false"}
    >
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 rounded-xl"
          disabled={!hydrated || index === 0}
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
          aria-label="Previous hole"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <div className="text-center">
          <p className="text-lg font-bold">Hole {strategy.holeNumber}</p>
          <p className="text-xs text-muted-foreground">
            Par {strategy.par} · {strategy.yards} yd
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 rounded-xl"
          disabled={!hydrated || index === strategies.length - 1}
          onClick={() => setIndex((current) => Math.min(strategies.length - 1, current + 1))}
          aria-label="Next hole"
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>

      <IOSGroupedList label={`Strategy for hole ${strategy.holeNumber}`}>
        <IOSListRow
          label="Recommended club"
          value={strategy.recommendedClub}
          detail={strategy.expectedCarryRange}
          status={
            <IOSInlineStatus
              label={`${strategy.confidence} confidence`}
              tone={
                strategy.confidence === "High"
                  ? "positive"
                  : strategy.confidence === "Moderate"
                    ? "info"
                    : "attention"
              }
            />
          }
        />
        <IOSListRow
          label="Safe target"
          value={strategy.safeTarget}
          detail={`Common miss: ${strategy.commonMiss}`}
        />
        <IOSListRow label="Main hazard" detail={strategy.hazardWarning} />
        <IOSListRow label="Conservative alternative" detail={strategy.conservativeAlternative} />
        <IOSListRow
          label="Expected leave"
          value={strategy.expectedLeave}
          detail={plannedSequence(strategy)}
        />
        <IOSListRow
          icon={Cuboid}
          label="View this hole in Course Twin"
          detail="Open directly in Strategy mode"
          href={`/play/${course.id}?mode=strategy&hole=${strategy.holeNumber}`}
        />
      </IOSGroupedList>

      <p className="px-1 text-xs leading-5 text-muted-foreground">{strategy.caveat}</p>

      <Button
        type="button"
        variant="outline"
        className="min-h-12 rounded-xl"
        disabled={!hydrated}
        onClick={() => {
          try {
            window.localStorage.setItem(
              `fkh:round-download:${accountId}:${course.id}`,
              JSON.stringify({
                version: 1,
                accountId,
                course,
                tee,
                storedAt: new Date().toISOString(),
                strategy: strategies,
                trustedBag,
                visualFallback: strategies.map(({ holeNumber, par, yards, safeTarget }) => ({
                  holeNumber,
                  par,
                  yards,
                  safeTarget,
                })),
              }),
            );
            setDownloaded(true);
          } catch {
            setDownloaded(false);
          }
        }}
      >
        <Download className="size-4" aria-hidden />
        {downloaded ? "Available for this round" : "Download for Round"}
      </Button>
    </div>
  );
}

function plannedSequence(strategy: HoleStrategy) {
  const followUp = strategy.followUpClubs.map((club) => club.label).join(" → ");
  return followUp ? `${strategy.recommendedClub} → ${followUp}` : strategy.recommendedClub;
}
