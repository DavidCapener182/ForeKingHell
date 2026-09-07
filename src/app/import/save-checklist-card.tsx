"use client";
import { Upload, WifiOff } from "lucide-react";
import { ChecklistItem } from "./import-stepper";
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
  settingsConfirmed = true,
  fileCount,
  shotCount,
  sessionSummary,
}: {
  hasFiles: boolean;
  hasShots: boolean;
  hasCompleteCourseMapping: boolean;
  hasNoWarnings: boolean;
  isOnline: boolean;
  isPending: boolean;
  canSave: boolean;
  onSave: () => void;
  settingsConfirmed?: boolean;
  fileCount?: number;
  shotCount?: number;
  sessionSummary?: string;
}) {
  return (
    <Card id="import-save" className="scroll-mt-28 shadow-sm" data-import-save-checklist>
      <CardHeader>
        <CardTitle>Review and save</CardTitle>
        <CardDescription>
          {fileCount !== undefined ? `${fileCount} files · ${shotCount ?? 0} parsed shots. ` : ""}
          {sessionSummary}
          <span className="mt-1 block">
            Saving adds session evidence and updates eligible yardages. Existing duplicate checks
            still apply.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <ChecklistItem complete={hasFiles}>CSV files selected</ChecklistItem>
          <ChecklistItem complete={settingsConfirmed}>Session settings confirmed</ChecklistItem>
          <ChecklistItem complete={hasShots}>Shots detected</ChecklistItem>
          <ChecklistItem complete={hasCompleteCourseMapping}>Round mapping ready</ChecklistItem>
          <ChecklistItem complete={hasNoWarnings}>Warnings reviewed</ChecklistItem>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="#import-preview" className="inline-flex min-h-11 items-center text-sm underline">
            Back to shot review
          </a>
          <Button
            type="button"
            size="lg"
            disabled={!canSave || isPending}
            aria-busy={isPending}
            onClick={onSave}
            className="min-h-12 rounded-lg"
          >
            {isOnline ? <Upload size={18} aria-hidden /> : <WifiOff size={18} aria-hidden />}
            {isPending ? "Saving…" : isOnline ? "Save import" : "Queue offline"}
          </Button>
        </div>
        {!canSave && !isPending ? (
          <p className="text-xs text-muted-foreground">
            Complete the outstanding checks above. Sample data is preview only.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
