import Link from "next/link";
import { PageShell } from "@/components/app/page-shell";
import { TodayHydrationBoundary } from "@/components/app/today-hydration-boundary";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, DataPanel } from "@/components/premium";
import type { TodayRound } from "@/lib/today-round-data";
import { summarizeTodayRound } from "@/lib/today-round-summary";

export function TodayRoundView({ round }: { round: TodayRound }) {
  const s = summarizeTodayRound(round);
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(round.session.date);
  const relative = s.toPar === 0 ? "E" : s.toPar > 0 ? `+${s.toPar}` : String(s.toPar);
  const metrics = [
    ["Putts", s.putts],
    ["Fairways hit", s.fairways.recorded ? `${s.fairways.hit}/${s.fairways.recorded}` : null],
    ["Greens in regulation", s.greens.recorded ? `${s.greens.hit}/${s.greens.recorded}` : null],
    ["Penalties", s.penalties],
    ["Chip shots", s.chips],
    ["Net score", s.net],
  ].filter(([, value]) => value !== null);
  return (
    <PageShell>
      <div data-today-round className="flex min-w-0 flex-col gap-5">
        <PageHeader
          title="Today"
          description="Your latest round. Review the scorecard and the stats you recorded."
        />
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground sm:p-8">
          <p className="text-sm opacity-80">
            {date} · {round.session.type === "real_round" ? "Course round" : "Round review"}
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {round.session.courseName ?? round.session.location ?? "Your round"}
              </h2>
              <p className="mt-2 text-sm opacity-80">
                {round.tee
                  ? `${round.tee.name} tees · ${round.tee.yards ? `${round.tee.yards.toLocaleString("en-GB")} yd · ` : ""}`
                  : ""}
                {s.played.length} holes scored · Par {s.par}
              </p>
            </div>
            <div>
              <span className="text-6xl font-semibold tabular-nums">{s.gross}</span>
              <span className="ml-3 text-2xl">{relative}</span>
              <p className="mt-2 text-sm opacity-80">
                Gross score · {s.front} out
                {s.played.some((h) => h.holeNumber > 9) ? ` / ${s.back} back` : ""}
              </p>
            </div>
          </div>
          <Link
            href={`/rounds/${round.session.id}`}
            className="mt-6 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            Open full round →
          </Link>
        </section>
        {metrics.length ? (
          <DataPanel>
            <h2 className="text-xl font-semibold">Round stats</h2>
            <dl className="mt-4 grid grid-cols-2 gap-5 lg:grid-cols-3">
              {metrics.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-3xl font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">
              Fairways and greens count holes with a recorded result.
            </p>
          </DataPanel>
        ) : null}
        <DataPanel>
          <h2 className="text-xl font-semibold">How you scored</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Birdie or better", s.birdies],
              ["Pars", s.pars],
              ["Bogeys", s.bogeys],
              ["Double or worse", s.doubles],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </DataPanel>
        <DataPanel>
          <h2 className="text-xl font-semibold">Hole by hole</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Round scorecard for {round.session.courseName}, {date}
              </caption>
              <thead>
                <tr>
                  {["Hole", "Par", "Score", "Putts", "Fairway", "Green"].map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.holes.map((h) => (
                  <tr key={h.holeNumber} className="border-t border-border">
                    <th scope="row" className="p-2">
                      {h.holeNumber}
                    </th>
                    <td className="p-2">{h.par}</td>
                    <td className="p-2 font-semibold">{h.score ?? "—"}</td>
                    <td className="p-2">{h.putts ?? "—"}</td>
                    <td className="p-2">
                      {h.par === 3
                        ? "N/A"
                        : h.fairwayHit == null
                          ? "—"
                          : h.fairwayHit
                            ? "Hit"
                            : "Miss"}
                    </td>
                    <td className="p-2">{h.gir == null ? "—" : h.gir ? "Hit" : "Miss"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>
        {round.session.notes ? (
          <DataPanel>
            <h2 className="text-xl font-semibold">Round notes & extra stats</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
              {round.session.notes}
            </p>
          </DataPanel>
        ) : null}
        <nav aria-label="After your round" className="flex flex-wrap gap-3">
          <Link href="/practice" className={buttonVariants()}>
            Plan next practice
          </Link>
          <Link href="/today?view=practice" className={buttonVariants({ variant: "outline" })}>
            Latest practice review
          </Link>
          <Link href="/rounds" className={buttonVariants({ variant: "outline" })}>
            All rounds
          </Link>
        </nav>
      </div>
      <TodayHydrationBoundary />
    </PageShell>
  );
}
