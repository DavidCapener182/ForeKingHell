"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { UntitledSelect, UntitledTextField } from "@/components/untitled-ui/form-controls";
import {
  comparisonDirection,
  comparisonScope,
  type ComparisonClub,
} from "./progress-comparison-data";

const labels = { carry: "Median carry", total: "Median total", side: "Average lateral miss" };
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function ProgressComparison({ clubs }: { clubs: ComparisonClub[] }) {
  const query = useSearchParams();
  const router = useRouter();
  const scope = comparisonScope(clubs, new URLSearchParams(query.toString()));
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(scope.from);
  const [to, setTo] = useState(scope.to);
  const [formError, setFormError] = useState("");
  const [pointId, setPointId] = useState<string | null>(null);
  const options = clubs.filter((club) => club.name.toLowerCase().includes(search.toLowerCase()));
  const points = scope.measure
    ? scope.observations.filter((point) => point[scope.measure!] !== null)
    : [];
  const point = points.find((item) => item.sessionId === pointId) ?? points.at(-1);
  const previous = points.at(-2);
  const latest = points.at(-1);
  const measure = scope.measure;
  const count = Number(Boolean(scope.from)) + Number(Boolean(scope.to));
  const update = (values: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    Object.entries(values).forEach(([key, value]) =>
      value ? url.searchParams.set(key, value) : url.searchParams.delete(key),
    );
    router.push(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  };
  return (
    <section
      aria-label="Club comparison"
      className="grid min-w-0 gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5"
      data-progress-comparison
    >
      <h2 className="text-xl font-semibold">Measured club history</h2>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UntitledTextField
          label="Search clubs"
          name="clubSearch"
          type="search"
          value={search}
          onValueChange={setSearch}
        />
        <UntitledSelect
          label="Comparison club"
          name="compareClub"
          value={scope.club?.clubId ?? ""}
          options={options.map((club) => ({ value: club.clubId, label: club.name }))}
          onValueChange={(value) => update({ compareClub: value })}
        />
        <UntitledSelect
          label="Comparison measure"
          name="compareMeasure"
          value={measure ?? ""}
          options={[
            { value: "carry", label: "Carry" },
            { value: "total", label: "Total" },
            { value: "side", label: "Control · lateral miss" },
          ]}
          onValueChange={(value) => update({ compareMeasure: value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p role="status" className="text-sm">
          {options.length} accessible {options.length === 1 ? "club" : "clubs"} · {points.length}{" "}
          measured sessions in scope
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setFrom(scope.from);
            setTo(scope.to);
            setFormError("");
            setOpen(true);
          }}
        >
          Period filters ({count})
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            update({ compareClub: null, compareMeasure: null, compareFrom: null, compareTo: null });
          }}
        >
          Clear all
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" data-comparison-scope>
        {scope.club?.name ?? "Select an accessible club"} ·{" "}
        {measure ? labels[measure] : "Select a valid measure"} ·{" "}
        {scope.from || "Earliest recorded session"} to {scope.to || "Latest recorded session"} (UTC)
      </p>
      {scope.unavailableClub ? (
        <p role="alert">
          The requested club is unavailable to this account. Choose an accessible club above.
        </p>
      ) : null}
      {!measure ? (
        <p role="alert">The requested measure is unavailable. Choose Carry, Total or Control.</p>
      ) : null}
      {!scope.datesValid ? (
        <p role="alert">
          The period is invalid. Open Period filters and choose valid dates in order.
        </p>
      ) : null}
      {options.length === 0 && clubs.length > 0 ? (
        <p>No clubs match your search. Clear the search to choose another club.</p>
      ) : null}
      {scope.club && measure && scope.datesValid ? (
        points.length ? (
          <>
            <div aria-live="polite" className="grid gap-2">
              <p className="text-lg font-semibold">
                {latest && previous && latest.counts[measure] >= 3 && previous.counts[measure] >= 3
                  ? comparisonDirection(previous[measure]!, latest[measure]!, measure)
                  : "Building a comparable baseline"}
              </p>
              <p className="text-sm text-muted-foreground">
                {latest && previous
                  ? `Latest two measured sessions: ${date(previous.date)} (${previous.counts[measure]} shots) and ${date(latest.date)} (${latest.counts[measure]} shots).`
                  : "Two sessions with at least three measured shots each are needed for a comparison."}
              </p>
            </div>
            <div
              className="flex max-w-full gap-2 overflow-x-auto pb-2"
              role="group"
              aria-label="Select a measured session"
            >
              {points.map((item) => (
                <Button
                  key={item.sessionId}
                  variant={point?.sessionId === item.sessionId ? "default" : "outline"}
                  aria-pressed={point?.sessionId === item.sessionId}
                  onClick={() => setPointId(item.sessionId)}
                  className="h-auto min-h-12 shrink-0 flex-col items-start whitespace-normal py-2"
                >
                  <span>{date(item.date)}</span>
                  <span>
                    {number.format(item[measure]!)} yd · {item.counts[measure]} shots
                  </span>
                </Button>
              ))}
            </div>
            {point ? (
              <div
                className="grid gap-2 rounded-xl bg-muted/30 p-3"
                aria-live="polite"
                data-selected-observation
              >
                <p className="font-semibold">
                  {date(point.date)} · {labels[measure]} {number.format(point[measure]!)} yd
                </p>
                <p className="text-sm">
                  {point.counts[measure]} eligible measured shots.{" "}
                  {measure === "side"
                    ? "Lower is closer to the target line."
                    : "Distance changes alone do not establish improvement."}
                </p>
                <Link
                  className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                  href={`/sessions/${point.sessionId}`}
                >
                  Review source session
                </Link>
              </div>
            ) : null}
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
                View measured values as a table
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="py-3 text-left">
                    {scope.club.name} · {labels[measure]} · UTC session dates
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="p-2">
                        Session
                      </th>
                      <th scope="col" className="p-2 text-right">
                        {labels[measure]} (yd)
                      </th>
                      <th scope="col" className="p-2 text-right">
                        Measured shots
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((item) => (
                      <tr key={item.sessionId} className="border-t border-border">
                        <th scope="row" className="p-2 font-normal">
                          <Link
                            className="inline-flex min-h-11 items-center underline"
                            href={`/sessions/${item.sessionId}`}
                          >
                            {date(item.date)}
                          </Link>
                        </th>
                        <td className="p-2 text-right tabular-nums">
                          {number.format(item[measure]!)}
                        </td>
                        <td className="p-2 text-right tabular-nums">{item.counts[measure]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <div className="grid gap-2">
            <p>
              No measured {measure} values in this period. Existing evidence is retained; adjust the
              period or add a comparable session.
            </p>
            <Link
              href="/import"
              className="inline-flex min-h-11 items-center font-semibold text-primary underline"
            >
              Add a measured session
            </Link>
          </div>
        )
      ) : null}
      {!clubs.length ? (
        <p>
          No accessible clubs yet.{" "}
          <Link href="/import" className="underline">
            Import a measured session
          </Link>{" "}
          to begin.
        </p>
      ) : null}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex max-h-dvh flex-col">
          <SheetHeader>
            <SheetTitle>Comparison period</SheetTitle>
            <SheetDescription>
              Include sessions between these UTC dates. Your club, measure and selected tab are
              preserved.
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              const test = new URLSearchParams({ compareFrom: from, compareTo: to });
              if (!comparisonScope(clubs, test).datesValid) {
                setFormError("Choose valid dates with the start on or before the end.");
                return;
              }
              update({ compareFrom: from, compareTo: to });
              setOpen(false);
            }}
          >
            <div className="grid gap-4 overflow-y-auto p-4">
              <label className="grid gap-2">
                From
                <input
                  className="min-h-11 min-w-0 rounded-lg border border-border bg-background p-2"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label className="grid gap-2">
                To
                <input
                  className="min-h-11 min-w-0 rounded-lg border border-border bg-background p-2"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
              {formError ? <p role="alert">{formError}</p> : null}
            </div>
            <SheetFooter className="mt-auto">
              <Button type="submit">Apply period</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setFormError("");
                }}
              >
                Reset period
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
