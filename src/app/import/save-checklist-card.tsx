"use client";

import { CheckCircle2, Upload, WifiOff } from "lucide-react";

import { ChecklistItem } from "@/app/import/import-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SaveChecklistCard({
  hasFiles,
  hasShots,
  hasCompleteCourseMapping,
  hasNoWarnings,
  isOnline,
  isPending,
  canSave,
  onSave,
}: {
  hasFiles: boolean;
  hasShots: boolean;
  hasCompleteCourseMapping: boolean;
  hasNoWarnings: boolean;
  isOnline: boolean;
  isPending: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
  const checks = [
    { label: "File", complete: hasFiles },
    { label: "Shots", complete: hasShots },
    { label: "Clubs", complete: hasCompleteCourseMapping },
    { label: "Audit", complete: hasNoWarnings },
  ];
  const readyCount = checks.filter((check) => check.complete).length;

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle>Step 4: Save import</CardTitle>
        <CardDescription>
          Save only when the checklist is green. Successful saves show PBs, achievements, and
          updated yardages.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2 text-sm sm:hidden">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-border bg-background/70 px-3 py-2 text-xs">
            {checks.map((check) => (
              <span
                key={check.label}
                className={check.complete ? "font-semibold text-primary" : "text-muted-foreground"}
              >
                {check.label} {check.complete ? "✓" : "Review"}
              </span>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {readyCount}/4 checks ready. The status strip above stays visible while you review.
          </p>
        </div>
        <div className="hidden gap-2 text-sm sm:grid">
          <ChecklistItem complete={hasFiles}>CSV file selected</ChecklistItem>
          <ChecklistItem complete={hasShots}>Shots detected</ChecklistItem>
          <ChecklistItem complete={hasCompleteCourseMapping}>Round mapping complete</ChecklistItem>
          <ChecklistItem complete={hasNoWarnings}>Warnings reviewed</ChecklistItem>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={!canSave}
          onClick={onSave}
          className="premium-action rounded-lg"
        >
          {!isOnline ? (
            <WifiOff className="size-4" />
          ) : canSave ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Upload className="size-4" />
          )}
          {isPending ? "Saving…" : isOnline ? "Save import" : "Queue offline"}
        </Button>
      </CardContent>
    </Card>
  );
}
