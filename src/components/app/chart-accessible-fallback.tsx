import Link from "next/link";
import { ChevronDown, Download, Sparkles } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  embedded?: boolean;
};

export function ChartAccessibleFallback({
  title,
  summary,
  columns,
  rows,
  explainHref,
  className,
  embedded = true,
}: ChartAccessibleFallbackProps) {
  const aiExplainHref = explainHref ?? buildChartExplainHref(title, summary, columns, rows);
  const csvHref = buildCsvHref(columns, rows);
  const controls = (
    <>
      <ButtonGroup className="flex-wrap">
        <Button asChild size="sm" variant="outline">
          <Link href={aiExplainHref} prefetch={false} aria-label={`Explain ${title} chart`}>
            <Sparkles className="size-4" aria-hidden />
            Explain this chart
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a
            href={csvHref}
            download={`${fileName(title)}.csv`}
            aria-label={`Export ${title} chart as CSV`}
          >
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
        </Button>
      </ButtonGroup>
      <Collapsible className="group/collapsible" data-chart-data-disclosure>
        <CollapsibleTrigger
          type="button"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "w-full justify-between whitespace-normal",
          })}
        >
          View {title} chart data table
          <ChevronDown className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-180 motion-reduce:transition-none" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Table className="min-w-[34rem] text-xs" aria-label={`${title} chart data table`}>
            <TableHeader className="text-[10px] uppercase tracking-[0.12em]">
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <TableRow key={row._key ?? columns.map((column) => row[column.key]).join("-")}>
                    {columns.map((column) => (
                      <TableCell key={column.key} className="tabular-nums text-foreground">
                        {row[column.key] ?? "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground">
                    No chart rows yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>
    </>
  );

  if (embedded) {
    return (
      <section
        className={cn("min-w-0 border-t border-border pt-3", className)}
        aria-label={`${title} chart accessibility`}
        data-chart-accessible-fallback="embedded"
      >
        <div className="grid gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-foreground">
            Chart summary
          </p>
          <p className="text-sm leading-5 text-foreground" data-chart-summary={title}>
            {summary}
          </p>
        </div>
        <div className="mt-3 grid gap-3">{controls}</div>
      </section>
    );
  }

  return (
    <Card
      size="sm"
      className={cn("min-w-0 overflow-hidden border-dashed", className)}
      aria-label={`${title} chart accessibility`}
      data-chart-accessible-fallback="standalone"
    >
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-[0.12em]">Chart summary</CardTitle>
        <CardDescription className="text-sm leading-5 text-foreground" data-chart-summary={title}>
          {summary}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">{controls}</CardContent>
    </Card>
  );
}

function buildCsvHref(columns: ChartFallbackColumn[], rows: ChartFallbackRow[]) {
  const csv = [
    columns.map((column) => csvCell(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column.key] ?? "")).join(",")),
  ].join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function fileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "chart"
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
