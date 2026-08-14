"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { DataToolbar } from "@/components/app/data-toolbar";
import { EntityCombobox } from "@/components/app/entity-combobox";
import { ResponsiveFilterPanel } from "@/components/app/responsive-filter-panel";
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  const sessionOptions = sessions
    .filter((session) => session.label.toLowerCase().includes(query.trim().toLowerCase()))
    .map((session) => ({
      value: session.id,
      label: session.label,
      description: `${session.dateLabel} · ${session.shotCount} shots`,
    }));
  const clubOptions = [
    { value: "all", label: "All clubs", description: "Use every comparable shot" },
    ...clubs.map((club) => ({
      value: club.id,
      label: club.label,
      description: `${club.shotCount} comparable shots`,
    })),
  ];
  const activeFilterCount = Number(clubId !== "all") + Number(condition !== "same");

  return (
    <form
      action="/analyse/compare"
      className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm"
      data-comparison-toolbar
    >
      <input type="hidden" name="sessionId" value={focusSessionId} />
      <input type="hidden" name="baselineSessionId" value={baselineSessionId} />
      <input type="hidden" name="clubId" value={clubId === "all" ? "" : clubId} />
      <input type="hidden" name="condition" value={condition} />
      <input type="hidden" name="period" value={selectedPeriod} />

      <DataToolbar
        query={query}
        onQueryChange={setQuery}
        searchLabel="Search comparison sessions"
        resultLabel={`${sessions.length} sessions available`}
        activeFilters={[
          ...(clubId !== "all"
            ? [{ id: "club", label: "Club filtered", onRemove: () => setClubId("all") }]
            : []),
          ...(condition !== "same"
            ? [
                {
                  id: "condition",
                  label: "Condition matched",
                  onRemove: () => setCondition("same"),
                },
              ]
            : []),
        ]}
        filters={
          <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-2 xl:min-w-[42rem]">
            <EntityCombobox
              label="Focus session"
              value={focusSessionId}
              onValueChange={setFocusSessionId}
              options={sessionOptions}
              placeholder="Choose the session to review"
              searchPlaceholder="Search sessions…"
              emptyLabel="No matching session."
            />
            <EntityCombobox
              label="Baseline session"
              value={baselineSessionId}
              onValueChange={setBaselineSessionId}
              options={sessionOptions}
              placeholder="Choose a baseline"
              searchPlaceholder="Search sessions…"
              emptyLabel="No matching session."
            />
          </div>
        }
        actions={
          <>
            <ResponsiveFilterPanel
              open={filterOpen}
              onOpenChange={setFilterOpen}
              title="Comparison filters"
              description="Narrow both samples using the same club and shot condition."
              activeCount={activeFilterCount}
              applyAction={
                <Button type="button" onClick={() => setFilterOpen(false)}>
                  Apply filters
                </Button>
              }
            >
              <div className="space-y-5">
                <EntityCombobox
                  label="Club"
                  value={clubId}
                  onValueChange={setClubId}
                  options={clubOptions}
                  placeholder="All clubs"
                  searchPlaceholder="Search clubs…"
                  emptyLabel="No matching club."
                />
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-foreground">Shot condition</legend>
                  <ButtonGroup className="w-full" aria-label="Shot condition">
                    {[
                      ["same", "Selected"],
                      ["indoor-outdoor", "Indoor/outdoor"],
                      ["practice-round", "Practice/round"],
                    ].map(([value, label]) => (
                      <Button
                        key={value}
                        type="button"
                        variant={condition === value ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setCondition(value)}
                        aria-pressed={condition === value}
                      >
                        {label}
                      </Button>
                    ))}
                  </ButtonGroup>
                </fieldset>
              </div>
            </ResponsiveFilterPanel>
            <Button type="submit">Compare</Button>
          </>
        }
        className="border-0 p-0 shadow-none"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <p className="text-xs text-muted-foreground">
          The same filters are applied to both samples so the result stays comparable.
        </p>
        <ToggleGroup
          type="single"
          value={selectedPeriod}
          onValueChange={(value) => value && setSelectedPeriod(value as "sessions" | "month")}
          aria-label="Comparison period"
        >
          <ToggleGroupItem value="sessions">Sessions</ToggleGroupItem>
          <ToggleGroupItem value="month">30-day view</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </form>
  );
}
