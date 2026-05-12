"use client";

import { Upload, WifiOff } from "lucide-react";

import { ChecklistItem } from "@/app/import/import-stepper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle>Step 4: Save import</CardTitle>
        <CardDescription>
          Save only when the checklist is green. Successful saves show PBs, achievements, and updated yardages.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2 text-sm">
          <ChecklistItem complete={hasFiles}>CSV file selected</ChecklistItem>
          <ChecklistItem complete={hasShots}>Shots detected</ChecklistItem>
          <ChecklistItem complete={hasCompleteCourseMapping}>Round mapping complete</ChecklistItem>
          <ChecklistItem complete={hasNoWarnings}>Warnings reviewed</ChecklistItem>
        </div>
        <Button type="button" size="lg" disabled={!canSave} onClick={onSave} className="bg-[#111827] text-white">
          {!isOnline ? <WifiOff className="size-4" /> : <Upload className="size-4" />}
          {isPending ? "Saving..." : isOnline ? "Save import" : "Queue offline"}
        </Button>
      </CardContent>
    </Card>
  );
}
