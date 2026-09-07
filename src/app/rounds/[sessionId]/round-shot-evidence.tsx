"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Crosshair, MoveUpRight } from "lucide-react";
import { ClubCorrection } from "@/app/shots/mobile-shot-explorer";
import { Button } from "@/components/ui/button";

type RoundShot = {
  id: string;
  clubId: string;
  clubLabel: string;
  shotNumber: number | null;
  holeNumber: number | null;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  reviewStatus: string;
};

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const distance = (value: number | null) =>
  value !== null && Number.isFinite(value) ? number.format(value) : "—";

export function RoundShotEvidence({
  sessionId,
  shots,
  clubs,
}: {
  sessionId: string;
  shots: RoundShot[];
  clubs: { value: string; label: string }[];
}) {
  const [clubId, setClubId] = useState("");
  const selectId = useId();
  const currentClubs = clubs.filter((club) => shots.some((shot) => shot.clubId === club.value));
  const visible = shots.filter((shot) => !clubId || shot.clubId === clubId);
  const longest = (metric: "carryYd" | "totalYd") =>
    visible.reduce<RoundShot | null>((best, shot) => {
      const value = shot[metric];
      return value !== null &&
        Number.isFinite(value) &&
        value > 0 &&
        (best === null || value > (best[metric] ?? 0))
        ? shot
        : best;
    }, null);
  const carry = longest("carryYd");
  const total = longest("totalYd");
  return (
    <section aria-label="Shots in this round" className="grid min-w-0 gap-4">
      <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/75">
          This round · {shots.length} shots
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Know what each club did.</h2>
        <p className="mt-2 text-sm leading-6 text-primary-foreground/80">
          Choose a club to find its longest shots and check the original readings.
        </p>
      </div>
      <div className="grid gap-2">
        <label htmlFor={selectId} className="text-sm font-semibold">
          Show club
        </label>
        <select
          id={selectId}
          value={clubId}
          onChange={(event) => setClubId(event.target.value)}
          className="min-h-11 w-full rounded-lg border bg-card px-3 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <option value="">All clubs · {shots.length} shots</option>
          {currentClubs.map((club) => (
            <option key={club.value} value={club.value}>
              {club.label} · {shots.filter((shot) => shot.clubId === club.value).length} shots
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3" aria-live="polite">
        {(
          [
            ["Longest carry", carry, "carryYd"],
            ["Longest total", total, "totalYd"],
          ] as const
        ).map(([label, shot, metric]) => (
          <a
            key={label}
            href={shot ? `#round-shot-${shot.id}` : undefined}
            className="min-w-0 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
          >
            <span className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
              {label}
              <ArrowUpRight className="size-4 shrink-0" aria-hidden />
            </span>
            <span className="mt-3 block text-3xl font-semibold tracking-tight tabular-nums">
              {distance(shot?.[metric] ?? null)}{" "}
              <span className="text-sm font-normal text-muted-foreground">yd</span>
            </span>
            <span className="mt-2 block text-xs text-muted-foreground">
              {shot
                ? `Shot ${shot.shotNumber ?? "—"} · Hole ${shot.holeNumber ?? "—"}`
                : "No recorded distance"}
            </span>
          </a>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Longest recorded values in this round, including flagged shots. They are not your trusted
        stock distances.
      </p>
      <div className="grid gap-3">
        {visible.map((shot) => (
          <article
            id={`round-shot-${shot.id}`}
            key={shot.id}
            className="scroll-mt-28 rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-semibold">{shot.clubLabel}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Shot {shot.shotNumber ?? "—"} ·{" "}
                  {shot.holeNumber ? `Hole ${shot.holeNumber}` : "Hole unassigned"}
                </p>
              </div>
              <span className="rounded-lg bg-muted p-2 text-primary">
                <Crosshair className="size-4" aria-hidden />
              </span>
            </div>
            <dl className="my-4 grid grid-cols-3 gap-2 border-y py-3">
              {(
                [
                  ["Carry", shot.carryYd],
                  ["Total", shot.totalYd],
                  ["Reported side", shot.sideCarryYd],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {distance(value)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">yd</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mb-2 text-xs text-muted-foreground">
              Review: {shot.reviewStatus.replaceAll("_", " ")}
            </p>
            <ClubCorrection shotId={shot.id} clubs={clubs} />
          </article>
        ))}
        {!visible.length ? (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            No shots match this club. Choose another club above.
          </p>
        ) : null}
      </div>
      <Button asChild variant="outline" className="min-h-11">
        <Link href={`/shots?sessionId=${sessionId}`}>
          Open full shot evidence
          <MoveUpRight className="size-4" aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
