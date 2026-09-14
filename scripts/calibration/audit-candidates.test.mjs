import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditCandidates, auditFixture, explorationWindows } from "./audit-candidates.mjs";

const window = explorationWindows[1];
const shot = { id: "r1", club: "driver", ballSpeed: 130, launch: 12, clubSpeed: 88, carry: 190 };

test("ambiguous and competing candidates remain unverified; raw inputs stay intact", () => {
  const source = [shot, { ...shot, id: "r2" }];
  const reference = [
    { ...shot, id: "t1" },
    { ...shot, id: "t2" },
  ];
  const before = JSON.stringify({ source, reference });
  const result = auditCandidates(source, reference, window);
  assert.equal(result.summary.multipleCandidates, 2);
  assert.equal(result.summary.sharedReferenceShots, 2);
  assert.deepEqual(result.acceptedPairs, []);
  assert.equal(result.calibrationEligible, false);
  assert.equal(JSON.stringify({ source, reference }), before);
});

test("missing metrics, wrong clubs and unknown clubs cannot establish candidates", () => {
  const refs = [{ ...shot, id: "t" }];
  for (const input of [
    { ...shot, launch: null },
    { ...shot, club: "5i" },
    { ...shot, ballSpeed: NaN },
  ]) {
    assert.equal(auditCandidates([input], refs, window).summary.noCandidate, 1);
  }
  assert.equal(
    auditCandidates([{ ...shot, club: "unknown" }], [{ ...shot, club: "unknown" }], window).summary
      .noCandidate,
    1,
  );
});

test("carry and spin are held out of matching; normalisation remains explicit", () => {
  const result = auditCandidates(
    [shot],
    [{ ...shot, id: "t", carry: 230, spin: 2500, normalised: true }],
    window,
  );
  assert.equal(result.summary.oneCandidate, 1);
  const candidate = result.rows[0].candidates[0];
  assert.equal(candidate.differencesSourceMinusReference.carry, -40);
  assert.equal(candidate.differencesSourceMinusReference.spin, null);
  assert.equal(candidate.referenceNormalised, true);
  assert.equal(result.calibrationEligible, false);
});

test("invalid windows and duplicate shot identities fail explicitly", () => {
  assert.throws(() => auditCandidates([shot, shot], [], window), /unique/);
  assert.throws(() => auditCandidates([], [], { ...window, launch: 0 }), /positive/);
});

test("today's incomplete overlap is a rejection fixture, not a calibration truth set", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../../tests/fixtures/calibration/2026-09-14.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    fixture.sessions.map((session) => session.shots.length),
    [54, 6, 31],
  );
  const result = auditFixture(fixture);
  const range = result.sessions[0].audits[1];
  assert.deepEqual(
    range.rows[0].candidates.map((candidate) => candidate.referenceId),
    ["driver_range_2", "driver_range_4", "driver_range_5"],
  );
  for (const session of result.sessions) {
    for (const audit of session.audits) {
      assert.equal(audit.calibrationEligible, false);
      assert.deepEqual(audit.acceptedPairs, []);
    }
  }
});
