"use client";

import Link from "next/link";
import { csvCell } from "@/lib/csv";
import { useRouter } from "next/navigation";
import { correctShotClubAction } from "@/app/(app)/shots/actions";
import { useState, useTransition, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { SelectedShotDetail, type ShotMasterDetailRow } from "./shots-master-detail-table";
import { ShotReviewButton, ShotBulkReviewButton } from "./shot-review-controls";
import { MobileGroupedList, MobileStatus } from "@/components/app/mobile-primitives";
import { Button } from "@/components/ui/button";
import { type MobileShotFiltersValue } from "./mobile-shot-filters";
import { hasShotMetric, visibleShotSelection } from "./mobile-shot-evidence";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

type Option = { value: string; label: string };
type Props = {
  shots: ShotMasterDetailRow[];
  clubs: Option[];
  correctionClubs: Option[];
  sessions: Option[];
  categories: Option[];
  filters: MobileShotFiltersValue;
  total: number;
  accountShotCount: number;
  page: number;
  pages: number;
  previousHref: string;
  nextHref: string;
};

export function MobileShotExplorer({
  shots,
  correctionClubs,
  filters,
  total,
  accountShotCount,
  page,
  pages,
  previousHref,
  nextHref,
}: Props) {
  const focusReturn = useRef<HTMLButtonElement | null>(null);
  const [tab, setTab] = useState<"overview" | "source" | "history">("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const visibleSelection = visibleShotSelection(selectedIds, shots);
  const selected = shots.find((shot) => shot.id === selectedId);
  return (
    <section className="grid min-w-0 gap-5" data-mobile-shot-explorer>
      <div className="flex items-center justify-between gap-3">
        <Link
          className="flex min-h-11 items-center text-sm font-semibold text-primary"
          href="/shots/review"
        >
          Review suggestions
        </Link>
        <Button
          variant="ghost"
          onClick={() => {
            setReviewing(!reviewing);
            setSelectedIds([]);
          }}
        >
          {reviewing ? "Done" : "Select shots"}
        </Button>
      </div>
      {reviewing && visibleSelection.length > 0 ? (
        <ShotBulkReviewButton
          companion
          shotIds={visibleSelection}
          onComplete={() => setSelectedIds([])}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Button
          variant="outline"
          disabled={!shots.length}
          onClick={() => {
            const rows = [
              [
                "Shot ID",
                "Club",
                "Session",
                "Shot number",
                "Date",
                "Carry (yd)",
                "Total (yd)",
                "Side (yd)",
                "Ball speed (mph)",
                "Club speed (mph)",
                "Launch (deg)",
                "Review state",
              ],
              ...shots.map((shot) => [
                shot.id,
                shot.clubLabel,
                shot.fileNameLabel,
                shot.shotNumberLabel,
                shot.shotAtLabel,
                shot.carryYd === null ? "" : String(shot.carryYd),
                shot.totalLabel,
                shot.sideLabel,
                shot.ballSpeedLabel,
                shot.clubSpeedLabel,
                shot.launchLabel,
                shot.reviewStatusLabel,
              ]),
            ];
            const url = URL.createObjectURL(
              new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], {
                type: "text/csv;charset=utf-8",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `shots-page-${page}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export {shots.length} shots on this page
        </Button>
        <span>Sort applies to all {total} matching shots.</span>
      </div>
      {shots.length ? (
        <MobileGroupedList label="Measured shots">
          {shots.map((shot) => (
            <div key={shot.id} className="flex items-center border-b border-border last:border-0">
              {reviewing ? (
                <label className="grid min-h-11 min-w-11 place-items-center">
                  <span className="sr-only">
                    Select {shot.clubTypeLabel} shot {shot.shotNumberLabel}
                  </span>
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={visibleSelection.includes(shot.id)}
                    onChange={(e) =>
                      setSelectedIds((ids) =>
                        e.target.checked ? [...ids, shot.id] : ids.filter((id) => id !== shot.id),
                      )
                    }
                  />
                </label>
              ) : null}
              <button
                type="button"
                className="mobile-shot-row"
                onClick={(event) => {
                  focusReturn.current = event.currentTarget;
                  setTab("overview");
                  setSelectedId(shot.id);
                }}
                aria-label={`${shot.clubTypeLabel}, ${shot.carryYd !== null ? `${Math.round(shot.carryYd)} yards carry` : "carry not recorded"}, ${shot.evidenceStatus === "trusted" ? "included" : "needs review"}, view shot`}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{shot.clubTypeLabel}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {shot.shotAtLabel} · {shot.shotCategoryLabel}
                  </span>
                  <MobileStatus
                    label={
                      shot.evidenceStatus === "trusted"
                        ? "Included"
                        : `${shot.reviewStatusLabel} · not trusted`
                    }
                    tone={shot.evidenceStatus === "trusted" ? "positive" : "attention"}
                  />
                  {filters.review && shot.reviewReason ? (
                    <span className="block text-sm">
                      {shot.reviewReason} · {shot.reviewConfidenceLabel}
                    </span>
                  ) : null}
                </span>
                <span className="text-right tabular-nums">
                  <span className="block text-xl font-semibold">
                    {shot.carryYd !== null ? Math.round(shot.carryYd) : "—"}
                  </span>
                  <span className="block text-xs text-muted-foreground">yd carry</span>
                  <span className="block text-xs text-muted-foreground">
                    {[
                      hasShotMetric(shot.sideLabel) ? `${shot.sideLabel} yd side` : null,
                      hasShotMetric(shot.ballSpeedLabel) ? `${shot.ballSpeedLabel} mph` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {hasShotMetric(shot.launchLabel) ? (
                    <span className="block text-xs text-muted-foreground">
                      {shot.launchLabel}° launch
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
          ))}
        </MobileGroupedList>
      ) : (
        <div role="status" className="py-6">
          <h2 className="font-semibold">
            {accountShotCount ? "No matching shots" : "Import your first measured shots"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Change the filters or import a measured session.
          </p>
          <Button asChild className="mt-3">
            <Link href={accountShotCount ? "/shots" : "/import"}>
              {accountShotCount ? "Clear filters" : "Import session"}
            </Link>
          </Button>
        </div>
      )}
      <nav aria-label="Shot pages" className="flex flex-wrap items-center justify-between gap-3">
        {page > 1 ? (
          <Button asChild variant="outline">
            <Link href={previousHref}>Previous</Link>
          </Button>
        ) : (
          <span />
        )}
        <span className="text-sm tabular-nums">
          {total ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, total)} of {total} · Page {page} /{" "}
          {pages}
        </span>
        {page < pages ? (
          <Button asChild variant="outline">
            <Link href={nextHref}>Next</Link>
          </Button>
        ) : (
          <span />
        )}
      </nav>
      <Drawer
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DrawerContent
          className="max-h-[92dvh]"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusReturn.current?.focus();
          }}
        >
          <DrawerHeader className="flex-none">
            <div className="flex items-center justify-between gap-3">
              <DrawerTitle>
                {selected?.clubTypeLabel} · Shot {selected?.shotNumberLabel}
              </DrawerTitle>
              <Button variant="ghost" onClick={() => setSelectedId(null)}>
                Done
              </Button>
            </div>
            <DrawerDescription>
              {selected?.shotAtLabel} · {selected?.fileNameLabel}
            </DrawerDescription>
          </DrawerHeader>
          {selected ? (
            <div className="grid min-h-0 gap-5 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <SelectedShotDetail
                key={selected.id}
                shot={selected}
                tab={tab}
                onTabChange={setTab}
                showActions={false}
              />
              <ClubCorrection key={selected.id} shotId={selected.id} clubs={correctionClubs} />
              <ShotReviewButton
                companion
                shotId={selected.id}
                reviewStatus={selected.reviewStatus}
              />
              {selected.reviewStatus === "suggested_exclusion" ? (
                <ShotBulkReviewButton
                  companion
                  shotIds={[selected.id]}
                  onComplete={() => setSelectedId(null)}
                />
              ) : null}
              <Button asChild variant="outline">
                <Link href={`/sessions/${selected.sessionId}`}>View session</Link>
              </Button>
              <Button variant="ghost" onClick={() => setSelectedId(null)}>
                Done
              </Button>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </section>
  );
}

export function ClubCorrection({
  shotId,
  clubs,
  onComplete,
}: {
  shotId: string;
  clubs: Option[];
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [clubId, setClubId] = useState("");
  const [undoId, setUndoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function correct(value: string) {
    startTransition(async () => {
      try {
        const result = await correctShotClubAction(shotId, value);
        // A refresh retry can be a no-op. Keep the original club available for Undo.
        setUndoId((previous) =>
          result.previousClubId === value ? previous : result.previousClubId,
        );
        setMessage(
          result.warning
            ? `Club updated. ${result.warning}`
            : "Club updated. Both clubs’ trusted distances have been recalculated.",
        );
        onComplete?.();
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not update the club. Try again.",
        );
      }
    });
  }
  return (
    <details className="mobile-shot-filters block">
      <summary className="flex min-h-11 items-center font-medium text-primary">
        Correct club
      </summary>
      <div className="grid gap-3 py-2">
        <p className="text-sm text-muted-foreground">
          Moves this shot’s evidence to the selected club. Raw measurements stay intact. You can
          change it back.
        </p>
        <label>
          Club
          <span className="mobile-shot-select-wrap">
            <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
              <option value="">Choose from your bag</option>
              {clubs.map((club) => (
                <option key={club.value} value={club.value}>
                  {club.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden />
          </span>
        </label>
        <Button disabled={pending || !clubId} onClick={() => correct(clubId)}>
          {pending ? "Updating…" : "Update club"}
        </Button>
        {undoId ? (
          <Button disabled={pending} variant="outline" onClick={() => correct(undoId)}>
            Undo club change
          </Button>
        ) : null}
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
      </div>
    </details>
  );
}
