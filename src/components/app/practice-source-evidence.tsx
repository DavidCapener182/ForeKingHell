import type { SimulatorPracticeSource } from "@/lib/simulator-practice-handoff";
import type { SgPracticeSource } from "@/lib/strokes-gained-practice-handoff";
import Link from "next/link";
import { ArrowUpRight, History } from "lucide-react";
import type { PracticePlannerContext } from "@/lib/practice-planner";

export function PracticeSourceEvidence({
  source,
  coachSource = false,
  sgSource,
  simulatorSource,
}: {
  source: PracticePlannerContext["latestPractice"];
  coachSource?: boolean;
  sgSource?: SgPracticeSource;
  simulatorSource?: SimulatorPracticeSource;
}) {
  if (simulatorSource)
    return (
      <aside
        className="rounded-xl border bg-card px-4 py-3 text-sm"
        aria-label="Simulator practice source"
      >
        <p className="font-semibold">
          Simulator Lab prescription from {simulatorSource.sampleSize} usable range shots
        </p>
        <p>
          Launch-monitor estimate; completion does not prove improvement. Record the prescribed
          observations manually.
        </p>
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">
            Saved source sessions ({simulatorSource.sessionIds.length})
          </summary>
          <ul>
            {simulatorSource.sessionIds.map((id, index) => (
              <li key={id}>
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={`/sessions/${id}`}
                  prefetch={false}
                >
                  Open source session {index + 1}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </aside>
    );
  if (sgSource)
    return (
      <aside
        className="rounded-xl border bg-card px-4 py-3 text-sm"
        aria-label="Strokes-gained practice source"
      >
        <p className="font-semibold">
          Source: selected {sgSource.category.replaceAll("_", " ")} scoring events
        </p>
        <p>
          {sgSource.sampleSize} calculated · {sgSource.pendingCount} pending ·{" "}
          {sgSource.total === null
            ? "SG unjudged"
            : `${sgSource.total} strokes gained in this mapped sample`}
          . This is not a complete-round total.
        </p>
        <p className="mt-1">
          Record this drill’s observations manually. Completing it does not prove a measured
          improvement.
        </p>
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">
            Saved source rounds ({sgSource.sessionIds.length})
          </summary>
          <ul>
            {sgSource.sessionIds.map((id, index) => (
              <li key={id}>
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={`/rounds/${id}`}
                  prefetch={false}
                >
                  Open source round {index + 1}
                </Link>
              </li>
            ))}
          </ul>
        </details>
        <Link
          className="mt-2 inline-flex min-h-11 items-center underline"
          href={`/strokes-gained?category=${sgSource.category}`}
          prefetch={false}
        >
          Review current category evidence
        </Link>
      </aside>
    );
  if (coachSource)
    return (
      <aside className="rounded-xl border bg-card px-4 py-3 text-sm" aria-label="Coaching source">
        <p className="font-semibold">Source: Coach’s selected club evidence</p>
        <p>
          The saved drill and target use your owned club sample. A later practice import supplies
          outcome evidence.
        </p>
        {source.sessionId && (
          <Link
            className="mt-2 inline-flex min-h-11 items-center underline"
            href={`/sessions/${encodeURIComponent(source.sessionId)}`}
            prefetch={false}
          >
            Latest practice history: {source.dateLabel}
          </Link>
        )}
      </aside>
    );
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
