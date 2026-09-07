import { beforeEach, expect, it, vi } from "vitest";
import {
  simulatorPracticeFingerprint,
  simulatorPracticePlan,
  parseSimulatorPracticeSource,
} from "./simulator-practice-handoff";
import { buildRangeRealityHandicapData, type RealityHandicapShot } from "./reality-handicap";
import {
  comparePlanWithShotRows,
  isObservationOnlyPracticePlan,
  type PracticePlan,
} from "./practice-planner";
const services = vi.hoisted(() => ({
  owner: vi.fn(),
  reality: vi.fn(),
  saved: vi.fn(),
  context: vi.fn(),
  generate: vi.fn(),
  save: vi.fn(),
  redirect: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: services.owner }));
vi.mock("@/lib/reality-handicap", async (original) => ({
  ...(await original<typeof import("./reality-handicap")>()),
  getRangeRealityHandicapData: services.reality,
}));
vi.mock("@/lib/practice-planner", async (original) => ({
  ...(await original<typeof import("./practice-planner")>()),
  getSavedPracticePlan: services.saved,
  getPracticePlannerContext: services.context,
  generatePracticePlan: services.generate,
  savePracticePlanForUser: services.save,
}));
vi.mock("next/navigation", () => ({ redirect: services.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: services.refresh }));
vi.mock("@/lib/server-observability", () => ({ reportServerFailure: vi.fn() }));
import { createSimulatorPracticeDraftAction } from "@/app/simulator-lab/practice-draft-action";
const creationId = "33333333-3333-4333-8333-333333333333";
const rawShots = (): RealityHandicapShot[] =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`,
    sessionId: "22222222-2222-4222-8222-222222222222",
    clubId: null,
    clubType: i < 4 ? "7i" : "driver",
    shotAt: new Date("2026-09-01"),
    sessionType: "range",
    playContext: "practice_bay",
    carryYd: 150 + i * 3,
    totalYd: 160 + i * 3,
    sideCarryYd: i * 6,
    reviewStatus: "included",
  }));
const reality = () => buildRangeRealityHandicapData(rawShots());
const base = () =>
  ({
    generation: {
      source: "rules",
      label: "Generic",
      note: null,
      model: null,
      creditsRemaining: null,
    },
    sourceContext: {},
    blocks: [],
    confidenceLabel: "Low",
    energy: "normal",
    trainingStatus: "Ready",
    createdAt: "2026-09-07",
  }) as unknown as PracticePlan;
beforeEach(() => {
  vi.resetAllMocks();
  services.owner.mockResolvedValue("owned-user");
  services.reality.mockResolvedValue(reality());
  services.saved.mockResolvedValue(null);
  services.context.mockResolvedValue({});
  services.generate.mockReturnValue(base());
  services.save.mockResolvedValue(creationId);
  services.redirect.mockImplementation(() => {
    throw new Error("REDIRECT");
  });
});
const form = () => {
  const data = new FormData();
  data.set("creationId", creationId);
  data.set("prescriptionId", "primary-club");
  data.set("fingerprint", simulatorPracticeFingerprint(reality(), "primary-club"));
  return data;
};
it("retains all three exact prescriptions, source evidence and manual/unjudged outcomes", () => {
  const data = reality();
  expect(data.prescriptions).toHaveLength(3);
  for (const [index, item] of data.prescriptions.entries()) {
    const plan = simulatorPracticePlan(base(), data, item);
    expect(isObservationOnlyPracticePlan(plan)).toBe(true);
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].drill).toBe(item.drill);
    expect(plan.totalBalls).toBe([12, 15, 9][index]);
    expect(plan.focusClubs).toEqual([item.clubType]);
    expect(parseSimulatorPracticeSource(plan.generation.simulatorHandoff)).toMatchObject({
      sampleSize: 8,
      prescriptionId: item.id,
    });
    expect(
      comparePlanWithShotRows(plan, "import", {
        shotCount: 0,
        sessionType: "range",
        dateLabel: "Today",
        clubTypes: [],
        shotRows: [],
      }).decisions[0].result,
    ).toBe("insufficient_data");
  }
});
it("saves only the owned recomputed prescription and keeps retry identity", async () => {
  await expect(createSimulatorPracticeDraftAction({ error: null }, form())).rejects.toThrow(
    "REDIRECT",
  );
  expect(services.reality).toHaveBeenCalledWith("owned-user");
  expect(services.save).toHaveBeenCalledWith(
    "owned-user",
    expect.objectContaining({ summary: reality().prescriptions[0].drill }),
    { creationId },
  );
  const saved = services.save.mock.calls[0][1];
  services.saved.mockResolvedValue({ ...saved, id: creationId });
  services.reality.mockRejectedValue(new Error("Source changed later"));
  await expect(createSimulatorPracticeDraftAction({ error: null }, form())).rejects.toThrow(
    "REDIRECT",
  );
  expect(services.save).toHaveBeenCalledTimes(1);
});
it("rejects stale or forged evidence and retains actionable errors", async () => {
  const tampered = form();
  tampered.set("fingerprint", "a".repeat(64));
  expect((await createSimulatorPracticeDraftAction({ error: null }, tampered)).error).toContain(
    "evidence has changed",
  );
  expect(services.save).not.toHaveBeenCalled();
  services.save.mockRejectedValueOnce(new Error("Synthetic uncertain receipt"));
  expect((await createSimulatorPracticeDraftAction({ error: null }, form())).error).toContain(
    "prescription is retained",
  );
  const invalid = form();
  invalid.set("prescriptionId", "injected");
  expect((await createSimulatorPracticeDraftAction({ error: null }, invalid)).error).toContain(
    "Refresh",
  );
});

it("keeps fingerprints deterministic for equal timestamps and accepts the full1000-shot model", () => {
  const forward = buildRangeRealityHandicapData(rawShots());
  const backward = buildRangeRealityHandicapData(rawShots().reverse());
  expect(simulatorPracticeFingerprint(forward, "primary-club")).toBe(
    simulatorPracticeFingerprint(backward, "primary-club"),
  );
  const high = {
    ...forward,
    estimate: { ...forward.estimate, confidence: "high" as const, confidenceLabel: "High" },
  };
  const plan = simulatorPracticePlan(
    { ...base(), confidenceLabel: "Low" },
    high,
    high.prescriptions[0],
  );
  expect(plan.confidenceLabel).toBe("High");
  const source = {
    ...plan.generation.simulatorHandoff!,
    shotIds: Array.from(
      { length: 1000 },
      (_, i) => `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`,
    ),
    sampleSize: 1000,
  };
  expect(parseSimulatorPracticeSource(source)?.sampleSize).toBe(1000);
});
