"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AutomaticReviewRow } from "@/lib/automatic-shot-review-data";
import { keepAutomaticShotReviewAction } from "@/app/(app)/shots/actions";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileStatus } from "@/components/app/mobile-primitives";
import { Button } from "@/components/ui/button";
import { ShotReviewButton, ShotBulkReviewButton } from "./shot-review-controls";
import { visibleShotSelection } from "./mobile-shot-evidence";
import { ClubCorrection } from "./mobile-shot-explorer";

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
  const [selected, setSelected] = useState<string[]>([]);
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const visibleSelection = visibleShotSelection(selected, rows);
  async function keep(ids: string[], undo = false) {
    startTransition(async () => {
      try {
        await keepAutomaticShotReviewAction(ids, undo);
        setUndoIds(undo ? [] : ids);
        setSelected([]);
        setMessage(
          undo ? "Review reopened." : "Kept in your analysis. You can undo this decision.",
        );
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error && !/load failed|failed to fetch|networkerror/i.test(error.message)
            ? error.message
            : "Could not save the review. Your selection is kept. Check your connection and try again.",
        );
      }
    });
  }
  return (
    <div className="grid gap-5" data-mobile-automatic-review>
      <MobileLargeTitle
        title="Review shots"
        detail="Check the evidence. Keep what represents your game."
      />
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
          <Button disabled={pending} onClick={() => void keep(visibleSelection)}>
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
            <article key={row.id} className="border-b border-border p-4 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {row.clubLabel} · Shot {row.shotNumber ?? "—"}
                  </p>
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
              <MobileStatus
                label={`${row.suggestion.classification} · ${row.suggestion.confidence} confidence`}
                tone="attention"
              />
              <p className="my-3 line-clamp-2 text-sm leading-6">{row.suggestion.reason}</p>
              <details className="mb-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm text-primary">
                  Full evidence
                </summary>
                <p className="text-sm leading-6">{row.suggestion.reason}</p>
              </details>
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
                <Button variant="outline" disabled={pending} onClick={() => void keep([row.id])}>
                  Keep
                </Button>
                <ShotReviewButton
                  companion
                  shotId={row.id}
                  reviewStatus={row.reviewStatus}
                  intent="exclude"
                />
              </div>
              <details className="mt-2">
                <summary className="flex min-h-11 cursor-pointer items-center text-primary">
                  Change club or see details
                </summary>
                <div className="grid gap-3">
                  <ClubCorrection shotId={row.id} clubs={clubs} />
                  <Button asChild variant="ghost">
                    <Link href={`/shots?sessionId=${row.sessionId}&club=${row.clubType}`}>
                      View measured shots
                    </Link>
                  </Button>
                </div>
              </details>
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
