"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cuboid, Save, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
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
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const strategy = strategies[index];

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!carouselApi) return;
    const syncIndex = () => setIndex(carouselApi.selectedScrollSnap());
    syncIndex();
    carouselApi.on("select", syncIndex);
    carouselApi.on("reInit", syncIndex);
    return () => {
      carouselApi.off("select", syncIndex);
      carouselApi.off("reInit", syncIndex);
    };
  }, [carouselApi]);

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
    <Carousel
      opts={{ align: "start", containScroll: "trimSnaps" }}
      setApi={setCarouselApi}
      className="grid min-w-0 gap-3"
      data-mobile-one-hole-strategy
      data-hydrated={hydrated ? "true" : "false"}
      aria-label="Hole-by-hole course strategy"
    >
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
        <CarouselPrevious
          className="static size-11 translate-y-0 rounded-xl"
          disabled={!hydrated || index === 0}
          aria-label="Previous hole"
        />
        <div className="text-center">
          <p className="text-lg font-bold">
            Hole {strategy.holeNumber} of {strategies.length}
          </p>
          <p className="text-xs text-muted-foreground">
            Par {strategy.par} · {strategy.yards} yd
          </p>
        </div>
        <CarouselNext
          className="static size-11 translate-y-0 rounded-xl"
          disabled={!hydrated || index === strategies.length - 1}
          aria-label="Next hole"
        />
      </div>

      <Progress
        value={((index + 1) / strategies.length) * 100}
        aria-label={`Hole ${strategy.holeNumber} of ${strategies.length}`}
        className="h-1.5"
      />

      <CarouselContent className="-ml-0">
        {strategies.map((holeStrategy) => (
          <CarouselItem key={holeStrategy.holeNumber} className="pl-0">
            <Card aria-label={`Hole ${holeStrategy.holeNumber} strategy`}>
              <CardHeader>
                <CardTitle>Hole {holeStrategy.holeNumber} strategy</CardTitle>
                <CardAction>
                  <Badge variant={holeStrategy.confidence === "Low" ? "outline" : "secondary"}>
                    {holeStrategy.confidence} confidence
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="grid gap-2">
                <StrategyItem
                  title="Recommended club"
                  value={holeStrategy.recommendedClub}
                  description={holeStrategy.expectedCarryRange}
                  valueAsBadge
                />
                <StrategyItem
                  title="Safe target"
                  value={holeStrategy.safeTarget}
                  description={`Common miss: ${holeStrategy.commonMiss}`}
                />
                <StrategyItem title="Main hazard" description={holeStrategy.hazardWarning} />
                <StrategyItem
                  title="Conservative alternative"
                  description={holeStrategy.conservativeAlternative}
                />
                <StrategyItem
                  title="Expected leave"
                  value={holeStrategy.expectedLeave}
                  description={plannedSequence(holeStrategy)}
                />
                {courseTwinAvailable ? (
                  <Button asChild variant="outline" className="mt-1 min-h-11">
                    <Link href={`/play/${course.id}?mode=strategy&hole=${holeStrategy.holeNumber}`}>
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
          </CarouselItem>
        ))}
      </CarouselContent>

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
    </Carousel>
  );
}

function StrategyItem({
  title,
  value,
  description,
  valueAsBadge = false,
}: {
  title: string;
  value?: string;
  description: string;
  valueAsBadge?: boolean;
}) {
  return (
    <Item variant="muted" size="sm">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription className="whitespace-normal">{description}</ItemDescription>
      </ItemContent>
      {value ? (
        <ItemActions>
          {valueAsBadge ? (
            <Badge variant="secondary">{value}</Badge>
          ) : (
            <span className="max-w-32 text-right text-sm font-semibold">{value}</span>
          )}
        </ItemActions>
      ) : null}
    </Item>
  );
}

function plannedSequence(strategy: HoleStrategy) {
  const followUp = strategy.followUpClubs.map((club) => club.label).join(" → ");
  return followUp ? `${strategy.recommendedClub} → ${followUp}` : strategy.recommendedClub;
}
