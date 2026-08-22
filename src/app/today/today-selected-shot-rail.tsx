"use client";

import { useState } from "react";
import { Ban, RotateCcw, X } from "lucide-react";

import { ShotDeleteButton, ShotReviewButton } from "@/app/shots/shot-review-controls";
import {
  SelectedShotDetail,
  type ShotMasterDetailRow,
} from "@/app/shots/shots-master-detail-table";
import type { TodayChartShot } from "@/app/today/today-shot-types";
import { Button } from "@/components/ui/button";
import { isRestorableShotReviewStatus } from "@/lib/shot-review";

export function TodaySelectedShotRail({
  shot,
  onClose,
}: {
  shot: TodayChartShot;
  onClose: () => void;
}) {
  const [detailTab, setDetailTab] = useState<"overview" | "source" | "history">("overview");
  const detail = shot.detail ?? null;
  const reviewLabel = detail ? selectedShotReviewLabel(detail.reviewStatus) : "Exclude from stats";

  return (
    <section
      aria-label="Selected chart shot details"
      data-today-selected-shot={shot.id}
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            Selected shot
          </p>
          <h3 className="mt-1 truncate text-base font-semibold text-foreground">
            {detail?.clubLabel ?? shot.clubLabel} · shot{" "}
            {detail?.shotNumberLabel ?? shot.shotNumber ?? "--"}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {detail?.shotAtLabel ?? "Today"} · {detail?.fileNameLabel ?? "Measured session"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close selected shot details"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>

      {detail ? (
        <>
          <div className="grid gap-2 border-b border-border bg-muted/15 p-4 sm:grid-cols-2">
            <ShotReviewButton
              shotId={detail.id}
              reviewStatus={detail.reviewStatus}
              trigger={
                <Button type="button" variant="outline" className="w-full justify-between">
                  {reviewLabel}
                  {isRestorableShotReviewStatus(detail.reviewStatus) ? (
                    <RotateCcw className="size-4" />
                  ) : (
                    <Ban className="size-4" />
                  )}
                </Button>
              }
            />
            {detail.canDeletePermanently ? (
              <ShotDeleteButton shotId={detail.id} onComplete={onClose} />
            ) : (
              <div
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground sm:col-span-2"
                data-course-shot-delete-restricted
              >
                This course-managed shot can be excluded from stats here. Permanent deletion is only
                available in its course or round workflow so the score stays correct.
              </div>
            )}
          </div>
          <SelectedShotDetail
            shot={detail}
            tab={detailTab}
            onTabChange={setDetailTab}
            compact
            onDeleteComplete={onClose}
            showActions={false}
          />
        </>
      ) : (
        <div className="grid gap-3 p-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Metric label="Carry" value={formatDistance(shot.carryYd)} />
            <Metric label="Total" value={formatDistance(shot.totalYd)} />
            <Metric label="Side" value={formatSide(shot.sideCarryYd)} />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Detailed source and review history are unavailable for this chart instance.
          </p>
        </div>
      )}
    </section>
  );
}

function selectedShotReviewLabel(reviewStatus: ShotMasterDetailRow["reviewStatus"]) {
  if (reviewStatus === "suggested_exclusion") return "Keep in stats";
  if (isRestorableShotReviewStatus(reviewStatus)) return "Restore to stats";
  return "Exclude from stats";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatDistance(value: number | null) {
  return value === null ? "--" : `${Math.round(value * 10) / 10} yd`;
}

function formatSide(value: number | null) {
  if (value === null) return "--";
  if (value === 0) return "0 yd";
  return `${Math.abs(Math.round(value * 10) / 10)} yd ${value < 0 ? "L" : "R"}`;
}
