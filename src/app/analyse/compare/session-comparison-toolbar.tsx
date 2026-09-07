"use client";

import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { ArrowRight, GitCompareArrows } from "lucide-react";

import { ComparisonSearchSheet } from "./comparison-search-sheet";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
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
  const formId = useId();
  const searchParams = useSearchParams();
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

  const advancedCount =
    Number(clubId !== "all") + Number(condition !== "same") + Number(selectedPeriod !== "sessions");
  function reset() {
    setFocusSessionId("");
    setBaselineSessionId("");
    setClubId("all");
    setCondition("same");
    setSelectedPeriod("sessions");
  }
  return (
    <form
      id={formId}
      action="/analyse/compare"
      className="grid min-w-0 gap-4 rounded-xl border bg-card p-4"
      data-comparison-toolbar
    >
      <input type="hidden" name="metric" value={searchParams.get("metric") ?? ""} />
      <input type="hidden" name="view" value={searchParams.get("view") ?? ""} />
      <input type="hidden" name="sessionId" value={focusSessionId} />
      <input type="hidden" name="baselineSessionId" value={baselineSessionId} />
      <input type="hidden" name="clubId" value={clubId === "all" ? "" : clubId} />
      <input type="hidden" name="condition" value={condition} />
      <input type="hidden" name="period" value={selectedPeriod} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <GitCompareArrows className="size-4" aria-hidden />
          Comparison setup
        </h2>
        <p className="text-sm text-muted-foreground">
          {sessions.length} available sessions · {clubs.length} clubs
        </p>
      </div>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <ComparisonSearchSheet
          label="Focus session"
          value={focusSessionId}
          onValueChange={setFocusSessionId}
          options={[
            { value: "", label: selectedPeriod === "month" ? "Latest 30 days" : "Latest session" },
            ...sessionOptions,
          ]}
        />
        <Button
          type="button"
          variant="outline"
          disabled={
            selectedPeriod !== "sessions" ||
            !focusSessionId ||
            !baselineSessionId ||
            focusSessionId === baselineSessionId
          }
          onClick={() => {
            setFocusSessionId(baselineSessionId);
            setBaselineSessionId(focusSessionId);
          }}
        >
          Swap sessions
        </Button>
        <ComparisonSearchSheet
          label="Baseline session"
          value={baselineSessionId}
          onValueChange={setBaselineSessionId}
          options={[
            {
              value: "",
              label: selectedPeriod === "month" ? "Previous 30 days" : "Automatic previous session",
            },
            ...sessionOptions.map((option) => ({
              ...option,
              disabled: selectedPeriod === "sessions" && option.value === focusSessionId,
            })),
          ]}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {selectedPeriod === "month"
          ? "Comparing adjacent 30-day periods; session choices do not change this period mode."
          : "Focus is compared against baseline. Apply to update results and the shareable URL."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline">
              Filters ({advancedCount})
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Comparison filters</SheetTitle>
              <SheetDescription>
                Choose the club, recorded environment and time scope.
              </SheetDescription>
            </SheetHeader>
            <div className="grid min-h-0 gap-5 overflow-y-auto p-4">
              <ToggleGroup
                type="single"
                value={selectedPeriod}
                onValueChange={(value) => value && setSelectedPeriod(value as "sessions" | "month")}
                aria-label="Comparison period"
              >
                <ToggleGroupItem value="sessions">Sessions</ToggleGroupItem>
                <ToggleGroupItem value="month">30 days</ToggleGroupItem>
              </ToggleGroup>
              <label className="grid gap-2 text-sm font-medium">
                Club
                <select
                  className="min-h-11 w-full rounded-lg border bg-background px-3"
                  value={clubId}
                  onChange={(event) => setClubId(event.target.value)}
                >
                  {clubOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Environment and conditions
                <select
                  className="min-h-11 w-full rounded-lg border bg-background px-3"
                  value={condition}
                  onChange={(event) => setCondition(event.target.value)}
                >
                  {conditionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button type="submit" form={formId}>
                Apply filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setClubId("all");
                  setCondition("same");
                  setSelectedPeriod("sessions");
                }}
              >
                Reset filters
              </Button>
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  Close filters
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
        <Button type="button" variant="outline" onClick={reset}>
          Clear all
        </Button>
        <Button type="submit">
          Compare
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
