"use client";
import { useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
export function ConditionsScope({
  clubs,
  clubId,
  dimension,
  from,
  to,
  count,
}: {
  clubs: Array<{ id: string; label: string; shotCount: number }>;
  clubId: string;
  dimension: string;
  from: string;
  to: string;
  count: number;
}) {
  const id = useId();
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(clubId);
  const [dim, setDim] = useState(dimension);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const options = clubs.filter(
    (club) => club.id === selected || club.label.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <form
      id={id}
      data-conditions-ready={ready ? "true" : "false"}
      action="/analyse/conditions"
      className="grid gap-3 rounded-xl border bg-card p-4"
    >
      <input type="hidden" name="dimension" value={dim} />
      <input type="hidden" name="from" value={start} />
      <input type="hidden" name="to" value={end} />
      <p className="text-sm">
        {count} included rows · {from || "Earliest loaded"} to {to || "latest loaded"} · up to 5,000
        rows
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Search clubs
          <Input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Club
          <select
            name="clubId"
            className="min-h-11 w-full rounded-lg border bg-background px-3"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {options.map((club) => (
              <option key={club.id} value={club.id}>
                {club.label} · {club.shotCount} rows
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline">
              Condition filters ({Number(dim !== "all") + Number(!!start) + Number(!!end)})
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Condition filters</SheetTitle>
              <SheetDescription>
                Filter recorded evidence by session date and condition dimension. Unknown rows stay
                explicit.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 overflow-y-auto p-4">
              <label className="grid gap-1 text-sm font-medium">
                Condition dimension
                <select
                  className="min-h-11 rounded-lg border bg-background px-3"
                  value={dim}
                  onChange={(event) => setDim(event.target.value)}
                >
                  {[
                    ["all", "All dimensions"],
                    ["context", "Course, range and indoor"],
                    ["temperature", "Temperature"],
                    ["wind", "Wind"],
                    ["elevation", "Elevation"],
                    ["surface", "Mat or grass"],
                    ["ball", "Ball"],
                    ["ground", "Wet or dry"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                From session date
                <Input
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  max={end || undefined}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                To session date
                <Input
                  type="date"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  min={start || undefined}
                />
              </label>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 border-t p-4">
              <Button type="submit" form={id}>
                Apply filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDim("all");
                  setStart("");
                  setEnd("");
                }}
              >
                Reset filters
              </Button>
              <SheetClose asChild>
                <Button variant="outline">Close filters</Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
        <Button type="submit">Apply club</Button>
        <Button asChild variant="outline">
          <Link href="/analyse/conditions">Clear all</Link>
        </Button>
      </div>
    </form>
  );
}
export function ConditionProof({
  title,
  rows,
  total,
  page,
  nextHref,
  previousHref,
}: {
  title: string;
  rows: Array<{
    id: string;
    sessionId: string;
    clubId: string;
    date: string;
    carry: number | null;
    side: number | null;
    context: string | null;
    source: string;
    raw: Record<string, string> | null;
  }>;
  total: number;
  page: number;
  nextHref: string | null;
  previousHref: string | null;
}) {
  return (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">Inspect {title} source evidence</Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title} source evidence</SheetTitle>
          <SheetDescription>Recorded source fields and exact shot links.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="grid gap-3 bg-card p-4" id="condition-proof">
            <h2 className="text-xl font-semibold">{title} — source evidence</h2>
            <p className="text-sm text-muted-foreground">
              {total} matching rows · page {page}. These rows are selected using the same
              classification as the condition groups.
            </p>
            <div className="grid gap-3">
              {rows.map((row) => (
                <details key={row.id} className="rounded-lg border p-3">
                  <summary className="min-h-11 cursor-pointer text-sm font-medium">
                    {row.date} ·{" "}
                    {row.carry === null ? "Carry unavailable" : `${row.carry} yd carry`} ·{" "}
                    {row.source}
                  </summary>
                  <dl className="mt-2 grid gap-2 text-sm">
                    <div>
                      <dt>Recorded context</dt>
                      <dd>{row.context || "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Recorded side carry</dt>
                      <dd>{row.side === null ? "Unavailable" : `${row.side} yd`}</dd>
                    </div>
                    {Object.entries(row.raw ?? {}).map(([key, value]) => (
                      <div key={key}>
                        <dt className="font-medium">{key}</dt>
                        <dd className="break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <Link href={`/shots?clubId=${row.clubId}&shotId=${row.id}`}>
                        Inspect exact shot
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/sessions/${row.sessionId}`}>Source session</Link>
                    </Button>
                  </div>
                </details>
              ))}
            </div>
            <nav aria-label="Condition evidence pages" className="flex gap-2">
              {previousHref && (
                <Button asChild variant="outline">
                  <Link href={previousHref}>Previous rows</Link>
                </Button>
              )}
              {nextHref && (
                <Button asChild variant="outline">
                  <Link href={nextHref}>Next rows</Link>
                </Button>
              )}
            </nav>
          </section>
        </div>
        <SheetClose asChild>
          <Button variant="outline" className="m-4 min-h-11">
            Close source evidence
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
