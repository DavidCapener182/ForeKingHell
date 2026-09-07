"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { useClientReady } from "@/hooks/use-client-ready";
import { ChevronDown } from "lucide-react";
import { MobileMetricStory } from "@/components/app/mobile-metric-story";
import { Button } from "@/components/ui/button";
import type { SessionStoryGroup } from "@/lib/mobile-session-review";
import type { ShotMasterDetailRow } from "@/app/shots/shots-master-detail-table";
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
      <details className="rounded-xl border p-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">
          All club summaries · {groups.length}
        </summary>
        <div className="divide-y">
          {groups.map((club) => (
            <details key={club.clubType} className="py-2">
              <summary className="min-h-11 cursor-pointer py-3 font-medium">
                {club.label} · {club.trustedCount} / {club.importedCount} trusted shots
              </summary>
              <dl className="divide-y">
                {club.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                  >
                    <dt>{metric.label}</dt>
                    <dd className="font-medium tabular-nums">
                      {metric.value} {metric.unit}
                    </dd>
                    <dd className="w-full text-xs text-muted-foreground">{metric.detail}</dd>
                  </div>
                ))}
              </dl>
              <Link
                href={`/shots?sessionId=${sessionId}&club=${encodeURIComponent(club.clubType)}`}
                className="inline-flex min-h-11 items-center text-sm text-primary underline"
              >
                Review {club.label} evidence
              </Link>
            </details>
          ))}
        </div>
      </details>
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
  details = [],
  correctionClubs = [],
}: {
  points: ShotPatternPoint[];
  preferredClub: string | null;
  initiallyOpen?: boolean;
  details?: ShotMasterDetailRow[];
  correctionClubs?: Array<{ value: string; label: string }>;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const ready = useClientReady();
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
        disabled={!ready}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Hide shot pattern" : "Show shot pattern"}
        <ChevronDown className={open ? "rotate-180" : undefined} aria-hidden />
      </Button>
      <div id={id} hidden={!open}>
        {open ? (
          <LazyMobileShotPatternCharts
            key={club}
            points={points}
            preferredClub={club}
            details={details}
            correctionClubs={correctionClubs}
          />
        ) : null}
      </div>
    </div>
  );
}
