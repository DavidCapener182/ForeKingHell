import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/shots/actions.ts"), "utf8");

describe("reversible shot review actions", () => {
  it("does not expose the former hard-delete path", () => {
    expect(source).not.toContain("deleteShotAction");
    expect(source).not.toContain(".delete(shots)");
  });

  it("validates and locks a bounded owner-scoped batch before mutation", () => {
    expect(source).toContain("export async function reviewShotsAction");
    expect(source).toContain("parseShotReviewActionInput(input)");
    expect(source).toContain("requireCurrentUserId()");
    expect(source).toContain("inArray(shots.id, review.shotIds)");
    expect(source).toContain("eq(shots.userId, userId)");
    expect(source).toContain('.for("update")');
    expect(source).toContain("ownedShots.length !== review.shotIds.length");
  });

  it("derives legacy/import lifecycle state from all compatibility fields before mutation", () => {
    expect(source).toContain("shotCategory: shots.shotCategory");
    expect(source).toContain("effectiveShotReviewStatus({");
    expect(source).toContain("reviewStatus: shot.reviewStatus");
    expect(source).toContain("qualityTag: shot.qualityTag");
    expect(source).toContain("shotCategory: shot.shotCategory");
  });

  it("updates compatibility state and appends provenance without touching raw source", () => {
    expect(source).toContain("buildShotReviewMutation");
    expect(source).toContain("reviewPreviousQualityTag: mutation.reviewPreviousQualityTag");
    expect(source).toContain("tx.insert(shotReviewEvents)");
    expect(source).toContain("previousQualityTag: mutation.previousQualityTag");
    expect(source).toContain("resultingQualityTag: mutation.qualityTag");
    expect(source).not.toContain("sourceRawJson:");
  });

  it("provides a single-row restore and invalidates every live derived surface", () => {
    expect(source).toContain("export async function restoreShotAction");
    expect(source).toContain('status: "restored"');
    for (const path of [
      "/shots",
      "/today",
      "/dashboard",
      "/bag",
      "/progress",
      "/sessions",
      "/analyse",
      "/strokes-gained",
      "/stats/training-over-time",
      "/speed",
      "/practice",
    ]) {
      expect(source).toContain(`"${path}"`);
    }
    expect(source).toContain("revalidatePath(`/sessions/${sessionId}`)");
    expect(source).toContain('revalidatePath("/", "layout")');
  });

  it("refreshes persisted stock snapshots for every affected club inside the review transaction", () => {
    expect(source).toContain("clubId: shots.clubId");
    expect(source).toContain("playContext: shots.playContext");
    expect(source).toContain("refreshStockYardagesForClubs(tx");
    expect(source).toContain("clubContexts: ownedShots.map");
  });

  it("recomputes matched practice-day evidence after an exclusion or restore", () => {
    expect(source).toContain("refreshPracticeEvidenceForReviewedSessions");
    expect(source).toContain(
      "await refreshPracticeEvidenceForReviewedSessions(userId, reviewed.sessionIds)",
    );
    expect(source).toContain('reportServerFailure("shot_review_practice_refresh_failed"');
    expect(source).toContain("} catch (error) {");
    expect(source.indexOf("refreshPracticeEvidenceForReviewedSessions")).toBeLessThan(
      source.indexOf("revalidateShotDerivedRoutes(reviewed.sessionIds)"),
    );
  });
});
