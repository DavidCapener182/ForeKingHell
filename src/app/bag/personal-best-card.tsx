"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatClubType } from "@/lib/club-format";

export type PersonalBestMetric = "carry" | "total";

type PersonalBestClub = {
  id: string;
  type: string;
  personalBest: {
    carryYd: number | null;
    totalYd: number | null;
  };
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const PERSONAL_BEST_METRIC_OPTIONS: Array<{
  value: PersonalBestMetric;
  label: string;
}> = [
  { value: "carry", label: "Carry" },
  { value: "total", label: "Total" },
];

export function PersonalBestCard({
  clubs,
  initialMetric,
  variant = "card",
}: {
  clubs: PersonalBestClub[];
  initialMetric: PersonalBestMetric;
  variant?: "card" | "inline";
}) {
  const [metric, setMetric] = useState(initialMetric);
  const maxPersonalBest = useMemo(
    () => Math.max(1, ...clubs.map((club) => personalBestValueYd(club, metric) ?? 0)),
    [clubs, metric],
  );
  const header = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <CardTitle className="text-lg tracking-normal">Personal bests</CardTitle>
        <CardDescription>
          Best clean {personalBestMetricLabel(metric).toLowerCase()} by club.
        </CardDescription>
      </div>
      <PersonalBestMetricToggle metric={metric} onMetricChange={setMetric} />
    </div>
  );
  const rows = <PersonalBestRows clubs={clubs} metric={metric} maxPersonalBest={maxPersonalBest} />;

  if (variant === "inline") {
    return (
      <div className="grid gap-3">
        {header}
        {rows}
      </div>
    );
  }

  return (
    <Card className="premium-card w-full">
      <CardHeader className="p-4">{header}</CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">{rows}</CardContent>
    </Card>
  );
}

function PersonalBestRows({
  clubs,
  metric,
  maxPersonalBest,
}: {
  clubs: PersonalBestClub[];
  metric: PersonalBestMetric;
  maxPersonalBest: number;
}) {
  return (
    <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-4">
      {clubs.map((club) => {
        const valueYd = personalBestValueYd(club, metric);
        const otherValueYd = personalBestValueYd(club, metric === "carry" ? "total" : "carry");

        return (
          <Link
            key={club.id}
            href={`/bag/${club.id}`}
            prefetch={false}
            className="grid gap-1 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40 hover:bg-accent/35"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{formatClubType(club.type)}</span>
              <span className="font-semibold">
                {formatMetric(valueYd)}
                {valueYd === null ? "" : " yd"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <span
                className="block h-2 rounded-full bg-primary"
                style={{ width: `${carryWidthPercent(valueYd, maxPersonalBest)}%` }}
              />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {metric === "carry" ? "Total" : "Carry"} {formatMetric(otherValueYd)}
              {otherValueYd === null ? "" : " yd"}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

function PersonalBestMetricToggle({
  metric,
  onMetricChange,
}: {
  metric: PersonalBestMetric;
  onMetricChange: (metric: PersonalBestMetric) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={metric}
      onValueChange={(value) => value && onMetricChange(value as PersonalBestMetric)}
      variant="outline"
      spacing={0}
      aria-label="Personal best metric"
      className="grid grid-cols-2 bg-card"
    >
      {PERSONAL_BEST_METRIC_OPTIONS.map((option) => {
        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="h-8 rounded-md px-2 text-xs"
          >
            {option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

function personalBestMetricLabel(metric: PersonalBestMetric) {
  return metric === "total" ? "Total" : "Carry";
}

function personalBestValueYd(club: PersonalBestClub, metric: PersonalBestMetric) {
  return metric === "total" ? club.personalBest.totalYd : club.personalBest.carryYd;
}

function carryWidthPercent(carryYd: number | null, maxCarry: number) {
  if (carryYd === null || carryYd <= 0 || maxCarry <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((carryYd / maxCarry) * 100));
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}
