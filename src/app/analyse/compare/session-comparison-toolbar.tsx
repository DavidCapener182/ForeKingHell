"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, GitCompareArrows } from "lucide-react";

import { EntityCombobox } from "@/components/app/entity-combobox";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type SessionOption = {
  id: string;
  label: string;
  dateLabel: string;
  shotCount: number;
};

type ClubOption = {
  id: string;
  label: string;
  shotCount: number;
};

type SessionComparisonToolbarProps = {
  sessions: SessionOption[];
  clubs: ClubOption[];
  initial: {
    focusSessionId: string;
    baselineSessionId: string;
    clubId: string;
    condition: string;
  };
  period: "sessions" | "month";
};

export function SessionComparisonToolbar({
  sessions,
  clubs,
  initial,
  period,
}: SessionComparisonToolbarProps) {
  const [focusSessionId, setFocusSessionId] = useState(initial.focusSessionId);
  const [baselineSessionId, setBaselineSessionId] = useState(initial.baselineSessionId);
  const [clubId, setClubId] = useState(initial.clubId || "all");
  const [condition, setCondition] = useState(initial.condition);
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  const sessionOptions = sessions.map((session) => ({
    value: session.id,
    label: session.label,
    description: `${session.dateLabel} · ${session.shotCount} shots`,
  }));
  const clubOptions = [
    { value: "all", label: "All clubs", description: "Every comparable stock shot" },
    ...clubs.map((club) => ({
      value: club.id,
      label: club.label,
      description: `${club.shotCount} comparable shots`,
    })),
  ];
  const conditionOptions = [
    {
      value: "same",
      label: "As recorded",
      description: "Compare the selected samples without changing their environment",
    },
    {
      value: "indoor-outdoor",
      label: "Outdoor vs indoor",
      description: "Outdoor and on-course shots against indoor shots",
    },
    {
      value: "practice-round",
      label: "Round vs practice",
      description: "On-course shots against practice environments",
    },
  ];

  return (
    <form
      action="/analyse/compare"
      className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
      data-comparison-toolbar
    >
      <input type="hidden" name="sessionId" value={focusSessionId} />
      <input type="hidden" name="baselineSessionId" value={baselineSessionId} />
      <input type="hidden" name="clubId" value={clubId === "all" ? "" : clubId} />
      <input type="hidden" name="condition" value={condition} />
      <input type="hidden" name="period" value={selectedPeriod} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/25 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GitCompareArrows className="size-4 text-primary" aria-hidden />
          Comparison setup
        </div>
        <ToggleGroup
          type="single"
          value={selectedPeriod}
          onValueChange={(value) => value && setSelectedPeriod(value as "sessions" | "month")}
          variant="outline"
          spacing={0}
          size="sm"
          aria-label="Comparison period"
        >
          <ToggleGroupItem value="sessions">Sessions</ToggleGroupItem>
          <ToggleGroupItem value="month">30 days</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid lg:grid-cols-[minmax(12rem,1.25fr)_auto_minmax(12rem,1.25fr)_minmax(9rem,0.8fr)_minmax(10rem,0.9fr)_auto] lg:items-stretch">
        <ToolbarField
          label="Focus session"
          className="border-b border-border/70 lg:border-b-0 lg:border-r"
        >
          <EntityCombobox
            label="Focus session"
            value={focusSessionId}
            onValueChange={setFocusSessionId}
            options={sessionOptions}
            placeholder={selectedPeriod === "month" ? "Latest 30 days" : "Choose focus session"}
            searchPlaceholder="Search focus sessions…"
            emptyLabel="No matching session."
            className="h-9 border-0 bg-transparent px-0 shadow-none hover:bg-transparent"
          />
        </ToolbarField>

        <div className="hidden items-center justify-center border-r border-border/70 px-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground lg:flex">
          vs
        </div>

        <ToolbarField
          label="Baseline session"
          className="border-b border-border/70 lg:border-b-0 lg:border-r"
        >
          <EntityCombobox
            label="Baseline session"
            value={baselineSessionId}
            onValueChange={setBaselineSessionId}
            options={sessionOptions.map((option) => ({
              ...option,
              disabled: selectedPeriod === "sessions" && option.value === focusSessionId,
            }))}
            placeholder={
              selectedPeriod === "month" ? "Previous 30 days" : "Automatic previous session"
            }
            searchPlaceholder="Search baseline sessions…"
            emptyLabel="No matching session."
            className="h-9 border-0 bg-transparent px-0 shadow-none hover:bg-transparent"
          />
        </ToolbarField>

        <ToolbarField label="Club" className="border-b border-border/70 lg:border-b-0 lg:border-r">
          <EntityCombobox
            label="Club"
            value={clubId}
            onValueChange={setClubId}
            options={clubOptions}
            placeholder="All clubs"
            searchPlaceholder="Search clubs…"
            emptyLabel="No matching club."
            className="h-9 border-0 bg-transparent px-0 shadow-none hover:bg-transparent"
          />
        </ToolbarField>

        <ToolbarField
          label="Environment / conditions"
          className="border-b border-border/70 lg:border-b-0 lg:border-r"
        >
          <EntityCombobox
            label="Environment and conditions"
            value={condition}
            onValueChange={setCondition}
            options={conditionOptions}
            placeholder="As recorded"
            searchPlaceholder="Search conditions…"
            emptyLabel="No matching condition."
            className="h-9 border-0 bg-transparent px-0 shadow-none hover:bg-transparent"
          />
        </ToolbarField>

        <div className="flex items-stretch p-2.5">
          <Button type="submit" className="min-h-11 w-full px-4 lg:min-h-0">
            Compare
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </form>
  );
}

function ToolbarField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 px-3 py-2 ${className ?? ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 min-w-0">{children}</div>
    </div>
  );
}
