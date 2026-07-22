import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/api/course-twins/rounds/[roundId]/tournament/route.ts"),
  "utf8",
);

describe("Course Twin tournament submission boundary", () => {
  it("accepts only an owned completed competition ledger with no mulligans", () => {
    expect(source).toContain("getCourseTwinRound(roundId, user.id)");
    expect(source).toContain('round.status !== "complete"');
    expect(source).toContain("!round.rulesJson.competition");
    expect(source).toContain("round.rulesJson.mulligansAllowed");
    expect(source).toContain("round.summary.mulliganCount > 0");
    expect(source).toContain("submitTournamentRound");
    expect(source).toContain("finalEventHash: round.finalEventHash");
  });
});
