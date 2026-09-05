"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type {
  CourseTwinManifest,
  CourseTwinHole,
  CourseTwinFeature,
} from "@/lib/course-twin-contract";
import type {
  CourseTwinStrategyClub,
  CourseTwinStrategyDocument,
} from "@/lib/course-twin-strategy";
import {
  mobileCourseTwinPlanOptions,
  mobilePlanHasMappedSurfaces,
  modelledHazardChance,
  projectedLandingEllipse,
  type MobilePlanIntent,
} from "@/lib/course-twin-mobile-plan";
import { overheadProjection } from "@/lib/course-twin-overhead";
import { formatClubType } from "@/lib/club-format";
import styles from "./course-twin-overhead.module.css";

const renderOrder: CourseTwinFeature["type"][] = [
  "course_boundary",
  "rough",
  "trees",
  "fairway",
  "tee",
  "green",
  "bunker",
  "water",
];
export function CourseTwinMobilePlan({
  manifest,
  hole,
}: {
  manifest: CourseTwinManifest;
  hole: CourseTwinHole;
}) {
  const [document, setDocument] = useState<CourseTwinStrategyDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [intent, setIntent] = useState<MobilePlanIntent>("normal");
  const [customClub, setCustomClub] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/api/course-twins/${encodeURIComponent(manifest.course.id)}/strategy?holeNumber=${hole.holeNumber}&evidenceBasis=latest-reliable`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const data = await response.json();
        if (
          !response.ok ||
          data.modelVersion !== "dispersion-monte-carlo-v1" ||
          data.holeNumber !== hole.holeNumber
        )
          throw new Error(data.error ?? "Strategy is unavailable for this hole.");
        if (!controller.signal.aborted) {
          setDocument(data);
          setError(null);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof TypeError
              ? "Connect to load your latest bag evidence."
              : error instanceof Error
                ? error.message
                : "Strategy is unavailable.",
          );
      });
    return () => controller.abort();
  }, [manifest.course.id, hole.holeNumber, retry]);
  const mappedSurfaces = mobilePlanHasMappedSurfaces(manifest, hole.holeNumber);
  const options = document ? mobileCourseTwinPlanOptions(document) : null;
  const selected = customClub
    ? (document?.clubs.find((club) => club.clubId === customClub) ?? null)
    : (options?.[intent] ?? null);
  const features = useMemo(
    () =>
      [...manifest.features].sort(
        (a, b) => renderOrder.indexOf(a.type) - renderOrder.indexOf(b.type),
      ),
    [manifest.features],
  );
  const project = useMemo(
    () =>
      overheadProjection(
        hole,
        [],
        [
          ...features
            .filter(
              (feature) =>
                feature.holeNumber === hole.holeNumber && feature.type !== "course_boundary",
            )
            .flatMap((feature) => feature.rings.flat()),
          ...(document?.clubs.flatMap((club) => club.landingCloud) ?? []),
        ],
      ),
    [hole, features, document],
  );
  const ellipse = selected ? projectedLandingEllipse(selected.landingCloud.map(project)) : null;
  const tee = project(hole.tee);
  const green = project(hole.green);
  return (
    <>
      <div className={styles.planMap}>
        <div className={styles.mapCaption}>
          <span>Reference tee</span>
          <span>{mappedSurfaces ? "Mapped hole" : "Estimated outline"}</span>
        </div>
        <svg
          viewBox="0 0 320 360"
          role="img"
          aria-label={`Hole ${hole.holeNumber} ${mappedSurfaces ? "mapped surfaces" : "estimated outline"}${selected ? ` and ${formatClubType(selected.clubType)} modelled landing spread` : ""}`}
        >
          {features.map((feature) => (
            <path
              key={feature.id}
              d={feature.rings
                .map((ring) => `M${ring.map((point) => project(point).join(",")).join("L")}Z`)
                .join(" ")}
              fillRule="evenodd"
              className={styles[feature.type]}
            />
          ))}
          <polyline
            points={hole.centerline.map((point) => project(point).join(",")).join(" ")}
            className={styles.centerline}
          />
          {ellipse ? (
            <>
              <path
                d={`M${tee.join(",")}L${ellipse.cx},${ellipse.cy}`}
                className={styles.plannedPath}
              />
              <ellipse
                data-modelled-dispersion
                cx={ellipse.cx}
                cy={ellipse.cy}
                rx={ellipse.rx}
                ry={ellipse.ry}
                transform={`rotate(${ellipse.angle} ${ellipse.cx} ${ellipse.cy})`}
                className={styles.dispersion}
              />
              <circle cx={ellipse.cx} cy={ellipse.cy} r="3.5" className={styles.target} />
              <path
                d={`M${ellipse.cx - 8},${ellipse.cy}h16 M${ellipse.cx},${ellipse.cy - 8}v16`}
                className={styles.targetCross}
              />
            </>
          ) : null}
          <circle cx={tee[0]} cy={tee[1]} r="6" className={styles.teeMarker} />
          <text x={tee[0]} y={tee[1] + 18} textAnchor="middle" className={styles.mapLabel}>
            TEE
          </text>
          <circle cx={green[0]} cy={green[1]} r="5" className={styles.greenMarker} />
          <path d={`M${green[0]},${green[1]}v-17l10,4l-10,4`} className={styles.flagMarker} />
        </svg>
        <p className={styles.mapLegend}>
          {mappedSurfaces ? "Mapped surfaces" : "Estimated placement"} ·{" "}
          {selected ? "modelled landing spread" : "reference geometry"}
        </p>
      </div>
      <section className={styles.planDecision} aria-label="Hole strategy">
        {!mappedSurfaces ? (
          <p className={styles.mapWarning}>
            Estimated hole outline. Hazard-based choices are unavailable until the course surfaces
            are mapped.
          </p>
        ) : null}
        {selected && document && options ? (
          <>
            <div className={styles.planHeading} aria-live="polite">
              <div>
                <p>
                  {!mappedSurfaces
                    ? "Club distance preview"
                    : customClub
                      ? "Your comparison"
                      : intent === "normal"
                        ? "Recommended"
                        : intent === "safe"
                          ? document.recommended &&
                            modelledHazardChance(selected) <
                              modelledHazardChance(document.recommended)
                            ? "Safer option"
                            : "Shorter option"
                          : "More distance"}
                </p>
                <h2>{formatClubType(selected.clubType)}</h2>
              </div>
              <div className={styles.metric}>
                <strong>{Math.round(selected.carryMedianYd)}</strong>
                <span>yd carry</span>
              </div>
            </div>
            {mappedSurfaces ? (
              <>
                <div className={styles.planOptions} role="group" aria-label="Strategy approach">
                  {(["safe", "normal", "aggressive"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={!options[value]}
                      aria-pressed={!customClub && intent === value}
                      onClick={() => {
                        setIntent(value);
                        setCustomClub(null);
                      }}
                    >
                      {value === "safe" ? "Safe" : value === "normal" ? "Normal" : "Aggressive"}
                    </button>
                  ))}
                </div>
                <p className={styles.planAim}>
                  {Math.abs(selected.aimOffsetYd) < 1
                    ? "Aim on the mapped centre line"
                    : `Aim ${Math.round(Math.abs(selected.aimOffsetYd))} yd ${selected.aimOffsetYd > 0 ? "right" : "left"} of the mapped centre line`}
                </p>
                <PlanReason club={selected} />
                <div className={styles.planNumbers}>
                  <p>
                    <strong>{Math.round(selected.averageRemainingYd)}</strong>
                    <span>yd modelled leave</span>
                  </p>
                  <p>
                    <strong>{Math.round(modelledHazardChance(selected) * 100)}%</strong>
                    <span>modelled hazard landings</span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <PlanClubPicker
                  document={document}
                  selected={selected}
                  onChange={setCustomClub}
                  label="Preview club"
                />
                <p className={styles.planReason}>
                  Your measured carry and spread, placed from the reference tee. Actual hazards and
                  tee position need checking.
                </p>
              </>
            )}
            <details className={styles.planEvidence}>
              <summary>
                {selected.sampleSize} trusted shots · view evidence
                <ChevronDown aria-hidden />
              </summary>
              {mappedSurfaces ? (
                <PlanClubPicker
                  document={document}
                  selected={selected}
                  onChange={setCustomClub}
                  label="Compare strategy club"
                />
              ) : null}
              <p>
                Latest reliable carry · same window as Bag.{" "}
                {selected.evidenceWindow?.lateralSampleSize ?? selected.sampleSize} measured side
                readings.
              </p>
              {selected.evidenceWindow?.latestShotAt ? (
                <p>
                  Latest trusted shot ·{" "}
                  {new Date(selected.evidenceWindow.latestShotAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              ) : null}
              {mappedSurfaces && !options.safe ? (
                <p>No shorter club has equal or lower modelled hazard exposure.</p>
              ) : null}
              {mappedSurfaces && !options.aggressive ? (
                <p>No longer measured club offers a shorter modelled leave.</p>
              ) : null}
              <p>
                The ellipse shows two standard deviations of simulated landings. Distribution widths
                include model minimums. This is a modelled comparison, not a safe landing guarantee.
              </p>
              <p>
                Targets use the mapped reference tee and centre line. Confirm actual tee position
                and conditions before playing.
              </p>
            </details>
          </>
        ) : (
          <div className={styles.planState} role="status">
            <h2>
              {error
                ? "Strategy unavailable"
                : document
                  ? "More shot evidence needed"
                  : "Finding your club"}
            </h2>
            <p>
              {error ??
                (document
                  ? "Add trusted full-swing carry and side readings to model this hole."
                  : "Using your latest trusted bag evidence.")}
            </p>
            {error ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setRetry((value) => value + 1);
                }}
              >
                Try again
              </button>
            ) : null}
            <Link href="/quick-bag" prefetch={false}>
              Open Quick Bag
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
function PlanReason({ club }: { club: CourseTwinStrategyClub }) {
  const fairway = Math.round(club.probabilities.fairway * 100);
  const green = Math.round(club.probabilities.green * 100);
  return (
    <p className={styles.planReason}>
      {green > fairway
        ? `${green}% of simulated landings reach the mapped green.`
        : `${fairway}% of simulated landings reach the mapped fairway.`}{" "}
    </p>
  );
}

function PlanClubPicker({
  document,
  selected,
  onChange,
  label,
}: {
  document: CourseTwinStrategyDocument;
  selected: CourseTwinStrategyClub;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <label className={styles.shotSelect}>
      {label}
      <span className={styles.selectWrap}>
        <select
          aria-label={label}
          value={selected.clubId}
          onChange={(event) => onChange(event.target.value)}
        >
          {document.clubs.map((club) => (
            <option key={club.clubId} value={club.clubId}>
              {formatClubType(club.clubType)} · {Math.round(club.carryMedianYd)} yd
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden />
      </span>
    </label>
  );
}
