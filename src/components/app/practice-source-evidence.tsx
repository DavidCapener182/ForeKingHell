import Link from "next/link";
import { ArrowUpRight, History } from "lucide-react";
import type { PracticePlannerContext } from "@/lib/practice-planner";

export function PracticeSourceEvidence({
  source,
}: {
  source: PracticePlannerContext["latestPractice"];
}) {
  if (!source.sessionId) return null;
  return (
    <Link
      href={`/sessions/${encodeURIComponent(source.sessionId)}`}
      prefetch={false}
      data-practice-source-session={source.sessionId}
      className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <History className="size-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Based on your {source.dateLabel} review</span>
        <span className="block text-xs text-muted-foreground">
          Open the session behind this practice
        </span>
      </span>
      <ArrowUpRight className="size-4 shrink-0" aria-hidden />
    </Link>
  );
}
