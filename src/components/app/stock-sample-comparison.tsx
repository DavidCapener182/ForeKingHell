import type { CompareSampleSummary } from "@/lib/compare-data";

type Sample = Pick<CompareSampleSummary, "carryMedianYd" | "stockShots">;

export function StockSampleComparison({ focus, baseline }: { focus: Sample; baseline: Sample }) {
  const maximum = Math.max(focus.carryMedianYd ?? 0, baseline.carryMedianYd ?? 0);
  if (!maximum) return null;
  return (
    <figure className="rounded-xl border bg-card p-4">
      <figcaption className="mb-3 font-semibold">Median stock carry</figcaption>
      <dl className="grid gap-3">
        {[
          { label: "Selected", sample: focus },
          { label: "Baseline", sample: baseline },
        ].map(({ label, sample }) => (
          <div
            key={label}
            className="grid grid-cols-[5.5rem_minmax(0,1fr)_5rem] items-center gap-2 text-sm"
          >
            <dt>
              {label}
              <span className="block text-xs text-muted-foreground">
                {sample.stockShots} stock shots
              </span>
            </dt>
            <dd aria-hidden="true" className="h-2 overflow-hidden rounded-sm bg-muted">
              {sample.carryMedianYd !== null && (
                <span
                  className={
                    label === "Selected"
                      ? "block h-full bg-primary"
                      : "block h-full bg-muted-foreground"
                  }
                  style={{ width: `${(100 * sample.carryMedianYd) / maximum}%` }}
                />
              )}
            </dd>
            <dd className="text-right font-semibold tabular-nums">
              {sample.carryMedianYd === null
                ? "No reading"
                : `${sample.carryMedianYd.toFixed(1)} yd`}
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
