"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MobileMetricStory } from "@/components/app/mobile-metric-story";
import { Button } from "@/components/ui/button";
import type { SessionStoryGroup } from "@/lib/mobile-session-review";
import type { ShotPatternPoint } from "@/lib/shot-pattern-chart-data";
import { LazyMobileShotPatternCharts } from "@/components/app/lazy-mobile-shot-pattern-charts";
import styles from "./mobile-session-story.module.css";

export function MobileSessionStory({
  groups,
  preferredClub,
  sessionId,
}: {
  groups: SessionStoryGroup[];
  preferredClub: string | null;
  sessionId: string;
}) {
  const query = useSearchParams();
  const group =
    groups.find((candidate) => candidate.clubType === query.get("club")) ??
    groups.find((candidate) => candidate.clubType === preferredClub) ??
    groups[0];
  const shotQuery = new URLSearchParams({ sessionId });
  if (group) shotQuery.set("club", group.clubType);
  return (
    <section className="grid min-w-0 gap-3" aria-label="Club results">
      {groups.length > 1 ? (
        <label className={styles.picker}>
          <span>Club results</span>
          <span className={styles.control}>
            <select
              aria-label="Club results"
              value={group.clubType}
              onChange={(event) => {
                const url = new URL(window.location.href);
                url.searchParams.set("club", event.target.value);
                window.history.replaceState(window.history.state, "", url);
              }}
            >
              {groups.map((candidate) => (
                <option value={candidate.clubType} key={candidate.clubType}>
                  {candidate.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden />
          </span>
        </label>
      ) : null}
      {group?.metrics.length ? (
        <MobileMetricStory
          key={group.clubType}
          metrics={group.metrics}
          context={`${group.label} · ${group.trustedCount} of ${group.importedCount} shots trusted`}
        />
      ) : (
        <p className="mobile-type-callout text-muted-foreground" role="status">
          {group
            ? `No trusted metric readings for ${group.label}. Review the imported shots to check their evidence status.`
            : "No metric readings are available for this session."}
        </p>
      )}
      <Button asChild variant="outline" className="min-h-12">
        <Link href={`/shots?${shotQuery}`}>View {group ? `${group.label} shots` : "shots"}</Link>
      </Button>
      {groups.length > 1 ? (
        <Link
          className="mobile-type-callout flex min-h-11 items-center justify-center text-primary"
          href={`/shots?sessionId=${sessionId}`}
        >
          View all {groups.reduce((total, candidate) => total + candidate.importedCount, 0)} shots
        </Link>
      ) : null}
    </section>
  );
}

export function MobileSessionPattern({
  points,
  preferredClub,
  initiallyOpen = false,
}: {
  points: ShotPatternPoint[];
  preferredClub: string | null;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const id = useId();
  const query = useSearchParams();
  const requested = query.get("club");
  const club = points.some((point) => point.clubType === requested) ? requested : preferredClub;
  return (
    <div className="grid gap-3">
      <Button
        variant="outline"
        className="min-h-12 justify-between"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Hide shot pattern" : "Show shot pattern"}
        <ChevronDown className={open ? "rotate-180" : undefined} aria-hidden />
      </Button>
      <div id={id} hidden={!open}>
        {open ? (
          <LazyMobileShotPatternCharts key={club} points={points} preferredClub={club} />
        ) : null}
      </div>
    </div>
  );
}
