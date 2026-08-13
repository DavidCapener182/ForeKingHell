"use client";

import { useMemo, useState } from "react";
import { Replace, Settings2, ShieldAlert } from "lucide-react";

import { StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
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
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" className="w-fit">
            <Settings2 aria-hidden />
            Adjust bag change
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Bag simulator settings</SheetTitle>
            <SheetDescription>
              Test a removal and one candidate against your measured carry bands. Nothing is saved
              to the real bag.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4 pb-6">
            <div className="grid gap-2">
              <Label htmlFor="bag-simulator-remove">Remove club</Label>
              <Select
                value={removeId || "keep"}
                onValueChange={(value) => setRemoveId(value === "keep" ? "" : value)}
              >
                <SelectTrigger id="bag-simulator-remove" className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Keep every club</SelectItem>
                  {clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor="bag-simulator-include">Include candidate club</Label>
              <Switch
                id="bag-simulator-include"
                checked={includeCandidate}
                onCheckedChange={setIncludeCandidate}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bag-simulator-candidate">Candidate club</Label>
              <Input
                id="bag-simulator-candidate"
                value={candidateLabel}
                onChange={(event) => setCandidateLabel(event.target.value)}
                disabled={!includeCandidate}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bag-simulator-carry">Projected carry</Label>
                <Input
                  id="bag-simulator-carry"
                  type="number"
                  value={candidateCarry}
                  onChange={(event) => setCandidateCarry(Number(event.target.value))}
                  disabled={!includeCandidate}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bag-simulator-miss">Projected miss width</Label>
                <Input
                  id="bag-simulator-miss"
                  type="number"
                  value={candidateDispersion}
                  onChange={(event) => setCandidateDispersion(Number(event.target.value))}
                  disabled={!includeCandidate}
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
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
