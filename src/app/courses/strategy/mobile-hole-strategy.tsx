"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Cuboid, Save, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import type { HoleStrategy } from "@/lib/course-strategy";

export function MobileHoleStrategy({
  strategies,
  course,
  accountId,
  trustedBag = [],
  tee = null,
  courseTwinAvailable = false,
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
  courseTwinAvailable?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [savedCopyIsStale, setSavedCopyIsStale] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const strategy = strategies[index];

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`fkh:round-download:${accountId}:${course.id}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        accountId?: unknown;
        course?: { id?: unknown };
        storedAt?: unknown;
      };
      if (
        saved.accountId !== accountId ||
        saved.course?.id !== course.id ||
        typeof saved.storedAt !== "string"
      ) {
        return;
      }
      const date = new Date(saved.storedAt);
      if (Number.isNaN(date.getTime())) return;
      const timer = window.setTimeout(() => {
        setDownloaded(true);
        setSavedAt(date);
        setSavedCopyIsStale(Date.now() - date.getTime() > 24 * 60 * 60 * 1_000);
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      // Local storage is an optional poor-connection aid.
    }
  }, [accountId, course.id]);

  if (!strategy) return null;

  return (
    <div
      className="grid gap-3"
      data-mobile-one-hole-strategy
      data-hydrated={hydrated ? "true" : "false"}
      role="region"
      aria-roledescription="carousel"
      aria-label="Hole-by-hole course strategy"
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
          <p className="text-lg font-bold">
            Hole {strategy.holeNumber} of {strategies.length}
          </p>
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

      <Progress
        value={((index + 1) / strategies.length) * 100}
        aria-label={`Hole ${strategy.holeNumber} of ${strategies.length}`}
        className="h-1.5"
      />

      <Card
        role="group"
        aria-roledescription="slide"
        aria-label={`Hole ${strategy.holeNumber} strategy`}
      >
        <CardHeader>
          <CardTitle>Hole {strategy.holeNumber} strategy</CardTitle>
          <CardAction>
            <Badge variant={strategy.confidence === "Low" ? "outline" : "secondary"}>
              {strategy.confidence} confidence
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-2">
          <StrategyItem
            title="Recommended club"
            value={strategy.recommendedClub}
            description={strategy.expectedCarryRange}
          />
          <StrategyItem
            title="Safe target"
            value={strategy.safeTarget}
            description={`Common miss: ${strategy.commonMiss}`}
          />
          <StrategyItem title="Main hazard" description={strategy.hazardWarning} />
          <StrategyItem
            title="Conservative alternative"
            description={strategy.conservativeAlternative}
          />
          <StrategyItem
            title="Expected leave"
            value={strategy.expectedLeave}
            description={plannedSequence(strategy)}
          />
          {courseTwinAvailable ? (
            <Button asChild variant="outline" className="mt-1 min-h-11">
              <Link href={`/play/${course.id}?mode=strategy&hole=${strategy.holeNumber}`}>
                <Cuboid className="size-4" aria-hidden />
                View this hole in Course Twin
              </Link>
            </Button>
          ) : (
            <Alert>
              <Cuboid aria-hidden />
              <AlertTitle>Course Twin unavailable</AlertTitle>
              <AlertDescription>
                This course has strategy data but no published 3D twin.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-xs leading-5 text-muted-foreground">{strategy.caveat}</p>

      {savedAt ? (
        <Alert>
          <Save aria-hidden />
          <AlertTitle>
            {savedCopyIsStale ? "Saved copy may be stale" : "Saved on this device"}
          </AlertTitle>
          <AlertDescription>
            {savedAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" · "}
            {savedCopyIsStale
              ? "Refresh it before the round. Course Twin still needs a connection."
              : "Hole strategy can be read here from this device. Course Twin still needs a connection."}
          </AlertDescription>
        </Alert>
      ) : null}

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
            setSavedAt(new Date());
            setSavedCopyIsStale(false);
          } catch {
            setDownloaded(false);
          }
        }}
      >
        <Save className="size-4" aria-hidden />
        {downloaded ? "Refresh Saved Strategy" : "Save Strategy on This Device"}
      </Button>
      {downloaded ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 rounded-xl"
          onClick={() => {
            window.localStorage.removeItem(`fkh:round-download:${accountId}:${course.id}`);
            setDownloaded(false);
            setSavedAt(null);
            setSavedCopyIsStale(false);
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          Clear saved strategy
        </Button>
      ) : null}
    </div>
  );
}

function StrategyItem({
  title,
  value,
  description,
}: {
  title: string;
  value?: string;
  description: string;
}) {
  return (
    <Item variant="muted" size="sm">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription className="whitespace-normal">{description}</ItemDescription>
      </ItemContent>
      {value ? (
        <ItemActions>
          <span className="max-w-32 text-right text-sm font-semibold">{value}</span>
        </ItemActions>
      ) : null}
    </Item>
  );
}

function plannedSequence(strategy: HoleStrategy) {
  const followUp = strategy.followUpClubs.map((club) => club.label).join(" → ");
  return followUp ? `${strategy.recommendedClub} → ${followUp}` : strategy.recommendedClub;
}
