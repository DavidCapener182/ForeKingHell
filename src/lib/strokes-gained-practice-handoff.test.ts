import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sgPracticePlan,
  sgPracticeFingerprint,
  sgPracticePrescription,
  parseSgPracticeSource,
  type SgPracticeCategory,
  type SgPracticeEvent,
} from "./strokes-gained-practice-handoff";
import {
  comparePlanWithShotRows,
  scoreCompletedPractice,
  isObservationOnlyPracticePlan,
  savedPracticePlanToPracticePlan,
  type SavedPracticePlan,
  type PracticePlan,
} from "./practice-planner";
const services = vi.hoisted(() => ({
  user: vi.fn(),
  events: vi.fn(),
  saved: vi.fn(),
  context: vi.fn(),
  generate: vi.fn(),
  save: vi.fn(),
  redirect: vi.fn(),
  refresh: vi.fn(),
  report: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: services.user }));
vi.mock("@/lib/strokes-gained-practice-data", () => ({
  getOwnedStrokesGainedPracticeEvents: services.events,
}));
vi.mock("next/navigation", () => ({ redirect: services.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: services.refresh }));
vi.mock("@/lib/server-observability", () => ({ reportServerFailure: services.report }));
vi.mock("@/lib/practice-planner", async (original) => ({
  ...(await original<typeof import("./practice-planner")>()),
  getSavedPracticePlan: services.saved,
  getPracticePlannerContext: services.context,
  generatePracticePlan: services.generate,
  savePracticePlanForUser: services.save,
}));
import { createSgPracticeDraftAction } from "@/app/strokes-gained/practice-draft-action";
const eventId = "11111111-1111-4111-8111-111111111111",
  sessionId = "22222222-2222-4222-8222-222222222222",
  creationId = "33333333-3333-4333-8333-333333333333";
const events = (category: SgPracticeCategory): SgPracticeEvent[] => [
  { id: eventId, sessionId, category, strokesGained: -0.7 },
];
const base = () =>
  ({
    generation: {
      source: "rules",
      label: "Generic",
      model: null,
      creditsRemaining: null,
      note: null,
    },
    sourceContext: {},
    blocks: [],
    confidenceLabel: "High",
    energy: "normal",
    trainingStatus: "Ready",
    createdAt: "2026-09-07",
  }) as unknown as PracticePlan;
describe("selected SG practice prescription", () => {
  for (const category of ["tee", "approach", "short_game", "putting"] as const)
    it(`preserves exact ${category} task without invented measured success`, () => {
      const p = sgPracticePrescription(category)!;
      const plan = sgPracticePlan(base(), category, events(category));
      expect(plan.blocks).toHaveLength(1);
      expect(plan.blocks[0]).toMatchObject({
        drill: p.drill,
        successTarget: p.target,
        ballCount: p.balls,
        scoringRules: { evidenceMode: "manual", metric: "sg_category_observations" },
      });
      expect(plan.focusClubs).toEqual([]);
      expect(plan.confidenceLabel).toBe("Low");
      const saved = {
        ...plan,
        timeMinutes: 15,
        focusClubs: [],
        plannedAt: "2026-09-07",
        sourcePractice: null,
      } as unknown as SavedPracticePlan;
      expect(savedPracticePlanToPracticePlan(saved).confidenceLabel).toBe("Low");
      expect(
        savedPracticePlanToPracticePlan({
          ...saved,
          generation: {
            ...saved.generation,
            prescriptionConfidence: undefined,
            sgHandoff: undefined,
          },
        }).confidenceLabel,
      ).toBe("Medium");
      expect(plan.generation.sgHandoff).toMatchObject({
        category,
        sampleSize: 1,
        pendingCount: 0,
        total: -0.7,
        eventIds: [eventId],
        sessionIds: [sessionId],
      });
      const result = comparePlanWithShotRows(plan, "import", {
        shotCount: 0,
        sessionType: "range",
        dateLabel: "Today",
        clubTypes: [],
        shotRows: [],
      });
      expect(result.decisions[0].result).toBe("insufficient_data");
      expect(isObservationOnlyPracticePlan(plan)).toBe(true);
      expect(() =>
        scoreCompletedPractice(plan, {
          completionStatus: "complete",
          actualBalls: 12,
          blockResults: [
            { blockId: "sg-category", completionStatus: "complete", passed: true, score: 100 },
          ],
        }),
      ).toThrow("no automatic measured outcome");
    });
  it("preserves pending-only evidence as unjudged and rejects mixed categories", () => {
    const pending = [{ ...events("putting")[0], strokesGained: null }];
    const plan = sgPracticePlan(base(), "putting", pending);
    expect(plan.generation.sgHandoff).toMatchObject({
      total: null,
      sampleSize: 0,
      pendingCount: 1,
    });
    expect(plan.confidenceLabel).toBe("Low");
    expect(() => sgPracticePlan(base(), "tee", pending)).toThrow();
  });
  it("validates the stored source and fingerprints exact evidence independently of row order", () => {
    const rows = [...events("tee"), { ...events("tee")[0], id: creationId, strokesGained: null }];
    const saved = sgPracticePlan(base(), "tee", rows).generation.sgHandoff!;
    expect(parseSgPracticeSource(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(parseSgPracticeSource({ ...saved, pendingCount: 100 })).toBeUndefined();
    expect(sgPracticeFingerprint("tee", rows)).toBe(
      sgPracticeFingerprint("tee", [...rows].reverse()),
    );
    expect(sgPracticeFingerprint("tee", rows)).not.toBe(
      sgPracticeFingerprint("tee", events("tee")),
    );
  });
});
describe("owned SG draft save", () => {
  const form = () => {
    const f = new FormData();
    f.set("category", "tee");
    f.set("creationId", creationId);
    f.set("eventIds", JSON.stringify([eventId]));
    f.set("fingerprint", sgPracticeFingerprint("tee", events("tee")));
    return f;
  };
  beforeEach(() => {
    vi.resetAllMocks();
    services.user.mockResolvedValue("owner");
    services.events.mockResolvedValue(events("tee"));
    services.saved.mockResolvedValue(null);
    services.context.mockResolvedValue({});
    services.generate.mockReturnValue(base());
    services.save.mockResolvedValue(creationId);
  });
  it("reads evidence under the current owner and creates only an unstarted draft", async () => {
    await createSgPracticeDraftAction({ error: null }, form());
    expect(services.events).toHaveBeenCalledWith("owner", [eventId]);
    expect(services.save).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({
        generation: expect.objectContaining({
          sgHandoff: expect.objectContaining({ category: "tee" }),
        }),
      }),
      { creationId },
    );
    expect(services.redirect).toHaveBeenCalledWith(`/practice?planId=${creationId}`);
  });
  it("rejects missing, foreign or changed evidence without saving", async () => {
    services.events.mockResolvedValue([]);
    expect((await createSgPracticeDraftAction({ error: null }, form())).error).toContain("changed");
    services.events.mockResolvedValue([{ ...events("tee")[0], strokesGained: 1 }]);
    expect((await createSgPracticeDraftAction({ error: null }, form())).error).toContain("changed");
    expect(services.save).not.toHaveBeenCalled();
  });
  it("reuses an already saved exact draft on retry", async () => {
    services.saved.mockResolvedValue({
      id: creationId,
      generation: { sgHandoff: sgPracticePlan(base(), "tee", events("tee")).generation.sgHandoff },
    });
    await createSgPracticeDraftAction({ error: null }, form());
    expect(services.events).not.toHaveBeenCalled();
    expect(services.save).not.toHaveBeenCalled();
    expect(services.redirect).toHaveBeenCalled();
  });
  it("retains entries on save error and still redirects after post-commit refresh error", async () => {
    services.save.mockRejectedValueOnce(new Error("offline"));
    expect((await createSgPracticeDraftAction({ error: null }, form())).error).toContain(
      "try again",
    );
    expect(services.redirect).not.toHaveBeenCalled();
    services.refresh.mockImplementationOnce(() => {
      throw new Error("cache");
    });
    await createSgPracticeDraftAction({ error: null }, form());
    expect(services.redirect).toHaveBeenCalledWith(`/practice?planId=${creationId}`);
  });
});
