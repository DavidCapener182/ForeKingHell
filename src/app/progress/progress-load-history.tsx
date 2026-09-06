"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
import { ProgressTrainingLoadChart } from "@/components/progress/progress-training-load-chart";
import { MobileTrainingChart } from "@/components/training/mobile-training-chart";
import { selectTrainingRangeData } from "@/lib/training/rangeSelection";
import { normalizeTrainingRange, TRAINING_RANGE_OPTIONS } from "@/lib/training/ranges";
import type { TrainingOverTimeData } from "@/lib/training/trainingData";

const format = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "Unavailable"
    : value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
export function ProgressLoadHistory({
  data,
  companion = false,
}: {
  data: TrainingOverTimeData;
  companion?: boolean;
}) {
  const query = useSearchParams();
  const router = useRouter();
  const range = normalizeTrainingRange(query.get("loadRange") ?? undefined);
  const selected = selectTrainingRangeData(data, range);
  const [selectedDate, setSelectedDate] = useState("");
  const point =
    selected.series.find((item) => item.date === selectedDate) ?? selected.series.at(-1);
  return (
    <div className="grid min-w-0 gap-4" data-progress-load-history>
      <UntitledSelect
        label="Training period"
        name="loadRange"
        value={range}
        options={TRAINING_RANGE_OPTIONS.map((option) => ({
          value: option.key,
          label: option.label,
        }))}
        onValueChange={(value) => {
          const url = new URL(window.location.href);
          url.searchParams.set("loadRange", value);
          router.push(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
        }}
      />
      <p className="text-sm text-muted-foreground">
        {selected.chartStartDate} to {data.today} · {selected.rangeDays} days. Workload reflects
        logged activity; it is distinct from golf performance.
      </p>
      {data.hasTrainingData && selected.series.length ? (
        <>
          {companion ? (
            <MobileTrainingChart data={selected.series} />
          ) : (
            <ProgressTrainingLoadChart
              data={selected.series}
              sessionMarkers={selected.sessionMarkers}
            />
          )}
          <UntitledSelect
            label="Inspect training date"
            name="trainingDate"
            value={point?.date ?? ""}
            options={[...selected.series]
              .reverse()
              .map((item) => ({ value: item.date, label: item.date }))}
            onValueChange={setSelectedDate}
          />
          {point ? (
            <dl
              className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 text-sm sm:grid-cols-4"
              aria-live="polite"
            >
              {[
                { label: "Logged load", value: point.load },
                { label: "Fitness", value: point.fitness },
                { label: "Recent load", value: point.fatigue },
                { label: "Golf form", value: point.form },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="font-semibold tabular-nums">{format(item.value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
              View training values as a table
            </summary>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-right text-sm">
                <caption className="py-3 text-left">
                  Same calculated inputs as Training over time · {selected.chartStartDate} to{" "}
                  {data.today}
                </caption>
                <thead>
                  <tr>
                    {["Date", "Logged load", "Fitness", "Recent load", "Golf form"].map((label) => (
                      <th key={label} scope="col" className="p-2">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...selected.series].reverse().map((item) => (
                    <tr key={item.date} className="border-t border-border">
                      <th scope="row" className="whitespace-nowrap p-2 font-normal">
                        {item.date}
                      </th>
                      {[item.load, item.fitness, item.fatigue, item.form].map((value, index) => (
                        <td key={index} className="p-2 tabular-nums">
                          {format(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p>No logged training in this period. Change the range or log activity to begin.</p>
      )}
      <p className="text-sm">
        {data.status.advice} <span className="text-muted-foreground">{data.confidence.label}.</span>
      </p>
    </div>
  );
}
