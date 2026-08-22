import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/rounds/actions.ts"), "utf8");

describe("round recalculation lifecycle evidence", () => {
  it("keeps every physical round shot in manual hole-count slicing", () => {
    const mapping = source.slice(
      source.indexOf("export async function resplitRoundAction"),
      source.indexOf("async function evaluateRoundAchievementsForSessionWithFlash"),
    );

    expect(mapping).toContain("const loadedSessionShots = await db");
    expect(mapping).toContain(
      "const sessionShots = physicalRoundShotsForAccounting(loadedSessionShots);",
    );
    expect(mapping.indexOf("physicalRoundShotsForAccounting(loadedSessionShots)")).toBeLessThan(
      mapping.indexOf("sessionShots.slice(cursor, cursor + count)"),
    );
  });

  it("keeps excluded course shots in hole assignments and progress because exclusion is stats-only", () => {
    const recalculation = source.slice(
      source.indexOf("async function recalculateRoundAssignments"),
      source.indexOf("function inferUnmappedShotHoles"),
    );

    expect(recalculation).toContain("const loadedSessionShots = await db");
    expect(recalculation).toContain(
      "const sessionShots = physicalRoundShotsForAccounting(loadedSessionShots);",
    );
    expect(
      recalculation.indexOf("physicalRoundShotsForAccounting(loadedSessionShots)"),
    ).toBeLessThan(recalculation.indexOf("inferUnmappedShotHoles"));
    expect(
      recalculation.indexOf("physicalRoundShotsForAccounting(loadedSessionShots)"),
    ).toBeLessThan(recalculation.indexOf("const shotsByHole"));
  });

  it("does not run the stock-evidence eligibility filter in either scorecard path", () => {
    expect(source).not.toContain("filter(isShotEvidenceEligible)");
  });
});

describe("round-only permanent shot deletion", () => {
  it("validates owner and exact session membership before deleting in one transaction", () => {
    const deletion = source.slice(
      source.indexOf("export async function deleteRoundShotAction"),
      source.indexOf("export async function updateClubAction"),
    );

    expect(deletion).toContain("await getDb().transaction(async (tx)");
    expect(deletion).toContain("eq(sessions.userId, userId)");
    expect(deletion).toContain("eq(shots.userId, userId)");
    expect(deletion).toContain("ownedShot.sessionId !== round.id");
    expect(deletion).toContain("ownedShot.courseHoleNumber === null");
    expect(deletion).toContain("Assign this shot to a scorecard hole");
    expect(deletion).toContain("isRoundCorrectionDeletionAllowed");
    expect(deletion).toContain("applyRoundShotDeletionToScorecard");
  });

  it("deletes normalized review history, recalculates the round and refreshes derived evidence", () => {
    const deletion = source.slice(
      source.indexOf("export async function deleteRoundShotAction"),
      source.indexOf("export async function updateClubAction"),
    );

    expect(deletion).toContain(".delete(shotReviewEvents)");
    expect(deletion).toContain(".delete(strokesGainedShotEvents)");
    expect(deletion).toContain("isNotNull(strokesGainedShotEvents.shotId)");
    expect(deletion).toContain(".delete(shots)");
    expect(deletion).toContain("recalculateRoundAssignments(round.id, userId, tx)");
    expect(deletion).toContain("rebuildRoundStrokesGainedEvents");
    expect(deletion).toContain("refreshStockYardagesForClubs(tx");
    expect(deletion).toContain("refreshPracticeEvidenceForReviewedSessions");
    expect(deletion).toContain("alreadyDeleted: true");
    expect(deletion.indexOf(".delete(strokesGainedShotEvents)")).toBeLessThan(
      deletion.indexOf(".delete(shots)"),
    );
    expect(deletion.indexOf("recalculateRoundAssignments(round.id, userId, tx)")).toBeLessThan(
      deletion.indexOf("rebuildRoundStrokesGainedEvents"),
    );
  });
});
