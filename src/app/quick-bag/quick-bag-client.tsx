"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

const EntityCombobox = dynamic(
  () => import("@/components/app/entity-combobox").then((module) => module.EntityCombobox),
  {
    ssr: false,
    loading: () => (
      <Button
        type="button"
        variant="outline"
        disabled
        aria-busy="true"
        aria-label="Loading club or target"
        className="min-h-12 w-full justify-between rounded-xl bg-background text-base font-normal"
      >
        Loading club or target…
      </Button>
    ),
  },
);

const QuickBagClubDrawer = dynamic(() =>
  import("@/app/quick-bag/quick-bag-club-drawer").then((module) => module.QuickBagClubDrawer),
);

export function QuickBagClient({ clubs, accountId }: { clubs: QuickBagClub[]; accountId: string }) {
  const [targetDistance, setTargetDistance] = useState("");
  const [preference, setPreference] = useState<TargetPreference>("finish");
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const target = Number(targetDistance);
  const filtered = useMemo(() => {
    return Number.isFinite(target) && target > 0
      ? rankQuickBagForTarget(clubs, target, preference)
      : clubs;
  }, [clubs, preference, target]);
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
      <Card
        size="sm"
        className="gap-3"
        aria-label="Quick Bag search"
        data-quick-bag-hydrated={hydrated ? "true" : "false"}
      >
        <CardHeader>
          <CardTitle>Find the number</CardTitle>
          <CardDescription>Search one club or enter the target you need to cover.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <EntityCombobox
            label="Club or target"
            value={
              targetDistance
                ? `target:${targetDistance}`
                : selectedClubId
                  ? `club:${selectedClubId}`
                  : ""
            }
            placeholder="Search club or enter target"
            searchPlaceholder="Club name or target yards…"
            emptyLabel="Type a target distance or search another club."
            options={[
              ...quickTargets.map((value) => ({
                value: `target:${value}`,
                label: `${value} yards`,
                description: "Common target",
              })),
              ...clubs.map((club) => ({
                value: `club:${club.id}`,
                label: club.label,
                description: `${club.model} · carry ${yardValue(club.trustedCarryYd)}`,
              })),
            ]}
            onValueChange={(value) => {
              if (value.startsWith("target:")) {
                setTargetDistance(value.slice("target:".length));
                setSelectedClubId(null);
                return;
              }
              setTargetDistance("");
              setSelectedClubId(value.slice("club:".length));
            }}
            customValueLabel={(value) =>
              /^\d{2,3}$/.test(value) && Number(value) >= 40 && Number(value) <= 350
                ? `Use ${value} yards`
                : null
            }
            onCustomValue={(value) => {
              setTargetDistance(value);
              setSelectedClubId(null);
            }}
            className="min-h-12 rounded-xl bg-background text-base"
          />
          <ToggleGroup
            type="single"
            value={quickTargets.includes(target) ? String(target) : ""}
            onValueChange={(value) => {
              if (!value) return;
              setTargetDistance(value);
              setSelectedClubId(null);
            }}
            variant="outline"
            className="flex justify-start gap-2 overflow-x-auto"
            aria-label="Common target distances"
          >
            {quickTargets.map((value) => (
              <ToggleGroupItem
                key={value}
                value={String(value)}
                className="min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold"
              >
                {value}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={preference}
            onValueChange={(value) => {
              if (value !== "carry" && value !== "finish") return;
              setPreference(value);
              setSelectedClubId(null);
            }}
            variant="outline"
            className="grid grid-cols-2 rounded-xl bg-secondary p-1"
            aria-label="Number type"
          >
            <ToggleGroupItem value="carry" className="min-h-11 rounded-lg text-sm font-semibold">
              Carry
            </ToggleGroupItem>
            <ToggleGroupItem value="finish" className="min-h-11 rounded-lg text-sm font-semibold">
              Play number
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      {bestMatch ? (
        <Card className="border-primary/25 bg-primary/5" data-quick-bag-best-match>
          <CardHeader>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Best match for {Math.round(target)} yards
              </p>
              <h2 className="mt-1 text-2xl font-bold">{bestMatch.label}</h2>
              <p className="text-sm text-muted-foreground">{bestMatch.model}</p>
            </div>
            <CardAction>
              <Badge variant={bestMatch.confidence >= 75 ? "default" : "secondary"}>
                {bestMatch.confidence}% confidence
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <QuickMetric label="Play number" value={yardValue(bestMatch.playNumberYd)} />
              <QuickMetric label="Trusted carry" value={yardValue(bestMatch.trustedCarryYd)} />
              <QuickMetric label="Measured range" value={rangeLabel(bestMatch)} />
              <QuickMetric label="Typical pattern" value={patternLabel(bestMatch)} />
            </div>
            <LateralRange club={bestMatch} />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedClubId(bestMatch.id);
                setDetailOpen(true);
              }}
            >
              View club detail
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card size="sm">
        <CardHeader>
          <CardTitle>{bestMatch ? "Alternatives" : "Trusted numbers"}</CardTitle>
          <CardDescription>
            {filtered.length} active {filtered.length === 1 ? "club" : "clubs"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(bestMatch ? filtered.slice(1) : filtered).map((club) => (
            <Item key={club.id} size="sm">
              <ItemMedia>
                <Target className="size-4 text-primary" aria-hidden />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{club.label}</ItemTitle>
                <ItemDescription>
                  {club.model} · {rangeLabel(club)} · {patternLabel(club)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <div className="text-right">
                  <p className="font-semibold">{yardValue(club.trustedCarryYd)}</p>
                  <Badge variant="outline" className="mt-1">
                    {confidenceLabel(club)}
                  </Badge>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedClubId(club.id);
                    setDetailOpen(true);
                  }}
                >
                  Detail
                </Button>
              </ItemActions>
            </Item>
          ))}
          {filtered.length === 0 ? (
            <AppEmptyState
              title="No matching club"
              description="Try another target or build trusted club numbers from measured shots."
              primaryAction={
                <Button type="button" size="sm" onClick={() => setTargetDistance("")}>
                  Show trusted clubs
                </Button>
              }
              className="border-0 p-4 shadow-none"
            />
          ) : null}
        </CardContent>
        <p className="px-1 text-xs leading-5 text-muted-foreground">
          Play number is the recommended stock number. “Plays like” is reserved for a live
          conditions-adjusted value.
        </p>
      </Card>

      {detailOpen ? (
        <QuickBagClubDrawer club={selectedClub} open onOpenChange={setDetailOpen} />
      ) : null}
    </>
  );
}

function QuickMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
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
      className="rounded-xl border bg-card p-4"
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
