import Link from "next/link";
import { Activity, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DataPanel, SectionHeader, StatusPill } from "@/components/premium";
import type { DistanceLossDiagnosis, DistanceLossFactor } from "@/lib/distance-loss-diagnosis";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function DistanceLossDiagnosisPanel({ diagnosis }: { diagnosis: DistanceLossDiagnosis }) {
  const maxCarry = Math.max(1, ...diagnosis.monthly.map((month) => month.carryYd ?? 0));

  return (
    <DataPanel id="distance-diagnosis">
      <SectionHeader
        title="What is driving the distance loss?"
        description="A live performance diagnosis using measured driver output and matched recent golf-exposure windows."
        action={
          <StatusPill tone={diagnosis.status === "ready" ? "sky" : "amber"}>
            {diagnosis.confidenceLabel}
          </StatusPill>
        }
      />
      <div className="grid gap-4 p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <Alert className="bg-white/70 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Current read
            </p>
            <AlertTitle className="mt-2 text-xl font-bold leading-7 tracking-normal text-slate-950">
              {diagnosis.headline}
            </AlertTitle>
            <AlertDescription className="mt-2 text-sm leading-6">
              {diagnosis.summary}
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-2 gap-2">
            <DiagnosisMetric
              label="Carry"
              value={formatDiagnosisChange(diagnosis.carryChangeYd, "yd")}
              detail={comparisonDetail(diagnosis)}
            />
            <DiagnosisMetric
              label="Measured club speed"
              value={formatDiagnosisChange(diagnosis.clubSpeedChangeMph, "mph")}
              detail={comparisonDetail(diagnosis)}
            />
            <DiagnosisMetric
              label="Active golf days"
              value={`${diagnosis.exposure.recentActiveDays} vs ${diagnosis.exposure.previousActiveDays}`}
              detail="Latest 56 days vs previous 56"
            />
            <DiagnosisMetric
              label="Measured smash"
              value={formatDiagnosisChange(diagnosis.smashChange, "", 2)}
              detail={comparisonDetail(diagnosis)}
            />
          </div>
        </div>

        {diagnosis.status === "ready" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-xl border border-border/70 bg-white/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Driver median carry</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saved Rapsodo full shots · monthly medians
                  </p>
                </div>
                <BarChart3 className="size-4 text-primary" aria-hidden="true" />
              </div>
              <div
                className="mt-4 grid h-44 grid-cols-4 items-end gap-3 border-b border-border/70"
                role="img"
                aria-label={monthlyCarryAriaLabel(diagnosis)}
              >
                {diagnosis.monthly.map((month) => (
                  <div key={month.key} className="grid h-full content-end gap-2 text-center">
                    <span className="text-xs font-semibold tabular-nums text-slate-950">
                      {month.carryYd === null ? "--" : numberFormatter.format(month.carryYd)}
                    </span>
                    <div className="flex h-28 items-end justify-center">
                      <div
                        className={cn(
                          "w-full max-w-16 rounded-t-md",
                          month.key === diagnosis.current?.key ? "bg-primary" : "bg-sky-300",
                        )}
                        style={{
                          height: `${month.carryYd === null ? 0 : Math.max(6, (month.carryYd / maxCarry) * 100)}%`,
                        }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="pb-2 text-xs font-medium text-muted-foreground">
                      {month.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {diagnosis.factors.map((factor) => (
                <DiagnosisFactorCard key={factor.key} factor={factor} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="rounded-xl border border-border/70 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-950">Recommended next test</p>
            <ol className="mt-2 grid gap-2 text-sm leading-6 text-muted-foreground">
              {diagnosis.nextSteps.map((step, index) => (
                <li key={step} className="grid grid-cols-[22px_1fr] gap-2">
                  <span className="font-semibold tabular-nums text-primary">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid gap-2 lg:w-80">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/stats/training-over-time">
                <Activity aria-hidden="true" />
                View training load
              </Link>
            </Button>
            <Collapsible className="rounded-xl border border-border/70 bg-white/70 p-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start px-0 text-slate-950"
                >
                  Evidence limits
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent asChild>
                <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-muted-foreground">
                  {diagnosis.caveats.map((caveat) => (
                    <li key={caveat}>• {caveat}</li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>
    </DataPanel>
  );
}

function DiagnosisMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-white/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tabular-nums text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function DiagnosisFactorCard({ factor }: { factor: DistanceLossFactor }) {
  return (
    <div className={cn("rounded-xl border p-3", diagnosisFactorTone(factor.tone))}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-950">{factor.label}</p>
        <span className="shrink-0 text-xs font-semibold">{factor.status}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{factor.detail}</p>
    </div>
  );
}

function diagnosisFactorTone(tone: DistanceLossFactor["tone"]) {
  switch (tone) {
    case "green":
      return "border-emerald-200 bg-emerald-50/70 text-emerald-800";
    case "amber":
      return "border-amber-200 bg-amber-50/70 text-amber-800";
    case "sky":
      return "border-sky-200 bg-sky-50/70 text-sky-800";
    case "slate":
      return "border-slate-200 bg-slate-50/80 text-slate-700";
  }
}

function comparisonDetail(diagnosis: DistanceLossDiagnosis) {
  return diagnosis.baseline && diagnosis.current
    ? `${diagnosis.baseline.label} to ${diagnosis.current.label}`
    : "Need comparable months";
}

function formatDiagnosisChange(value: number | null, unit: string, precision = 1) {
  if (value === null) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(precision)}${unit ? ` ${unit}` : ""}`;
}

function monthlyCarryAriaLabel(diagnosis: DistanceLossDiagnosis) {
  return diagnosis.monthly
    .map(
      (month) => `${month.label} ${month.carryYd === null ? "no carry" : `${month.carryYd} yards`}`,
    )
    .join(", ");
}
