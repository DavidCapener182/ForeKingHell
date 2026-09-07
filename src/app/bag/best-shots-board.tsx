"use client";
import { ShotEvidenceSheet } from "@/app/shots/shot-evidence-sheet";

import Link from "next/link";
import { HighlightCarousel } from "@/components/app/highlight-carousel";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, Flag, Trophy } from "lucide-react";
import type { LongestShot } from "./longest-shots-section";
import { clubSortValue, formatClubType } from "@/lib/club-format";
import { formatStoredYards, formatStoredSpeedMph, type DistanceUnitPreference } from "@/lib/units";
import styles from "./best-shots-board.module.css";

type Metric = "carry" | "total";

export function BestShotsBoard({
  carryShots,
  totalShots,
  preferredUnits,
}: {
  carryShots: LongestShot[];
  totalShots: LongestShot[];
  preferredUnits: DistanceUnitPreference;
}) {
  const params = useSearchParams();
  const metric: Metric = params.get("metric") === "total" ? "total" : "carry";
  const allClubs = [
    ...new Map([...carryShots, ...totalShots].map((shot) => [shot.clubId, shot])).values(),
  ].sort((a, b) => clubSortValue(a.clubType) - clubSortValue(b.clubType));
  const club =
    allClubs.find(
      (shot) => shot.clubId === params.get("club") || shot.clubType === params.get("club"),
    ) ?? allClubs[0];
  if (!club) return null;
  const records = metric === "carry" ? carryShots : totalShots;
  const selected = records.find((shot) => shot.clubId === club.clubId);
  const value = selected ? distance(selected, metric) : null;
  const largest = Math.max(1, ...records.map((shot) => distance(shot, metric) ?? 0));

  function select(clubId: string, nextMetric: Metric) {
    const next = new URLSearchParams(params.toString());
    next.set("club", clubId);
    next.set("metric", nextMetric);
    window.history.pushState(null, "", `?${next.toString()}`);
  }

  return (
    <section className={styles.board} aria-label="Best shots by club" data-best-shots-board>
      <div className={styles.mobileControls}>
        <label>
          Club
          <select
            aria-label="Choose club"
            value={club.clubId}
            onChange={(event) => select(event.target.value, metric)}
          >
            {allClubs.map((item) => (
              <option key={item.clubId} value={item.clubId}>
                {formatClubType(item.clubType)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Record
          <select
            aria-label="Choose distance record"
            value={metric}
            onChange={(event) => select(club.clubId, event.target.value as Metric)}
          >
            <option value="carry">Longest carry</option>
            <option value="total">Longest total</option>
          </select>
        </label>
      </div>
      <HighlightCarousel
        label="Club distance highlights"
        selectedIndex={allClubs.findIndex((item) => item.clubId === club.clubId)}
        onSelected={(index) => {
          const nextClub = allClubs[index];
          if (!nextClub || nextClub.clubId === club.clubId) return;
          const next = new URLSearchParams(params.toString());
          next.set("club", nextClub.clubId);
          next.set("metric", metric);
          window.history.replaceState(null, "", `?${next.toString()}`);
        }}
        slides={allClubs.map((item) => ({
          id: item.clubId,
          label: `${formatClubType(item.clubType)} · longest ${metric}`,
          content: (
            <BestShotHero
              club={item}
              selected={records.find((shot) => shot.clubId === item.clubId)}
              metric={metric}
              preferredUnits={preferredUnits}
              active={item.clubId === club.clubId}
            />
          ),
        }))}
      />

      <div className={styles.workspace}>
        <div className={styles.clubBoard}>
          <div className={styles.sectionHeading}>
            <h2>Every club. Your longest shots.</h2>
            <span>{allClubs.length} clubs</span>
          </div>
          <p className={styles.help}>
            Choose a distance to see the exact shot. Carry and total can come from different shots.
          </p>
          <div className={styles.columnLabels} aria-hidden>
            <span>Club</span>
            <span>Longest carry</span>
            <span>Longest total</span>
          </div>
          <div className={styles.rows}>
            {allClubs.map((item) => {
              const carry = carryShots.find((shot) => shot.clubId === item.clubId);
              const total = totalShots.find((shot) => shot.clubId === item.clubId);
              const isSelected = item.clubId === club.clubId;
              const rowRecord = metric === "carry" ? carry : total;
              const rowValue = rowRecord ? distance(rowRecord, metric) : 0;
              return (
                <div key={item.clubId} className={styles.row} data-selected={isSelected}>
                  <div className={styles.clubName}>
                    <strong>{formatClubType(item.clubType)}</strong>
                    <div className={styles.distanceTrack} aria-hidden>
                      <span style={{ width: `${((rowValue ?? 0) / largest) * 100}%` }} />
                    </div>
                  </div>
                  {(
                    [
                      ["carry", carry],
                      ["total", total],
                    ] as const
                  ).map(([kind, shot]) => (
                    <button
                      type="button"
                      key={kind}
                      onClick={() => select(item.clubId, kind)}
                      aria-label={`${formatClubType(item.clubType)} longest ${kind}: ${formatStoredYards(shot ? distance(shot, kind) : null, preferredUnits)}`}
                      aria-pressed={isSelected && metric === kind}
                      className={styles.recordButton}
                    >
                      <strong>
                        {formatStoredYards(shot ? distance(shot, kind) : null, preferredUnits)}
                      </strong>
                      <span>
                        {shot
                          ? shot.recordTrust === "trusted"
                            ? "View shot"
                            : "Raw only"
                          : "No reading"}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <aside className={styles.evidence} aria-label="Selected shot evidence">
          <p className={styles.kicker}>Behind the number</p>
          <h2>
            {formatClubType(club.clubType)} · {metric} record
          </h2>
          {selected ? (
            <>
              <p className={styles.status}>
                {selected.recordTrust === "trusted"
                  ? "Included in your distance records"
                  : "Raw maximum · review before using"}
              </p>
              <dl className={styles.facts}>
                <div>
                  <dt>Carry</dt>
                  <dd>{formatStoredYards(selected.carryYd, preferredUnits)}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{formatStoredYards(selected.totalYd, preferredUnits)}</dd>
                </div>
                <div>
                  <dt>Ball speed</dt>
                  <dd>{formatStoredSpeedMph(selected.ballSpeedMph, preferredUnits)}</dd>
                </div>
                <div>
                  <dt>Club speed</dt>
                  <dd>{formatStoredSpeedMph(selected.clubSpeedMph, preferredUnits)}</dd>
                </div>
              </dl>
              <p className={styles.help}>
                These are recorded launch-monitor values. A distance record does not confirm
                directional accuracy.
              </p>
              {selected.rawMaximumYd !== null && selected.rawMaximumYd > (value ?? 0) ? (
                <p className={styles.notice}>
                  A higher raw {metric} of{" "}
                  {formatStoredYards(selected.rawMaximumYd, preferredUnits)} is excluded from the
                  eligible record. Open the shot rows to review its source and status.
                </p>
              ) : null}
              {selected.recordTrust === "raw" ? (
                <p className={styles.notice}>
                  No eligible imported record exists for this distance. This raw maximum may be
                  excluded, manually entered, or need a quality review.
                </p>
              ) : null}
              <Link
                className={styles.evidenceAction}
                href={`/shots?club=${encodeURIComponent(selected.clubType)}&sessionId=${selected.sessionId}&shotId=${selected.id}`}
                prefetch={false}
              >
                Inspect shot {selected.shotNumber ?? "evidence"}{" "}
                <ArrowUpRight size={17} aria-hidden />
              </Link>
              <ShotEvidenceSheet
                key={selected.id}
                shotId={selected.id}
                title={`${formatClubType(selected.clubType)} ${metric} record · Shot ${selected.shotNumber ?? "—"}`}
                clubs={allClubs.map((item) => ({
                  value: item.clubId,
                  label: formatClubType(item.clubType),
                }))}
              />
              <details className={styles.source}>
                <summary>Source and record rules</summary>
                <p>{selected.sessionFileName ?? "Saved session"}</p>
                <p>{selected.brandModel}</p>
                <p>
                  All-time records for active clubs. Eligible imported shots are preferred; excluded
                  raw maxima remain labelled. Warm-ups, short-game categories and manual entries
                  cannot establish an ordinary imported record.
                </p>
              </details>
            </>
          ) : (
            <p className={styles.help}>
              This club has no recorded {metric}. The other distance remains available; it is never
              substituted for the missing value.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function BestShotHero({
  club,
  selected,
  metric,
  preferredUnits,
  active,
}: {
  club: LongestShot;
  selected: LongestShot | undefined;
  metric: Metric;
  preferredUnits: DistanceUnitPreference;
  active: boolean;
}) {
  const value = selected ? distance(selected, metric) : null;
  return (
    <div className={styles.record} data-selected-record={active ? true : undefined}>
      <div className={styles.recordTop}>
        <span>
          <Trophy size={17} aria-hidden /> All-time distance record
        </span>
        <span>
          {selected?.recordTrust === "trusted" ? "Eligible imported shot" : "Needs evidence review"}
        </span>
      </div>
      <div className={styles.recordMain}>
        <div>
          <p className={styles.club}>{formatClubType(club.clubType)}</p>
          <h2 className={styles.metricName}>Longest {metric}</h2>
          <p className={styles.distance}>{formatStoredYards(value, preferredUnits)}</p>
          <p className={styles.definition}>
            {metric === "carry"
              ? "Distance through the air, before the first bounce."
              : "Recorded distance including roll after landing."}
          </p>
        </div>
        <div className={styles.recordProof}>
          <Flag size={26} strokeWidth={1.5} aria-hidden />
          <strong>{selected ? formatDate(selected.shotAt) : "No recorded distance"}</strong>
          <span>
            {selected
              ? `Shot ${selected.shotNumber ?? "—"} · ${formatSource(selected.sessionSource)}`
              : `There is no ${metric} reading for this club yet.`}
          </span>
          {selected ? (
            <Link href={`/sessions/${selected.sessionId}`} prefetch={false}>
              Open this session <ArrowUpRight size={17} aria-hidden />
            </Link>
          ) : (
            <Link href="/import">
              Import a measured session <ArrowRight size={17} aria-hidden />
            </Link>
          )}
        </div>
      </div>
      <div className={styles.recordFooter}>
        <span>Personal bests show your peak. Use stock carry for your next club choice.</span>
        <Link href={`/bag/${club.clubId}`} prefetch={false}>
          See stock carry <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function distance(shot: LongestShot, metric: Metric) {
  return metric === "carry" ? shot.carryYd : shot.totalYd;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}
function formatSource(value: string) {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}
