import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoachClubCard, CoachSummary } from "@/lib/coach";
import { buildCoachDrillChallenges } from "@/lib/coach";
import {
  coachPracticeFingerprint,
  coachPracticePlan,
  parseCoachPracticeTarget,
} from "./coach-practice-handoff";
import {
  comparePlanWithShotRows,
  type ImportedPracticeShotRow,
  type PracticePlan,
} from "./practice-planner";

const services = vi.hoisted(() => ({
  user: vi.fn(),
  progress: vi.fn(),
  saved: vi.fn(),
  context: vi.fn(),
  generate: vi.fn(),
  save: vi.fn(),
  redirect: vi.fn(),
  revalidate: vi.fn(),
  report: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: services.user }));
vi.mock("@/lib/progress-data", () => ({ getProgressData: services.progress }));
vi.mock("next/navigation", () => ({ redirect: services.redirect }));
vi.mock("@/lib/server-observability", () => ({ reportServerFailure: services.report }));
vi.mock("next/cache", () => ({ revalidatePath: services.revalidate }));
vi.mock("@/lib/practice-planner", async (original) => ({
  ...(await original<typeof import("./practice-planner")>()),
  getSavedPracticePlan: services.saved,
  getPracticePlannerContext: services.context,
  generatePracticePlan: services.generate,
  savePracticePlanForUser: services.save,
}));
import { createCoachPracticeDraftAction } from "@/app/coach/practice-draft-action";
import { calculateClubAnalytics } from "./club-analytics";
import { buildCoachSummary } from "./coach";

const clubId = "11111111-1111-4111-8111-111111111111";
const creationId = "22222222-2222-4222-8222-222222222222";
const card: CoachClubCard = {
  clubId,
  clubType: "7i",
  clubName: "7 iron",
  brandModel: "Owned club",
  issue: "launch",
  issueLabel: "Launch",
  trustIndex: 60,
  sampleSize: 12,
  stockCarryYd: 150,
  usualMiss: "Balanced",
  playableRate: 80,
  launchWindow: { low: 16, high: 24 },
  drill: "Alternate low and stock launch with the same 7 iron.",
  reason: "Measured launch is below the reference window.",
  tone: "amber",
};
const challenge = (item = card) =>
  buildCoachDrillChallenges({ clubCards: [item] } as CoachSummary)[0];
function base(): PracticePlan {
  const block = {
    id: "main",
    order: 1,
    type: "technical" as const,
    title: "Main priority: generic",
    clubs: ["7i"],
    ballCount: 17,
    timeMinutes: 12,
    purpose: "Generic",
    drill: "Generic",
    successTarget: "Generic",
    recordPrompt: "Generic",
    scoringRules: { metric: "playable", target: 12 },
  };
  return {
    title: "Range",
    sessionType: "range",
    summary: "Original",
    totalBalls: 50,
    estimatedTimeMinutes: 30,
    energy: "normal",
    intent: "latest_weakness",
    focusClubs: ["7i"],
    confidenceLabel: "Low",
    trainingStatus: "Ready",
    why: [],
    blocks: [block, { ...block, id: "transfer", type: "random", title: "Transfer", ballCount: 33 }],
    postSessionRules: [],
    sourceContext: {
      bag: { clubs: [{ clubId, clubType: "7i" }] },
      latestPractice: { sessionId: "actual-source" },
    } as PracticePlan["sourceContext"],
    generation: {
      source: "rules",
      label: "Rules",
      model: null,
      cached: false,
      creditsCharged: 0,
      creditsRemaining: null,
      note: null,
    },
    createdAt: "2026-09-07T10:00:00Z",
  };
}
function rows(patch: Partial<ImportedPracticeShotRow> = {}): ImportedPracticeShotRow[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `shot-${i}`,
    clubType: "7i",
    shotNumber: i + 1,
    shotAt: new Date("2026-09-07"),
    carryYd: 150,
    totalYd: 160,
    offlineYd: 0,
    launchDirectionDeg: 0,
    clubPathDeg: 0,
    faceAngleDeg: 0,
    ballSpeedMph: 100,
    clubSpeedMph: 75,
    qualityTag: "good",
    shotCategory: "stock",
    reviewStatus: "included",
    launchAngleDeg: 20,
    smashFactor: 1.34,
    ...patch,
  }));
}
function score(shotRows: ImportedPracticeShotRow[], item = card) {
  const plan = coachPracticePlan(base(), item, challenge(item));
  plan.blocks = [plan.blocks[0]];
  plan.totalBalls = plan.blocks[0].ballCount;
  return comparePlanWithShotRows(plan, "owned-import", {
    shotCount: shotRows.length,
    sessionType: "range",
    dateLabel: "Today",
    clubTypes: ["7i"],
    shotRows,
  }).decisions[0];
}
describe("exact Coach practice prescription", () => {
  it("retains drill, target, club, source and total ball allocation", () => {
    const original = base(),
      drill = challenge(),
      plan = coachPracticePlan(original, card, drill);
    expect(plan.blocks[0]).toMatchObject({
      clubs: ["7i"],
      drill: card.drill,
      successTarget: `${drill.target} ${drill.winCondition}`,
      ballCount: 12,
      scoringRules: { coachTarget: { winRule: drill.winRule } },
    });
    expect(plan.blocks.reduce((n, b) => n + (b.ballCount ?? 0), 0)).toBe(50);
    expect(plan.sourceContext).toBe(original.sourceContext);
    expect(plan.generation.coachHandoff?.clubId).toBe(clubId);
    expect(original.blocks[0].drill).toBe("Generic");
  });
  it("refuses a target that would make the remaining block negative", () => {
    const plan = base();
    plan.blocks[0].ballCount = 1;
    plan.blocks[1].ballCount = 1;
    expect(() => coachPracticePlan(plan, card, challenge())).toThrow("enough balls");
  });
  it("rejects a different or removed club", () => {
    expect(() => coachPracticePlan(base(), card, { ...challenge(), clubId: "foreign" })).toThrow();
    const plan = base();
    plan.sourceContext.bag.clubs = [];
    expect(() => coachPracticePlan(plan, card, challenge())).toThrow();
  });
  it("does not count playable shots as successful low-launch shots", () => {
    expect(score(rows({ launchAngleDeg: 10 })).result).toBe("failed");
    expect(score(rows({ launchAngleDeg: 20 })).result).toBe("passed");
    expect(score(rows({ launchAngleDeg: null })).result).toBe("insufficient_data");
  });
  it("reuses the selected delivery rule and requires both measured fields", () => {
    const delivery = { ...card, issue: "delivery" as const };
    expect(score(rows({ clubPathDeg: 8 }), delivery).result).toBe("failed");
    expect(score(rows({ clubPathDeg: null }), delivery).result).toBe("insufficient_data");
    expect(score(rows(), delivery).result).toBe("passed");
  });
  it("scores measured strike and ordered carry sets without substitute metrics", () => {
    const strike = { ...card, issue: "strike" as const };
    expect(score(rows({ smashFactor: 1.2 }), strike).result).toBe("failed");
    expect(score(rows({ smashFactor: null }), strike).result).toBe("insufficient_data");
    expect(score(rows(), strike).result).toBe("passed");
    const distance = { ...card, issue: "distance" as const };
    expect(score(rows(), distance).result).toBe("passed");
    expect(
      score(
        rows().map((row, index) => ({ ...row, carryYd: index % 2 ? 170 : 140 })),
        distance,
      ).result,
    ).toBe("failed");
    expect(score(rows({ carryYd: null }), distance).result).toBe("insufficient_data");
  });
  it("excludes foreign club rows and excluded evidence", () => {
    expect(score(rows({ clubType: "driver" })).result).toBe("insufficient_data");
    expect(score(rows({ reviewStatus: "user_excluded" })).result).toBe("insufficient_data");
  });
  it("validates persisted rules and fingerprints targets", () => {
    const target = { clubType: "7i", completionTarget: 12, winRule: challenge().winRule };
    expect(parseCoachPracticeTarget(JSON.parse(JSON.stringify(target)))).toEqual(target);
    expect(
      parseCoachPracticeTarget({
        ...target,
        winRule: { kind: "launch-window", target: 8, low: NaN, high: 24 },
      }),
    ).toBeUndefined();
    expect(coachPracticeFingerprint(card, challenge())).not.toBe(
      coachPracticeFingerprint(card, { ...challenge(), target: "Different goal" }),
    );
  });
});

describe("owned Coach draft action", () => {
  let derived: CoachClubCard;
  const form = () => {
    const f = new FormData();
    f.set("clubId", clubId);
    f.set("creationId", creationId);
    f.set("fingerprint", coachPracticeFingerprint(derived, challenge(derived)));
    return f;
  };
  beforeEach(() => {
    vi.clearAllMocks();
    services.user.mockResolvedValue("owner");
    services.saved.mockResolvedValue(null);
    services.context.mockResolvedValue(base().sourceContext);
    services.generate.mockReturnValue(base());
    services.save.mockResolvedValue(creationId);
    const analytics = calculateClubAnalytics({ clubType: "7i", shots: [] });
    const clubs = [{ clubId, clubType: "7i", brandModel: "Owned", analytics }];
    derived = buildCoachSummary(clubs).clubCards[0];
    services.progress.mockResolvedValue({ clubs });
  });
  it("resolves current owner and saves a draft before opening its exact ID", async () => {
    await createCoachPracticeDraftAction({ error: null }, form());
    expect(services.progress).toHaveBeenCalledWith("owner");
    expect(services.save).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({
        generation: expect.objectContaining({ coachHandoff: expect.objectContaining({ clubId }) }),
      }),
      { creationId },
    );
    expect(services.redirect).toHaveBeenCalledWith(`/practice?planId=${creationId}`);
  });
  it("still opens a saved draft when post-commit refresh fails", async () => {
    services.revalidate.mockImplementationOnce(() => {
      throw new Error("cache unavailable");
    });
    await createCoachPracticeDraftAction({ error: null }, form());
    expect(services.save).toHaveBeenCalledTimes(1);
    expect(services.report).toHaveBeenCalledWith(
      "coach_practice_refresh_after_commit_failed",
      expect.any(Error),
    );
    expect(services.redirect).toHaveBeenCalledWith(`/practice?planId=${creationId}`);
  });
  it("rejects tampered or stale prescriptions without saving", async () => {
    const f = form();
    f.set("fingerprint", "0".repeat(64));
    expect((await createCoachPracticeDraftAction({ error: null }, f)).error).toContain("changed");
    expect(services.save).not.toHaveBeenCalled();
  });
  it("does not reuse another owner's club", async () => {
    services.progress.mockResolvedValue({ clubs: [] });
    expect((await createCoachPracticeDraftAction({ error: null }, form())).error).toContain(
      "changed",
    );
    expect(services.save).not.toHaveBeenCalled();
  });
  it("retries an already saved matching draft without creating a duplicate", async () => {
    services.saved.mockResolvedValue({
      id: creationId,
      generation: {
        coachHandoff: {
          clubId,
          fingerprint: coachPracticeFingerprint(derived, challenge(derived)),
        },
      },
    });
    await createCoachPracticeDraftAction({ error: null }, form());
    expect(services.save).not.toHaveBeenCalled();
    expect(services.redirect).toHaveBeenCalledWith(`/practice?planId=${creationId}`);
  });
  it("keeps failures recoverable without claiming a saved plan", async () => {
    services.save.mockRejectedValueOnce(new Error("offline"));
    expect((await createCoachPracticeDraftAction({ error: null }, form())).error).toContain(
      "try again",
    );
    expect(services.redirect).not.toHaveBeenCalled();
  });
});
