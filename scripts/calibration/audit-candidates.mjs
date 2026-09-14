import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Exploration windows only. These are neither device weights nor validated
// measurement tolerances. Do not turn a candidate into an accepted pair.
export const explorationWindows = [
  { name: "narrow", ballSpeed: 2, launch: 1, clubSpeed: 2 },
  { name: "working", ballSpeed: 3, launch: 2, clubSpeed: 3 },
  { name: "wide", ballSpeed: 5, launch: 3, clubSpeed: 5 },
];

const matchingMetrics = ["ballSpeed", "launch", "clubSpeed"];
const finite = (value) => typeof value === "number" && Number.isFinite(value);

/** All compatible edges are returned: no greedy assignment or invented probability. */
export function auditCandidates(source, reference, window) {
  for (const metric of matchingMetrics) {
    if (!finite(window[metric]) || window[metric] <= 0) {
      throw new Error(`A positive exploration window is required for ${metric}`);
    }
  }
  for (const rows of [source, reference]) {
    if (new Set(rows.map((row) => row.id)).size !== rows.length) {
      throw new Error("Shot IDs must be unique within each input");
    }
  }
  const rows = source.map((shot) => ({
    sourceId: shot.id,
    club: shot.club,
    candidates: reference
      .filter(
        (other) =>
          shot.club &&
          shot.club !== "unknown" &&
          shot.club === other.club &&
          matchingMetrics.every(
            (metric) =>
              finite(shot[metric]) &&
              finite(other[metric]) &&
              Math.abs(shot[metric] - other[metric]) <= window[metric],
          ),
      )
      .map((other) => ({
        referenceId: other.id,
        referenceGroup: other.group,
        referenceNormalised: other.normalised,
        status: "unverified_candidate",
        differencesSourceMinusReference: Object.fromEntries(
          [...matchingMetrics, "carry", "spin"].map((metric) => [
            metric,
            finite(shot[metric]) && finite(other[metric])
              ? Math.round((shot[metric] - other[metric]) * 100) / 100
              : null,
          ]),
        ),
      })),
  }));
  const referenceUse = new Map();
  for (const row of rows) {
    for (const candidate of row.candidates) {
      referenceUse.set(candidate.referenceId, (referenceUse.get(candidate.referenceId) ?? 0) + 1);
    }
  }
  return {
    window,
    acceptedPairs: [],
    calibrationEligible: false,
    reason:
      "Metric similarity does not establish shot identity; timing or reviewed sequence anchors are required.",
    summary: {
      sourceShots: source.length,
      noCandidate: rows.filter((row) => row.candidates.length === 0).length,
      oneCandidate: rows.filter((row) => row.candidates.length === 1).length,
      multipleCandidates: rows.filter((row) => row.candidates.length > 1).length,
      sharedReferenceShots: [...referenceUse.values()].filter((count) => count > 1).length,
    },
    rows,
  };
}

export function auditFixture(fixture) {
  const reference = fixture.sessions.find((session) => session.source === "trackman");
  if (!reference) throw new Error("A TrackMan reference session is required");
  return {
    date: fixture.date,
    reference: reference.label,
    warning: "Candidate audit only. No device bias, match probability or correction is estimated.",
    sessions: fixture.sessions
      .filter((session) => session !== reference)
      .map((session) => ({
        label: session.label,
        audits: explorationWindows.map((window) =>
          auditCandidates(session.shots, reference.shots, window),
        ),
      })),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const report = auditFixture(fixture);
  writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      report.sessions.map((session) => ({
        label: session.label,
        windows: session.audits.map(({ window, summary }) => ({ window: window.name, ...summary })),
      })),
      null,
      2,
    ),
  );
}
