"use client";
import { useCallback, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { submitCourseRecordAttemptAction } from "@/app/course-records/actions";
import { ScorecardProofUploader } from "@/components/scorecard-proof-uploader";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/hooks/use-client-ready";
export type RecordRoundOption = {
  id: string;
  metricLabel: string;
  dateLabel: string;
  holeCount: number;
  teeSetName: string | null;
  proofLabel: string;
};
export function RecordAttemptForm({
  recordId,
  rounds,
  selectedSessionId,
}: {
  recordId: string;
  rounds: RecordRoundOption[];
  selectedSessionId: string;
}) {
  const ready = useClientReady();
  const [sessionId, setSessionId] = useState(selectedSessionId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const selected = rounds.find((round) => round.id === sessionId)!;
  const handleUploadPending = useCallback((value: boolean) => {
    setUploadPending(value);
    if (value) setReviewed(false);
  }, []);
  return (
    <form
      ref={form}
      data-course-record-attempt-form
      className="mt-4 grid gap-3"
      onChange={() => setReviewed(false)}
      onSubmit={(event) => {
        event.preventDefault();
        if (busy.current || uploadPending) return;
        if (!reviewed) {
          setError("Review the selected round and proof before submitting.");
          return;
        }
        const data = new FormData(event.currentTarget);
        const signature = JSON.stringify(Array.from(data.entries()));
        if (request.current?.signature !== signature)
          request.current = { signature, id: crypto.randomUUID() };
        data.set("requestId", request.current.id);
        busy.current = true;
        setError(null);
        startTransition(async () => {
          try {
            await submitCourseRecordAttemptAction(data);
          } catch (error) {
            unstable_rethrow(error);
            setError(
              error instanceof Error
                ? error.message
                : "Attempt could not be saved. Your round and proof remain here.",
            );
          } finally {
            busy.current = false;
          }
        });
      }}
    >
      <input type="hidden" name="recordId" value={recordId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <fieldset disabled={pending || !ready} className="grid min-w-0 gap-3">
        <legend className="sr-only">Selected round and proof</legend>
        <div className="grid gap-2 rounded-xl border bg-muted/30 p-3" aria-live="polite">
          <p className="font-semibold">Locked from selected round</p>
          <p className="text-2xl font-semibold" data-record-derived-score>
            {selected.metricLabel}
          </p>
          <p className="break-words text-sm">
            {selected.dateLabel} · {selected.holeCount} holes ·{" "}
            {selected.teeSetName ?? "Tee not recorded"}
          </p>
          <p className="text-sm">{selected.proofLabel}</p>
        </div>
        <ResponsiveDetailPanel
          open={open}
          onOpenChange={setOpen}
          title="Choose saved round"
          description="Choose the exact saved round. Its result is calculated by the selected record category."
          trigger={
            <Button type="button" variant="outline" className="min-h-11">
              Change saved round
            </Button>
          }
          footer={
            <Button type="button" className="min-h-11" onClick={() => setOpen(false)}>
              Use selected round
            </Button>
          }
        >
          <label className="grid gap-2 text-sm font-medium">
            Search saved rounds
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11"
            />
          </label>
          <label className="mt-3 grid gap-2 text-sm font-medium">
            Saved round
            <select
              aria-label="Saved round"
              value={sessionId}
              className="min-h-11 w-full rounded-md border bg-background px-2"
              onChange={(event) => {
                setSessionId(event.target.value);
                setReviewed(false);
                setError(null);
              }}
            >
              {rounds
                .filter(
                  (round) =>
                    round.id === sessionId ||
                    `${round.dateLabel} ${round.metricLabel} ${round.teeSetName ?? ""}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((round) => (
                  <option key={round.id} value={round.id}>
                    {round.metricLabel} · {round.dateLabel} ·{" "}
                    {round.teeSetName ?? "Tee not recorded"}
                  </option>
                ))}
            </select>
          </label>
          <p className="mt-3 break-words text-sm">
            {selected.metricLabel} · {selected.proofLabel}
          </p>
        </ResponsiveDetailPanel>
        <ScorecardProofUploader
          key={sessionId}
          proofScopeType="course_record"
          proofScopeId={recordId}
          screenshotFieldName="screenshotPath"
          extractedTotalFieldName="extractedScorecardTotal"
          onPendingChange={handleUploadPending}
          onProofChange={() => setReviewed(false)}
        />
        {reviewed ? (
          <div className="rounded-xl border bg-muted/30 p-3 text-sm" role="status">
            <p className="font-semibold">Review before submission</p>
            <p>
              {selected.metricLabel} · {selected.dateLabel} ·{" "}
              {selected.teeSetName ?? "Tee not recorded"}
            </p>
            <p>
              The saved round determines the result. Submitted proof may be pending or require
              review; submission does not make it a verified record.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {reviewed ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setReviewed(false)}
              >
                Back to proof
              </Button>
              <Button type="submit" disabled={uploadPending || pending} className="min-h-11">
                {pending ? "Submitting…" : "Submit reviewed attempt"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={uploadPending}
              className="min-h-11"
              onClick={() => {
                if (form.current?.reportValidity()) {
                  setError(null);
                  setReviewed(true);
                }
              }}
            >
              Review attempt
            </Button>
          )}
        </div>
      </fieldset>
      {pending ? <p role="status">Saving this attempt…</p> : null}
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
