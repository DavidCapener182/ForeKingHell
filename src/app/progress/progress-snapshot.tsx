import Link from "next/link";

export function ProgressSnapshot({ score, cleanShots }: { score: number; cleanShots: number }) {
  return (
    <section
      className="grid min-w-0 gap-3 rounded-2xl border border-border bg-card p-5"
      aria-label="Current composite snapshot"
      data-progress-snapshot
    >
      <h2 className="text-xl font-semibold">
        {cleanShots ? "Current snapshot" : "Build your first baseline"}
      </h2>
      {cleanShots > 0 ? (
        <p className="text-3xl font-semibold tabular-nums">
          {Object.is(score, -0) ? 0 : score}{" "}
          <span className="text-sm text-muted-foreground">/ 100</span>
        </p>
      ) : null}
      <p className="text-sm leading-6 text-muted-foreground">
        The composite combines club trust, playability, sample depth and measured club movement. It
        is not a handicap or a pure distance score.
      </p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Calculation window</dt>
          <dd>Current eligible club evidence</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Source count</dt>
          <dd>{cleanShots} clean shots</dd>
        </div>
      </dl>
      <p className="text-sm leading-6">
        {cleanShots
          ? "Historical composite scores are not stored. A dated baseline is needed before a change in this score can be shown. Measured club comparisons below remain available."
          : "Add a measured session to begin. Missing evidence is not a zero performance score."}
      </p>
      <Link
        href={cleanShots ? "/sessions" : "/import"}
        className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
      >
        {cleanShots ? "Review source sessions" : "Import your first session"}
      </Link>
    </section>
  );
}
