import Link from "next/link";
import { DataPanel, SectionHeader, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import type { SpeedDevelopmentSummary } from "@/lib/speed-development";

export function SpeedReadinessPanel({
  development,
}: {
  development: Pick<SpeedDevelopmentSummary, "readiness">;
}) {
  const { readiness } = development;

  return (
    <DataPanel id="speed-readiness">
      <SectionHeader
        title="Speed Readiness"
        description="Current assessment as of today, using existing golf-load and speed windows. Changing the history range below does not backdate this recommendation."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusPill tone={readiness.tone}>{readiness.label}</StatusPill>
            <Button asChild size="sm" variant="outline">
              <Link href="/speed" prefetch={false}>
                Open Speed Centre
              </Link>
            </Button>
          </div>
        }
      />
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(12rem,0.32fr)_minmax(0,0.68fr)]">
        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Training context
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {readiness.label}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Descriptive guidance from logged activity; no recovery percentage is estimated.
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-foreground">
            {readiness.recommendation}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2" aria-label="Speed readiness reasons">
          {readiness.reasons.map((reason) => (
            <div key={reason.label} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{reason.label}</p>
                <StatusPill
                  tone={
                    reason.state === "positive"
                      ? "green"
                      : reason.state === "caution"
                        ? "amber"
                        : "slate"
                  }
                >
                  {reason.state === "positive"
                    ? "Supports speed"
                    : reason.state === "caution"
                      ? "Use caution"
                      : "Needs evidence"}
                </StatusPill>
              </div>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{reason.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </DataPanel>
  );
}
