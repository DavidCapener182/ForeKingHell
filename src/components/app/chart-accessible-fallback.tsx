import Link from "next/link";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export type ChartFallbackColumn = {
  key: string;
  label: string;
};

export type ChartFallbackRow = Record<string, string>;

type ChartAccessibleFallbackProps = {
  title: string;
  summary: string;
  columns: ChartFallbackColumn[];
  rows: ChartFallbackRow[];
  explainHref?: string;
  className?: string;
};

export function ChartAccessibleFallback({
  title,
  summary,
  columns,
  rows,
  explainHref,
  className,
}: ChartAccessibleFallbackProps) {
  const aiExplainHref = explainHref ?? buildChartExplainHref(title, summary, columns, rows);

  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border border-dashed border-emerald-200 bg-emerald-50/35 p-3",
        className,
      )}
      aria-label={`${title} chart accessibility`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900">
        Chart summary
      </p>
      <p className="mt-1 text-sm leading-5 text-emerald-950" data-chart-summary={title}>
        {summary}
      </p>
      <Link
        href={aiExplainHref}
        prefetch={false}
        aria-label={`Explain ${title} chart`}
        className="focus-aaa mt-3 inline-flex h-8 items-center gap-2 rounded-lg border border-emerald-200 bg-white/78 px-2.5 text-sm font-semibold text-emerald-900 outline-none hover:border-emerald-300 hover:bg-white"
      >
        <Sparkles className="size-4" aria-hidden />
        Explain this chart
      </Link>
      <details className="group mt-2">
        <summary className="focus-aaa inline-flex max-w-full cursor-pointer list-none items-center rounded-md text-sm font-semibold text-emerald-800 outline-none hover:text-emerald-950 [&::-webkit-details-marker]:hidden">
          View {title} chart data table
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table
            className="w-full min-w-[34rem] text-left text-xs"
            aria-label={`${title} chart data table`}
          >
            <thead className="border-b border-emerald-200 text-[10px] uppercase tracking-[0.12em] text-emerald-900/75">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className="px-2 py-2 font-semibold">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row._key ?? columns.map((column) => row[column.key]).join("-")}
                    className="border-b border-emerald-100 last:border-b-0"
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-2 py-2 tabular-nums text-emerald-950">
                        {row[column.key] ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-2 py-3 text-muted-foreground">
                    No chart rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function buildChartExplainHref(
  title: string,
  summary: string,
  columns: ChartFallbackColumn[],
  rows: ChartFallbackRow[],
) {
  const visibleRows = rows.slice(0, 8).map((row, index) => {
    const rowValues = columns
      .map((column) => `${column.label}: ${row[column.key] ?? "-"}`)
      .join(", ");

    return `Row ${index + 1}: ${rowValues}`;
  });
  const rowContext =
    visibleRows.length > 0
      ? `Visible data rows${rows.length > visibleRows.length ? ` (first ${visibleRows.length} of ${rows.length})` : ""}: ${visibleRows.join(" | ")}.`
      : "Visible data rows: none.";
  const prompt = [
    `Explain the ${title} chart using only the visible ForeKingHell chart summary and data table.`,
    `Visible summary: ${summary}`,
    rowContext,
    "Call out low-confidence or missing chart rows instead of filling gaps.",
  ].join(" ");

  return `/data-chat?prompt=${encodeURIComponent(prompt)}`;
}
