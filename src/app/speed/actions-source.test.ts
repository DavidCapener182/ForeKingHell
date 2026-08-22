import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/speed/actions.ts"), "utf8");
const transferAction = source.slice(
  source.indexOf("export async function saveSpeedTransferTestAction"),
  source.indexOf("export async function deleteSpeedSessionAction"),
);

describe("speed server actions", () => {
  it("stores warm-up separately while deriving persisted speed from the maximum-speed phase", () => {
    expect(source).toContain('formValue(formData, "warmupReadings")');
    expect(source).toContain('formValue(formData, "speedReadings")');
    expect(source).toContain("summarizePhasedReadingsForPersistence(phasedReadings)");
    expect(source).toContain("phaseCounts: speedPhaseCounts(phasedReadings)");
  });

  it("owner-checks an exact five-shot Driver transfer link on the server", () => {
    expect(transferAction).toContain("await requireCurrentUserId()");
    expect(transferAction).toContain('getAll("shotId")');
    expect(transferAction).toContain("shotIds.length !== 5");
    expect(transferAction).toContain("new Set(shotIds).size !== 5");
    expect(transferAction).toContain('speedSession.clubType !== "driver"');
    expect(transferAction).toContain("eq(speedTrainingSessions.userId, userId)");
    expect(transferAction).toContain("eq(shots.userId, userId)");
    expect(transferAction).toContain("eq(practiceSessions.userId, userId)");
    expect(transferAction).toContain("eq(shots.clubId, speedSession.clubId)");
    expect(transferAction).toContain("inArray(shots.id, shotIds)");
    expect(transferAction).toContain("lt(shots.shotAt, earliestTransferShotAt)");
    expect(transferAction).toContain("corridor: transferCorridor");
    expect(transferAction).toContain("buildSpeedTransferMetadata");
    expect(transferAction).toContain("failSpeedSession(");
  });

  it("clears an existing transfer link when an edited session changes club", () => {
    expect(source).toContain("existingSession.clubId === sessionFields.clubId");
    expect(source).toContain("withSpeedTransferMetadata(existingSession.rawMetadataJson, null)");
  });
});
