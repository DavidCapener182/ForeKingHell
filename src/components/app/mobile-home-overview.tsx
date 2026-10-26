import Link from "next/link";
import { ArrowRight, ArrowUpRight, Target, Upload } from "lucide-react";

type RecentDay = { dateKey: string; shotCount: number };

type MobileHomeOverviewProps = {
  shotCount: number;
  sessionCount: number;
  dateLabel: string | null;
  focusLabel: string | null;
  progressHeadline: string | null;
  progressSummary: string | null;
  best: string | null;
  needsWork: string | null;
  improved: string | null;
  recentDays: RecentDay[];
};

export function MobileHomeOverview({
  shotCount,
  sessionCount,
  dateLabel,
  focusLabel,
  progressHeadline,
  progressSummary,
  best,
  needsWork,
  improved,
  recentDays,
}: MobileHomeOverviewProps) {
  const days = recentDays.slice(-8);
  const maxShots = Math.max(1, ...days.map((day) => day.shotCount));

  return (
    <div className="grid gap-5" data-mobile-home-overview>
      <Link
        href="/import"
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm"
      >
        <Upload className="size-4" aria-hidden /> Upload a Rapsodo session
      </Link>

      <section aria-labelledby="mobile-home-progress-title" className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="mobile-home-progress-title" className="text-sm font-bold">
            What changed
          </h2>
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Latest comparison
          </span>
        </div>
        <Link
          href="/progress"
          className="block rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/50"
        >
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Measured progress
          </p>
          <h3 className="mt-2 text-xl font-semibold leading-tight tracking-tight">
            {progressHeadline || "Build a comparable baseline"}
          </h3>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {progressSummary || "Upload another measured session to see what changed."}
          </p>
          {days.length > 0 ? (
            <div
              className="mt-4 flex h-16 items-end gap-2 border-b border-border/60 pb-1"
              aria-label={`${days.length} recent practice days`}
            >
              {days.map((day) => (
                <span
                  key={day.dateKey}
                  className="min-w-0 flex-1 rounded-t bg-emerald-400/80"
                  style={{ height: `${Math.max(8, (day.shotCount / maxShots) * 100)}%` }}
                  title={`${day.dateKey}: ${day.shotCount} recorded shots`}
                />
              ))}
            </div>
          ) : null}
          <span className="mt-3 flex items-center justify-between text-[0.68rem] text-muted-foreground">
            <span>Saved shots by practice day</span>
            <ArrowUpRight className="size-4" aria-hidden />
          </span>
        </Link>
      </section>

      <section aria-labelledby="mobile-home-readout-title" className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="mobile-home-readout-title" className="text-sm font-bold">
            Session readout
          </h2>
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {dateLabel ?? "No practice yet"}
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl bg-card px-4 shadow-sm ring-1 ring-border/50">
          <Readout label="Best signal" value={best || "Waiting for comparable shots"} tone="good" />
          <Readout
            label="Needs work"
            value={needsWork || "No clear setback measured"}
            tone="alert"
          />
          <Readout
            label="Improved"
            value={improved || "Another comparable session is needed"}
            tone="good"
            last
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/sessions"
            className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/50"
          >
            <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Sessions
            </span>
            <span className="mt-2 block text-3xl font-semibold tabular-nums">{sessionCount}</span>
            <span className="text-xs text-muted-foreground">Latest practice day</span>
          </Link>
          <Link href="/shots" className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/50">
            <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Shots
            </span>
            <span className="mt-2 block text-3xl font-semibold tabular-nums">{shotCount}</span>
            <span className="text-xs text-muted-foreground">Latest practice day</span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="mobile-home-focus-title" className="grid gap-2">
        <h2 id="mobile-home-focus-title" className="text-sm font-bold">
          This week’s focus
        </h2>
        <div className="rounded-2xl border border-blue-200/80 bg-blue-50 p-4 text-slate-900 shadow-sm dark:border-blue-900 dark:bg-blue-950 dark:text-slate-100">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
              <Target className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-300">
                Practice plan
              </p>
              <p className="mt-1 text-sm font-semibold">
                {focusLabel || "Build a measured practice plan"}
              </p>
            </div>
          </div>
          <Link
            href="/practice"
            className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white"
          >
            Next practice <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Readout({
  label,
  value,
  tone,
  last = false,
}: {
  label: string;
  value: string;
  tone: "good" | "alert";
  last?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 py-3 ${last ? "" : "border-b border-border/60"}`}>
      <span
        className={`mt-1 size-2 shrink-0 rounded-full ${tone === "good" ? "bg-emerald-500" : "bg-rose-500"}`}
      />
      <div>
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-medium leading-5">{value}</p>
      </div>
    </div>
  );
}
