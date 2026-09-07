"use client";
import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { submitTournamentRoundFormAction } from "@/app/tournaments/actions";
import { ScorecardProofUploader } from "@/components/scorecard-proof-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/hooks/use-client-ready";
export function TournamentSubmissionForm({
  tournamentId,
  roundNumber,
  roundCount,
  children,
  disabled = false,
  manual = false,
}: {
  tournamentId: string;
  roundNumber: number;
  roundCount?: number;
  children?: ReactNode;
  disabled?: boolean;
  manual?: boolean;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [round, setRound] = useState(roundNumber);
  const [review, setReview] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const proofChanged = useCallback(() => setReview(null), []);
  const proofPending = useCallback((value: boolean) => {
    setUploading(value);
    if (value) setReview(null);
  }, []);
  return (
    <form
      ref={form}
      className="grid gap-3"
      data-tournament-submit-form
      onChange={() => {
        setReview(null);
        setReceipt(null);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (busy.current || uploading || disabled || receipt) return;
        const data = new FormData(event.currentTarget);
        if (!review) {
          setReview([
            `Round ${data.get("roundNumber")}`,
            `Gross ${data.get("grossScore") || "–"} · Net ${data.get("netScore") || "–"}`,
            data.get("sessionId")
              ? "Linked saved round will be checked against your account and this event."
              : "Manual score; acceptance requires the event's evidence checks.",
          ]);
          return;
        }
        const signature = JSON.stringify([...data.entries()]);
        if (request.current?.signature !== signature)
          request.current = { signature, id: crypto.randomUUID() };
        data.set("requestId", request.current.id);
        busy.current = true;
        setError(null);
        start(async () => {
          try {
            const result = await submitTournamentRoundFormAction({ ok: false }, data);
            if (!result.ok) {
              setError(result.error ?? "Submission could not be saved. Your draft is retained.");
              return;
            }
            setReceipt(result.submissionId ?? "saved");
            router.refresh();
          } catch {
            setError(
              "Submission could not be confirmed. Your draft is retained; retry with the same details.",
            );
          } finally {
            busy.current = false;
          }
        });
      }}
    >
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <fieldset
        disabled={!ready || pending || disabled || !!receipt}
        className="grid min-w-0 gap-3"
      >
        {manual ? (
          <>
            <label className="grid gap-1 text-sm font-medium">
              Round
              <Input
                type="number"
                name="roundNumber"
                min={1}
                max={roundCount}
                required
                value={round}
                onChange={(event) => setRound(Number(event.target.value))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-sm">
                Gross
                <Input name="grossScore" type="number" min={1} required />
              </label>
              <label className="grid gap-1 text-sm">
                Net
                <Input name="netScore" type="number" />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              Linked imported round
              <Input name="sessionId" placeholder="Optional round reference" />
            </label>
            <ScorecardProofUploader
              key={round}
              proofScopeType="tournament"
              proofScopeId={tournamentId}
              proofRoundNumber={round}
              screenshotFieldName="scorecardScreenshotPath"
              extractedTotalFieldName="extractedScorecardTotal"
              screenshotLabel="Scorecard image"
              extractedTotalLabel="Extracted total"
              onPendingChange={proofPending}
              onProofChange={proofChanged}
            />
          </>
        ) : (
          <input type="hidden" name="roundNumber" value={roundNumber} />
        )}
        {children}
        {review ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <h3 className="font-semibold">Review submission</h3>
            {review.map((line) => (
              <p key={line} className="mt-1 text-sm">
                {line}
              </p>
            ))}
            <p className="mt-2 text-sm text-muted-foreground">
              Saving a submission does not mark it verified. The server checks the linked evidence
              and scoring rules.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => setReview(null)}
            >
              Edit submission
            </Button>
          </div>
        ) : null}
        <Button type="submit" disabled={uploading}>
          {pending
            ? "Saving…"
            : receipt
              ? "Submission saved"
              : disabled
                ? "Already submitted or unavailable"
                : review
                  ? "Confirm submission"
                  : `Review round ${round}`}
        </Button>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {receipt ? (
        <p role="status" className="text-sm">
          Submission saved. Its current verification status is shown in your submission history.
        </p>
      ) : null}
    </form>
  );
}
