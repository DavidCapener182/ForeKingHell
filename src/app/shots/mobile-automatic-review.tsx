"use client";
import Link from "next/link";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AutomaticReviewRow } from "@/lib/automatic-shot-review-data";
import { keepAutomaticShotReviewAction } from "@/app/(app)/shots/actions";
import { MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileStatus } from "@/components/app/mobile-primitives";
import { Button } from "@/components/ui/button";
import { ShotReviewButton, ShotBulkReviewButton } from "./shot-review-controls";
import { visibleShotSelection } from "./mobile-shot-evidence";
import { ShotEvidenceSheet } from "./shot-evidence-sheet";
import { PageHeader } from "@/components/premium";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

export function MobileAutomaticReview({
  rows,
  clubs,
  page,
  scanned,
  hasNext,
}: {
  rows: AutomaticReviewRow[];
  clubs: Array<{ value: string; label: string }>;
  page: number;
  scanned: number;
  hasNext: boolean;
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [confirmIds, setConfirmIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const visibleSelection = visibleShotSelection(selected, rows);
  async function keep(ids: string[], undo = false) {
    if (submitting.current) return;
    submitting.current = true;
    startTransition(async () => {
      setError("");
      try {
        await keepAutomaticShotReviewAction(ids, undo);
        setConfirmIds([]);
        setUndoIds(undo ? [] : ids);
        setSelected([]);
        setMessage(
          undo ? "Review reopened." : "Kept in your analysis. You can undo this decision.",
        );
        router.refresh();
      } catch (error) {
        setError(
          error instanceof Error && !/load failed|failed to fetch|networkerror/i.test(error.message)
            ? error.message
            : "Could not save the review. Your selection is kept. Check your connection and try again.",
        );
      } finally {
        submitting.current = false;
      }
    });
  }
  return (
    <div className="grid gap-5" data-mobile-automatic-review>
      <PageHeader
        title="Review shots"
        description="Check the evidence. Keep what represents your game."
        actions={
          <Button asChild variant="outline">
            <Link href="/shots">All shots</Link>
          </Button>
        }
        metrics={[
          { label: "Suggestions in this batch", value: rows.length },
          { label: "Shots scanned", value: scanned },
          { label: "Batch", value: page },
        ]}
      />
      <AlertDialog
        open={confirmIds.length > 0}
        onOpenChange={(value) => {
          if (!value && !pending) setConfirmIds([]);
        }}
      >
        <AlertDialogContent className="max-h-[88dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Keep{" "}
              {confirmIds.length === 1
                ? rows.find((r) => r.id === confirmIds[0])?.clubLabel + " shot"
                : `${confirmIds.length} selected shots`}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dismisses the selected suggestions. Other evidence checks still apply to club
              summaries and analysis. Raw measurements and review history remain available; you can
              undo this decision.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert">{error}</p>}
          <AlertDialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setConfirmIds([])}>
              Cancel
            </Button>
            <Button disabled={pending} onClick={() => void keep(confirmIds)}>
              {pending ? "Saving…" : "Confirm keep"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!confirmIds.length && error ? <p role="alert">{error}</p> : null}
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center text-primary">
          How suggestions work
        </summary>
        <p className="text-sm text-muted-foreground">
          Suggestions never change or delete shots automatically. Wrong-club checks require both
          carry and ball speed to fit one other club, with at least 20 trusted shots from two other
          sessions. Short carries can be intentional; they never trigger a wrong-club suggestion.
          Confidence describes the evidence, not a probability of an error.
        </p>
      </details>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {pending ? (
        <p role="status" className="text-sm">
          Saving your review…
        </p>
      ) : null}
      {undoIds.length ? (
        <Button variant="outline" disabled={pending} onClick={() => void keep(undoIds, true)}>
          Undo keep ({undoIds.length})
        </Button>
      ) : null}
      {visibleSelection.length ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={pending}
            onClick={() => {
              setError("");
              setConfirmIds(visibleSelection);
            }}
          >
            Keep {visibleSelection.length}
          </Button>
          <ShotBulkReviewButton
            companion
            shotIds={visibleSelection}
            onComplete={() => {
              setSelected([]);
              router.refresh();
            }}
          />
        </div>
      ) : null}
      <MobileSection
        title={rows.length ? `${rows.length} suggestions` : "No suggestions in this batch"}
      >
        <MobileGroupedList>
          {rows.map((row) => (
            <article
              key={row.id}
              className="grid min-w-0 gap-3 border-b border-border p-4 last:border-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">
                    {row.clubLabel} · Shot {row.shotNumber ?? "—"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.shotAt).toLocaleDateString("en-GB")} ·{" "}
                    {row.sessionSource.replaceAll("_", " ")}
                  </p>
                </div>
                <label className="grid size-11 shrink-0 place-items-center">
                  <span className="sr-only">
                    Select {row.clubLabel} shot {row.shotNumber ?? row.id}
                  </span>
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={visibleSelection.includes(row.id)}
                    disabled={
                      pending ||
                      (!visibleSelection.includes(row.id) && visibleSelection.length >= 50)
                    }
                    onChange={(event) =>
                      setSelected((ids) =>
                        event.target.checked ? [...ids, row.id] : ids.filter((id) => id !== row.id),
                      )
                    }
                  />
                </label>
              </div>
              <p className="break-words text-sm text-muted-foreground">
                {row.fileName ?? "Source file name not recorded"}
              </p>
              <MobileStatus
                label={`${row.suggestion.classification} · ${row.suggestion.confidence} confidence`}
                tone="attention"
              />
              <p className="text-sm leading-6">{row.suggestion.reason}</p>
              <dl className="grid grid-cols-3 gap-3 tabular-nums">
                {(
                  [
                    ["Carry", row.carryYd, "yd"],
                    ["Ball speed", row.ballSpeedMph, "mph"],
                    ["Smash", row.smashFactor, ""],
                  ] as const
                )
                  .filter(([, value]) => value !== null)
                  .map(([label, value, unit]) => (
                    <div key={label}>
                      <dd className="text-xl font-semibold">
                        {value?.toFixed(label === "Smash" ? 2 : 0)}{" "}
                        <span className="text-xs font-normal">{unit}</span>
                      </dd>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                    </div>
                  ))}
              </dl>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setError("");
                    setConfirmIds([row.id]);
                  }}
                >
                  Keep
                </Button>
                <ShotReviewButton
                  companion
                  shotId={row.id}
                  reviewStatus={row.reviewStatus}
                  intent="exclude"
                  onComplete={() => router.refresh()}
                />
              </div>
              <ShotEvidenceSheet
                shotId={row.id}
                title={`${row.clubLabel} · Shot ${row.shotNumber ?? "—"}`}
                clubs={clubs}
                onComplete={() => router.refresh()}
              />
              <Link
                className="flex min-h-11 items-center text-sm text-primary underline"
                href={`/shots?shotId=${row.id}&sessionId=${row.sessionId}`}
              >
                Open exact shot in explorer
              </Link>
            </article>
          ))}
        </MobileGroupedList>
        {!rows.length ? (
          <p className="text-sm text-muted-foreground">
            {scanned
              ? "These shots have no new suggestions under the current rules. This is not a guarantee that every measurement is correct."
              : "Import measured shots to build your review queue."}
          </p>
        ) : null}
      </MobileSection>
      <p className="text-xs text-muted-foreground">
        Scanned {scanned} shots in batch {page}. Profiles use up to 4,000 recent measured shots;
        sparse evidence produces no club suggestion. Previously reviewed decisions are respected.
      </p>
      {!scanned && page === 1 ? (
        <Button asChild>
          <Link href="/import">Import measured shots</Link>
        </Button>
      ) : null}
      <nav aria-label="Review batches" className="flex justify-between gap-3">
        {page > 1 ? (
          <Button asChild variant="outline">
            <Link href={`/shots/review?page=${page - 1}`}>Newer shots</Link>
          </Button>
        ) : (
          <span />
        )}
        {hasNext ? (
          <Button asChild variant="outline">
            <Link href={`/shots/review?page=${page + 1}`}>Older shots</Link>
          </Button>
        ) : null}
      </nav>
      <Button asChild variant="ghost">
        <Link href="/shots">All shots</Link>
      </Button>
    </div>
  );
}
