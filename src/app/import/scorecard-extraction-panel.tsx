"use client";

import type { RefObject } from "react";
import { ImageIcon, Loader2, MapPinned } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ScorecardExtractState } from "@/app/import/import-types";

export function ScorecardExtractionPanel({
  scorecardImageInputRef,
  scorecardExtractState,
  courseName,
  scorecardText,
  holeCount,
  totalYards,
  onApplySawgrassPreset,
  onExtractScorecardImage,
  onCourseNameChange,
  onScorecardTextChange,
}: {
  scorecardImageInputRef: RefObject<HTMLInputElement | null>;
  scorecardExtractState: ScorecardExtractState;
  courseName: string;
  scorecardText: string;
  holeCount: number;
  totalYards: number;
  onApplySawgrassPreset: () => void;
  onExtractScorecardImage: (file: File | null | undefined) => void | Promise<void>;
  onCourseNameChange: (value: string) => void;
  onScorecardTextChange: (value: string) => void;
}) {
  return (
    <div className="apple-panel space-y-4 p-4">
      <div className="flex items-start gap-3">
        <MapPinned className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Course scorecard</p>
            <p className="text-sm leading-6 text-muted-foreground">
              The CSV does not include hole labels, so the app uses the scorecard, shot order, and
              review rows below to map shots to holes. Enter a hole score and anything above CSV
              shots plus penalties is treated as putts.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onApplySawgrassPreset}>
            Use sample TPC Sawgrass scorecard
          </Button>
          <input
            ref={scorecardImageInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(event) => {
              void onExtractScorecardImage(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <div className="flex flex-col gap-2 rounded-lg bg-white/90 p-3 ring-1 ring-slate-200/80 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Scorecard screenshot</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Upload an 18Birdies scorecard image to pull scores, putts, FIR, GIR, handicap
                strokes and the round date into the review rows.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={scorecardExtractState.status === "loading"}
              onClick={() => scorecardImageInputRef.current?.click()}
            >
              {scorecardExtractState.status === "loading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImageIcon className="size-4" />
              )}
              {scorecardExtractState.status === "loading" ? "Reading…" : "Upload image"}
            </Button>
          </div>
          {scorecardExtractState.status !== "idle" ? (
            <p
              className={cn(
                "text-xs leading-5",
                scorecardExtractState.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {scorecardExtractState.status === "loading"
                ? `Extracting ${scorecardExtractState.fileName}…`
                : scorecardExtractState.message}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="course-name">
            Course name
          </label>
          <Input
            id="course-name"
            value={courseName}
            onChange={(event) => onCourseNameChange(event.target.value)}
            placeholder="Confirm course name"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="scorecard">
            Scorecard rows
          </label>
          <textarea
            id="scorecard"
            value={scorecardText}
            onChange={(event) => onScorecardTextChange(event.target.value)}
            placeholder={"1,4,423,Opening\n2,5,532\n3,3,177"}
            className="min-h-28 w-full resize-y rounded-lg border border-input bg-white/90 px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">
            {holeCount > 0
              ? `${holeCount} holes, ${totalYards.toLocaleString("en-GB")} yards`
              : "Use one row per hole: hole, par, yards, optional name."}
          </p>
        </div>
      </div>
    </div>
  );
}
