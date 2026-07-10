import { AlertTriangle, CheckCircle2, CircleDot } from "lucide-react";

import { StatusPill, type Tone } from "@/components/premium";
import { cn } from "@/lib/utils";

export type EvidenceConfidence = "early signal" | "developing" | "reliable" | "strong evidence";

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
