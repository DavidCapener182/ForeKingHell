import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, CircleDot } from "lucide-react";

import { StatusPill, type Tone } from "@/components/premium";
import { cn } from "@/lib/utils";

export type EvidenceConfidence = "early signal" | "developing" | "reliable" | "strong evidence";
export type ProductConfidence =
  | "High confidence"
  | "Moderate confidence"
  | "Low confidence"
  | "Estimated"
  | "Insufficient evidence";

export type MetricEvidence = {
  measuredShots?: number;
  sessions?: number;
  dateRange?: string;
  excludedShots?: number;
  source?: string;
  context?: string;
  explanation?: string;
};

export function ConfidenceIndicator({
  label,
  detail,
  className,
}: {
  label: EvidenceConfidence | string;
  detail?: string;
  className?: string;
}) {
  const normalized = label.toLowerCase();
  const tone: Tone = normalized.includes("strong")
    ? "green"
    : normalized.includes("reliable")
      ? "sky"
      : normalized.includes("developing")
        ? "amber"
        : "slate";

  return (
    <span className={cn("inline-flex min-w-0 flex-col items-start gap-1", className)}>
      <StatusPill tone={tone}>{label}</StatusPill>
      {detail ? <span className="text-xs leading-4 text-muted-foreground">{detail}</span> : null}
    </span>
  );
}

export function MetricEvidenceDrawer({
  label,
  value,
  confidence,
  evidence,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  confidence: ProductConfidence;
  evidence: MetricEvidence;
  className?: string;
}) {
  const pairs = [
    evidence.measuredShots !== undefined
      ? ["Sample", `${evidence.measuredShots} measured shots`]
      : null,
    evidence.sessions !== undefined
      ? ["Coverage", `${evidence.sessions} ${evidence.sessions === 1 ? "session" : "sessions"}`]
      : null,
    evidence.dateRange ? ["Date range", evidence.dateRange] : null,
    evidence.excludedShots !== undefined
      ? ["Cleaning", `${evidence.excludedShots} outliers excluded`]
      : null,
    evidence.source ? ["Source", evidence.source] : null,
    evidence.context ? ["Context", evidence.context] : null,
  ].filter((pair): pair is [string, string] => pair !== null);

  return (
    <details
      className={cn("group rounded-2xl border border-border/70 bg-card/70 open:bg-card", className)}
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
          <span className="mt-1 block font-display text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <ConfidenceIndicator label={confidence} />
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </span>
      </summary>
      <div className="border-t border-border/70 px-4 py-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          {pairs.map(([term, description]) => (
            <div key={term} className="rounded-xl bg-muted/45 px-3 py-2">
              <dt className="text-xs font-medium text-muted-foreground">{term}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground">{description}</dd>
            </div>
          ))}
        </dl>
        {evidence.explanation ? (
          <div className="mt-4 border-l-2 border-primary pl-3 text-sm leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">Why {confidence.toLowerCase()}?</p>
            <p>{evidence.explanation}</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function AnswerCard({
  eyebrow,
  answer,
  detail,
  confidence,
  action,
  className,
}: {
  eyebrow: ReactNode;
  answer: ReactNode;
  detail?: ReactNode;
  confidence?: ProductConfidence;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "premium-card rounded-3xl border border-border/70 bg-card px-5 py-5 shadow-sm sm:px-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
        {confidence ? <ConfidenceIndicator label={confidence} /> : null}
      </div>
      <div className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {answer}
      </div>
      {detail ? (
        <div className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{detail}</div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export function RecommendedAction({
  title,
  detail,
  href,
  actionLabel = "Start now",
  className,
}: {
  title: ReactNode;
  detail: ReactNode;
  href: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-3xl border border-primary/25 bg-primary/8 px-5 py-5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Recommended next action
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</div>
      </div>
      <Link
        href={href}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {actionLabel}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

export function DataWarning({
  title,
  detail,
  action,
  className,
}: {
  title: ReactNode;
  detail: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950",
        className,
      )}
      role="status"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <div className="mt-0.5 text-sm leading-5 opacity-85">{detail}</div>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </aside>
  );
}

export function DataHealthStatus({
  issueCount,
  highPriorityCount = 0,
  className,
}: {
  issueCount: number;
  highPriorityCount?: number;
  className?: string;
}) {
  const healthy = issueCount === 0;
  const Icon = healthy ? CheckCircle2 : highPriorityCount > 0 ? AlertTriangle : CircleDot;

  return (
    <div
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-2xl border px-4 py-3",
        healthy
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : highPriorityCount > 0
            ? "border-amber-300 bg-amber-50 text-amber-950"
            : "border-sky-200 bg-sky-50 text-sky-950",
        className,
      )}
      role="status"
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">
          {healthy ? "Data health looks clear" : `${issueCount} data issues`}
        </p>
        <p className="text-xs leading-5 opacity-80">
          {healthy
            ? "No current repair actions were detected."
            : highPriorityCount > 0
              ? `${highPriorityCount} high-priority ${highPriorityCount === 1 ? "issue needs" : "issues need"} attention.`
              : "Review the repair actions before relying on weak signals."}
        </p>
      </div>
    </div>
  );
}
