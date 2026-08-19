"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { Ban, LoaderCircle, RotateCcw } from "lucide-react";

import { excludeShotAction, restoreShotAction, reviewShotsAction } from "@/app/(app)/shots/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  isRestorableShotReviewStatus,
  type ShotReviewStatus,
  type UserShotReviewStatus,
} from "@/lib/shot-review";

type ReviewClassificationStatus = Exclude<UserShotReviewStatus, "restored">;

const reviewStatusOptions: Array<{ value: ReviewClassificationStatus; label: string }> = [
  { value: "user_excluded", label: "User excluded" },
  { value: "calibration", label: "Calibration shot" },
  { value: "warm_up", label: "Warm-up shot" },
  { value: "launch_monitor_error", label: "Launch-monitor error" },
];

const confidenceOptions = [
  { value: "1", label: "Certain · 100%" },
  { value: "0.75", label: "Likely · 75%" },
  { value: "0.5", label: "Unsure · 50%" },
];

export function ShotReviewButton({
  shotId,
  reviewStatus,
  trigger,
}: {
  shotId: string;
  reviewStatus: ShotReviewStatus;
  trigger?: ReactNode;
}) {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ReviewClassificationStatus>("user_excluded");
  const [reason, setReason] = useState("Removed after reviewing the source evidence.");
  const [confidence, setConfidence] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const restoring = isRestorableShotReviewStatus(reviewStatus);
  const keepingSuggestion = reviewStatus === "suggested_exclusion";

  function submitReview() {
    startTransition(async () => {
      setError(null);
      try {
        if (restoring) {
          await restoreShotAction(shotId, reason);
        } else if (status === "user_excluded") {
          await excludeShotAction(shotId, { reason, confidence: Number(confidence) });
        } else {
          await reviewShotsAction({
            shotIds: [shotId],
            status,
            reason,
            confidence: Number(confidence),
          });
        }
        setOpen(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not review this shot.");
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          setOpen(nextOpen);
          if (nextOpen) {
            setError(null);
            setReason(
              keepingSuggestion
                ? "Kept after reviewing the source evidence; suggested exclusion dismissed."
                : restoring
                  ? "Restored after reviewing the source evidence."
                  : "Removed after reviewing the source evidence.",
            );
          }
        }
      }}
    >
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" className="justify-between">
            {keepingSuggestion ? "Keep shot" : restoring ? "Restore shot" : "Review shot"}
            {restoring ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {keepingSuggestion
              ? "Keep this shot?"
              : restoring
                ? "Restore this shot?"
                : "Review this shot"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {keepingSuggestion
              ? "The suggested exclusion will be dismissed and this shot will be kept in trusted calculations. Raw source evidence and review history remain unchanged."
              : restoring
                ? "The exact quality flag saved before exclusion will be restored. Source data and review history remain unchanged."
                : "The shot stays in raw history. Trusted calculations use the review status and a reversible compatibility flag."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 py-1">
          {!restoring ? (
            <div className="grid gap-2">
              <Label htmlFor={`${reasonId}-status`}>Classification</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as ReviewClassificationStatus)}
              >
                <SelectTrigger id={`${reasonId}-status`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reviewStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor={reasonId}>Reason</Label>
            <Textarea
              id={reasonId}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="What did you confirm in the source data?"
            />
          </div>

          {!restoring ? (
            <div className="grid gap-2">
              <Label htmlFor={`${reasonId}-confidence`}>Confidence</Label>
              <Select value={confidence} onValueChange={setConfidence}>
                <SelectTrigger id={`${reasonId}-confidence`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {confidenceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {keepingSuggestion
                ? "Suggestion dismissal confidence is recorded as 100%."
                : "Restore confidence is recorded as 100%."}
            </p>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending || reason.trim().length < 3}
            onClick={(event) => {
              event.preventDefault();
              submitReview();
            }}
          >
            {isPending ? <LoaderCircle className="animate-spin" /> : null}
            {isPending
              ? "Saving…"
              : keepingSuggestion
                ? "Keep shot"
                : restoring
                  ? "Restore shot"
                  : "Save review"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ShotBulkReviewButton({
  shotIds,
  onComplete,
}: {
  shotIds: string[];
  onComplete: () => void;
}) {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Batch exclusion after reviewing the selected source rows.");
  const [confidence, setConfidence] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function excludeSelected() {
    startTransition(async () => {
      setError(null);
      try {
        await reviewShotsAction({
          shotIds,
          status: "user_excluded",
          reason,
          confidence: Number(confidence),
        });
        setOpen(false);
        onComplete();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not review the selected shots.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !isPending && setOpen(nextOpen)}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Ban className="size-4" />
          Exclude selected
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exclude {shotIds.length} selected shots?</AlertDialogTitle>
          <AlertDialogDescription>
            This is reversible. Raw source fields remain intact and every shot receives its own
            append-only review event.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor={reasonId}>Shared reason</Label>
            <Textarea
              id={reasonId}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${reasonId}-confidence`}>Confidence</Label>
            <Select value={confidence} onValueChange={setConfidence}>
              <SelectTrigger id={`${reasonId}-confidence`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {confidenceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending || reason.trim().length < 3}
            onClick={(event) => {
              event.preventDefault();
              excludeSelected();
            }}
          >
            {isPending ? <LoaderCircle className="animate-spin" /> : null}
            {isPending ? "Saving…" : "Exclude selected"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
