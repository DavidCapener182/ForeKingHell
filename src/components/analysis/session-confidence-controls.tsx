"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSessionConfidence } from "@/app/sessions/confidence-actions";
import {
  ALIGNMENT_STATUSES,
  alignmentLabels,
  type AlignmentStatus,
  type DirectionReview,
} from "@/lib/session-data-confidence";
import { Button } from "@/components/ui/button";

export function SessionConfidenceControls({
  sessionId,
  alignment,
  label,
}: {
  sessionId: string;
  alignment: AlignmentStatus;
  label: string;
}) {
  const [value, setValue] = useState(alignment);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <form
      className="grid gap-2 rounded-lg border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          try {
            const saved = await saveSessionConfidence({ sessionId, alignment: value });
            setValue(saved.alignment ?? "unknown");
            setMessage(
              "refreshWarning" in saved
                ? saved.refreshWarning
                : "Alignment saved. Analysis updated.",
            );
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not save alignment.");
          }
        });
      }}
    >
      <label className="text-sm font-medium" htmlFor={`alignment-${sessionId}`}>
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id={`alignment-${sessionId}`}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          value={value}
          onChange={(event) => setValue(event.target.value as AlignmentStatus)}
          disabled={pending}
        >
          {ALIGNMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {alignmentLabels[status]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save alignment"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Affects target-relative direction and delivery. Raw readings remain available.
      </p>
      <p role="status" className="text-xs">
        {message}
      </p>
    </form>
  );
}
export function DirectionReviewControls({
  sessionId,
  shotId,
  status,
}: {
  sessionId: string;
  shotId: string;
  status: DirectionReview;
}) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const save = (directionReview: DirectionReview) =>
    startTransition(async () => {
      try {
        const saved = await saveSessionConfidence({ sessionId, shotId, directionReview });
        setMessage(
          "refreshWarning" in saved
            ? saved.refreshWarning
            : "Direction review saved. Analysis updated.",
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save review.");
      }
    });
  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || status === "questionable"}
          onClick={() => save("questionable")}
        >
          Question direction only
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || status === "confirmed"}
          onClick={() => save("confirmed")}
        >
          Confirm reported direction
        </Button>
        {status !== "unreviewed" && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => save("unreviewed")}>
            Reset review
          </Button>
        )}
      </div>
      <p role="status" className="text-xs">
        {message}
      </p>
    </div>
  );
}
