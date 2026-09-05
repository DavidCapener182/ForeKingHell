"use client";

import { useId } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { formatCompanionClubType } from "@/lib/club-format";
import {
  mobileComparisonMeasure,
  type MobilePerformanceComparison,
  type MobilePerformanceMeasure,
} from "@/lib/mobile-progress-story";
import styles from "./mobile-performance-comparison.module.css";

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function MobilePerformanceComparisonView({
  comparisons,
  initialClubId,
  initialMeasure,
}: {
  comparisons: MobilePerformanceComparison[];
  initialClubId: string;
  initialMeasure: MobilePerformanceMeasure;
}) {
  const selectId = useId();
  const query = useSearchParams();
  const clubId = query.get("compareClub") ?? initialClubId;
  const rawMeasure = query.get("compareMeasure");
  const requestedMeasure =
    rawMeasure === "carry" || rawMeasure === "side" ? rawMeasure : initialMeasure;
  const available = comparisons.filter(
    (c) => mobileComparisonMeasure(c, "carry") || mobileComparisonMeasure(c, "side"),
  );
  const selected =
    available.find((c) => c.clubId === clubId) ??
    available.find((c) => c.clubId === initialClubId) ??
    available[0];
  if (!selected) return null;
  const carry = mobileComparisonMeasure(selected, "carry");
  const side = mobileComparisonMeasure(selected, "side");
  const measure =
    requestedMeasure === "carry" ? (carry ? "carry" : "side") : side ? "side" : "carry";
  const values = measure === "carry" ? carry! : side!;
  const magnitude = Math.abs(values.delta) < 0.1 ? "<0.1" : number.format(Math.abs(values.delta));
  const change =
    values.delta === 0
      ? "Unchanged between sessions"
      : measure === "side"
        ? `${magnitude} yd ${values.delta < 0 ? "less" : "more"} average lateral miss`
        : `${magnitude} yd ${values.delta > 0 ? "longer" : "shorter"} carry`;
  const clubName = formatCompanionClubType(selected.clubType);
  function updateComparison(nextClubId: string, nextMeasure: MobilePerformanceMeasure) {
    const url = new URL(window.location.href);
    url.searchParams.set("compareClub", nextClubId);
    url.searchParams.set("compareMeasure", nextMeasure);
    const state = { ...window.history.state };
    delete state.__NA;
    delete state._N;
    window.history.replaceState(state, "", url);
  }

  return (
    <div className={styles.comparison} data-mobile-performance-comparison>
      {available.length > 1 ? (
        <div className={styles.picker}>
          <label htmlFor={selectId}>Compare club sessions</label>
          <div>
            <select
              id={selectId}
              value={selected.clubId}
              onChange={(e) => updateComparison(e.target.value, requestedMeasure)}
            >
              {available.map((club) => (
                <option key={club.clubId} value={club.clubId}>
                  {formatCompanionClubType(club.clubType)}
                  {available.some(
                    (other) => other.clubId !== club.clubId && other.clubType === club.clubType,
                  ) && club.brandModel
                    ? ` · ${club.brandModel}`
                    : ""}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden />
          </div>
        </div>
      ) : (
        <h3 className="mobile-type-headline">{clubName}</h3>
      )}
      <MobileSegmentedControl
        ariaLabel="Club comparison measure"
        value={measure}
        onValueChange={(value) =>
          updateComparison(selected.clubId, value as MobilePerformanceMeasure)
        }
        options={[
          { value: "carry", label: "Carry", disabled: !carry },
          { value: "side", label: "Control", disabled: !side },
        ]}
      />
      <div className={styles.readout} aria-live="polite" aria-atomic="true">
        <p className={styles.value}>
          {number.format(values.latest)} <span>yd</span>
        </p>
        <p className="mobile-type-subheadline">
          {measure === "carry" ? "latest median carry" : "latest average lateral miss"}
        </p>
        <p className={styles.change}>{change}</p>
      </div>
      <div className={styles.bars} role="group" aria-label={`${clubName} session comparison`}>
        {(["previous", "latest"] as const).map((period) => (
          <div className={styles.barRow} key={period}>
            <span>{period === "previous" ? "Previous" : "Latest"}</span>
            <div className={styles.track} aria-hidden>
              <div
                className={styles.bar}
                data-period={period}
                style={{ transform: `scaleX(${values[period] / values.maximum})` }}
              />
            </div>
            <strong>
              {number.format(values[period])}
              <span className="sr-only"> yards</span>
            </strong>
          </div>
        ))}
      </div>
      <p className={styles.evidence}>
        {selected.previous.shotCount} clean shots previously · {selected.latest.shotCount} latest.
        {measure === "side"
          ? " Lower is closer to the target line."
          : " More distance alone does not establish improvement."}
      </p>
      <Link className="mobile-progress-disclosure" href={`/bag/${selected.clubId}`}>
        Explore {clubName} evidence
      </Link>
    </div>
  );
}
