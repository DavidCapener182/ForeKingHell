"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { correctShotClubAction } from "@/app/(app)/shots/actions";
import { useState, useTransition } from "react";
import type { ShotMasterDetailRow } from "./shots-master-detail-table";
import { ShotReviewButton, ShotBulkReviewButton } from "./shot-review-controls";
import { MobileLargeTitle, MobileMetric, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileStatus } from "@/components/app/mobile-primitives";
import { Button } from "@/components/ui/button";
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
  filters: {
    q: string;
    club: string;
    sessionId: string;
    category: string;
    trust: string;
    sort: string;
    dir: string;
    review?: string;
  };
  total: number;
  page: number;
  pages: number;
  previousHref: string;
  nextHref: string;
};

export function MobileShotExplorer({
  shots,
  clubs,
  correctionClubs,
  sessions,
  categories,
  filters,
  total,
  page,
  pages,
  previousHref,
  nextHref,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const selected = shots.find((shot) => shot.id === selectedId);
  return (
    <section className="grid min-w-0 gap-5 lg:hidden" data-mobile-shot-explorer>
      <MobileLargeTitle
        title={filters.review ? "Review shots" : "Shots"}
        detail={`${total.toLocaleString("en-GB")} matching shots`}
      />
      <form action="/shots" className="mobile-shot-filters" key={JSON.stringify(filters)}>
        <label>
          Search sessions
          <input name="q" type="search" defaultValue={filters.q} placeholder="Session or course" />
        </label>
        <Filter name="club" label="Club" value={filters.club} options={clubs} />
        <Filter
          name="trust"
          label="Evidence"
          value={filters.trust}
          options={[
            { value: "trusted", label: "Trusted" },
            { value: "untrusted", label: "Untrusted" },
          ]}
        />
        <details className="col-span-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-primary">
            More filters
          </summary>
          <div className="mobile-shot-filters">
            <Filter name="sessionId" label="Session" value={filters.sessionId} options={sessions} />
            <Filter
              name="category"
              label="Shot type"
              value={filters.category}
              options={categories}
            />
            <Filter
              name="sort"
              label="Sort by"
              value={filters.sort}
              options={[
                { value: "recent", label: "Date" },
                { value: "carry", label: "Carry" },
                { value: "side", label: "Side" },
                { value: "ballSpeed", label: "Ball speed" },
                { value: "clubSpeed", label: "Club speed" },
              ]}
            />
            <Filter
              name="dir"
              label="Order"
              value={filters.dir}
              options={[
                { value: "desc", label: "Highest / newest" },
                { value: "asc", label: "Lowest / oldest" },
              ]}
            />
            <Filter
              name="review"
              label="Review state"
              value={filters.review ?? ""}
              options={[
                { value: "suggested_exclusion", label: "Suggested exclusions" },
                { value: "user_excluded", label: "User excluded" },
                { value: "warm_up", label: "Warm-up" },
                { value: "calibration", label: "Calibration" },
                { value: "launch_monitor_error", label: "Sensor anomaly" },
                { value: "restored", label: "Restored" },
              ]}
            />
          </div>
        </details>
        <Button type="submit" className="min-h-11">
          Apply filters
        </Button>
        <Button asChild variant="ghost" className="min-h-11">
          <Link href="/shots">Reset</Link>
        </Button>
      </form>
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
      {reviewing && selectedIds.length > 0 ? (
        <ShotBulkReviewButton shotIds={selectedIds} onComplete={() => setSelectedIds([])} />
      ) : null}
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
                    checked={selectedIds.includes(shot.id)}
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
                onClick={() => setSelectedId(shot.id)}
                aria-label={`${shot.clubTypeLabel}, ${shot.carryLabel} carry, ${shot.evidenceStatus}, view shot`}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{shot.clubTypeLabel}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {shot.shotAtLabel} · {shot.shotCategoryLabel}
                  </span>
                  <MobileStatus
                    label={shot.reviewStatusLabel}
                    tone={shot.evidenceStatus === "trusted" ? "positive" : "attention"}
                  />
                  {filters.review && shot.reviewReason ? (
                    <span className="block text-sm">
                      {shot.reviewReason} · {shot.reviewConfidenceLabel}
                    </span>
                  ) : null}
                </span>
                <span className="text-right tabular-nums">
                  <span className="block text-xl font-semibold">{shot.carryLabel}</span>
                  <span className="block text-xs text-muted-foreground">carry</span>
                  <span className="block text-xs text-muted-foreground">
                    {shot.sideLabel} side · {shot.ballSpeedLabel}
                  </span>
                </span>
              </button>
            </div>
          ))}
        </MobileGroupedList>
      ) : (
        <div role="status" className="py-6">
          <h2 className="font-semibold">No matching shots</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Change the filters or import a measured session.
          </p>
          <Button asChild className="mt-3">
            <Link href="/import">Import session</Link>
          </Button>
        </div>
      )}
      <nav aria-label="Shot pages" className="flex items-center justify-between">
        {page > 1 ? (
          <Button asChild variant="outline">
            <Link href={previousHref}>Previous</Link>
          </Button>
        ) : (
          <span />
        )}
        <span className="text-sm tabular-nums">
          {page} / {pages}
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
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>
              {selected?.clubTypeLabel} · Shot {selected?.shotNumberLabel}
            </DrawerTitle>
            <DrawerDescription>
              {selected?.shotAtLabel} · {selected?.fileNameLabel}
            </DrawerDescription>
          </DrawerHeader>
          {selected ? (
            <div className="grid gap-5 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <MobileMetric value={selected.carryLabel} label="carry" />
              <dl className="grid grid-cols-2 gap-4">
                {shotMetrics(selected).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <MobileSection title="Evidence">
                <MobileStatus
                  label={selected.reviewStatusLabel}
                  tone={selected.evidenceStatus === "trusted" ? "positive" : "attention"}
                />
                <p className="text-sm">
                  {selected.reviewReason ?? selected.evidenceReasons.join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground">{selected.reviewConfidenceLabel}</p>
              </MobileSection>
              <ClubCorrection key={selected.id} shotId={selected.id} clubs={correctionClubs} />
              <ShotReviewButton shotId={selected.id} reviewStatus={selected.reviewStatus} />
              {selected.reviewStatus === "suggested_exclusion" ? (
                <ShotBulkReviewButton
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

function Filter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Option[];
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function shotMetrics(shot: ShotMasterDetailRow) {
  return Object.entries({
    Total: shot.totalLabel,
    Side: shot.sideLabel,
    "Ball speed": shot.ballSpeedLabel,
    "Club speed": shot.clubSpeedLabel,
    Launch: shot.launchLabel,
    Path: shot.pathLabel,
    Face: shot.faceLabel,
    Attack: shot.attackLabel,
    Apex: shot.apexLabel,
    Smash: shot.smashLabel,
    Spin: shot.spinRateLabel,
  }).filter(([, value]) => value && !/^(—|–|-|n\/a)$/i.test(value.trim()));
}

export function ClubCorrection({ shotId, clubs }: { shotId: string; clubs: Option[] }) {
  const router = useRouter();
  const [clubId, setClubId] = useState("");
  const [undoId, setUndoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function correct(value: string) {
    startTransition(async () => {
      try {
        const result = await correctShotClubAction(shotId, value);
        setUndoId(result.previousClubId);
        setMessage("Club updated. Both clubs’ trusted distances have been recalculated.");
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
          <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
            <option value="">Choose from your bag</option>
            {clubs.map((club) => (
              <option key={club.value} value={club.value}>
                {club.label}
              </option>
            ))}
          </select>
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
