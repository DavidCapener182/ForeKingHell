"use client";

import { useMemo, useState } from "react";
import { Plus, Replace, ShieldAlert } from "lucide-react";

import { StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { simulateBagChange, type BagSimulatorClub } from "@/lib/bag-simulator";

export function BagSimulator({ clubs }: { clubs: BagSimulatorClub[] }) {
  const [removeId, setRemoveId] = useState("");
  const [candidateLabel, setCandidateLabel] = useState("Hybrid");
  const [candidateCarry, setCandidateCarry] = useState(185);
  const [candidateDispersion, setCandidateDispersion] = useState(18);
  const [includeCandidate, setIncludeCandidate] = useState(true);
  const result = useMemo(
    () =>
      simulateBagChange({
        clubs,
        removeId: removeId || undefined,
        candidate: includeCandidate
          ? {
              label: candidateLabel,
              carryYd: candidateCarry,
              p25Yd: candidateCarry - 7,
              p75Yd: candidateCarry + 7,
              leftYd: candidateDispersion,
              rightYd: candidateDispersion,
            }
          : null,
      }),
    [clubs, removeId, candidateLabel, candidateCarry, candidateDispersion, includeCandidate],
  );
  return (
    <section
      className="grid gap-4 rounded-2xl border bg-card p-4"
      aria-labelledby="bag-simulator-title"
    >
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Replace className="size-4" aria-hidden />
          Bag simulator
        </p>
        <h2 id="bag-simulator-title" className="mt-1 text-2xl font-semibold">
          What happens if I change a club?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Remove an existing club, add a candidate, and see how your measured carry bands and miss
          widths change course-distance coverage.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-sm font-semibold">
          Remove club
          <select
            value={removeId}
            onChange={(event) => setRemoveId(event.target.value)}
            className="min-h-11 rounded-xl border bg-background px-3"
          >
            <option value="">Keep every club</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Candidate club
          <Input
            value={candidateLabel}
            onChange={(event) => setCandidateLabel(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Projected carry
          <Input
            type="number"
            value={candidateCarry}
            onChange={(event) => setCandidateCarry(Number(event.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Projected miss width
          <Input
            type="number"
            value={candidateDispersion}
            onChange={(event) => setCandidateDispersion(Number(event.target.value))}
          />
        </label>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => setIncludeCandidate((value) => !value)}
        aria-pressed={includeCandidate}
      >
        <Plus className="size-4" aria-hidden />
        {includeCandidate ? "Candidate included" : "Add candidate"}
      </Button>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Current coverage" value={`${result.currentCoverage}%`} />
        <Metric label="Projected coverage" value={`${result.projectedCoverage}%`} />
        <div className="rounded-xl bg-secondary/55 p-3">
          <p className="text-xs text-muted-foreground">Coverage change</p>
          <p className="mt-1 text-2xl font-semibold">
            {result.coverageChange > 0 ? "+" : ""}
            {result.coverageChange}%
          </p>
          <StatusPill
            tone={
              result.coverageChange > 0 ? "green" : result.coverageChange < 0 ? "amber" : "slate"
            }
          >
            {result.coverageChange > 0
              ? "Improves"
              : result.coverageChange < 0
                ? "Worse"
                : "Neutral"}
          </StatusPill>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <GapList title="Current uncovered windows" values={result.currentGaps} />
        <GapList title="Projected uncovered windows" values={result.projectedGaps} />
      </div>
      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {result.warning}
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/55 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
function GapList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {values.length
          ? values.slice(0, 12).join(" · ")
          : "No uncovered 10-yard windows in the model."}
      </p>
    </div>
  );
}
