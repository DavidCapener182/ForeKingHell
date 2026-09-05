import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PracticeCompanionPage from "../(app)/practice/practice-companion-page";
import { MobileSavedPracticeReview } from "./mobile-saved-practice-review";
import { compactCompanionPlan } from "./practice-companion-client";
import {
  getSavedPracticePlan,
  generatePracticePlan,
  type SavedPracticePlan,
  type PracticePlan,
} from "@/lib/practice-planner";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => "owner" }));
vi.mock("./actions", () => ({ linkPracticePlanSessionAction: vi.fn() }));
vi.mock("@/lib/practice-planner", () => ({
  getSavedPracticePlan: vi.fn(),
  getPracticeImportOptions: async () => [
    {
      id: "session",
      label: "Measured range",
      dateLabel: "2026-09-05",
      sessionType: "practice",
      shotCount: 20,
    },
  ],
  getPracticePlannerContext: async () => ({ bag: { clubs: [] } }),
  getCurrentPracticePlanSummary: async () => ({ id: "old-plan", status: "awaiting_import" }),
  selectPracticePlannerInitialSavedPlan: (plans: unknown[]) => plans[0],
  savedPracticePlanToPracticePlan: vi.fn(),
  generatePracticePlan: vi.fn(() => ({ blocks: [] })),
}));

const plan = {
  id: "745445c4-d305-47f0-95a0-f0d02f77421b",
  title: "Saved practice",
  status: "match_found",
  timeMinutes: 30,
  totalBalls: 30,
  blocks: [],
  result: null,
} as unknown as SavedPracticePlan;
describe("companion practice handoffs", () => {
  beforeEach(() => vi.clearAllMocks());
  it("opens matched plans in a review surface with owned import options", async () => {
    vi.mocked(getSavedPracticePlan).mockResolvedValue(plan);
    const page = await PracticeCompanionPage({
      searchParams: Promise.resolve({ planId: plan.id }),
    });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Review measured evidence");
    expect(html).toContain("Measured range");
    expect(html).toContain("Use these measured shots");
    expect(html).not.toContain("Resume Range Mode");
    expect(html).not.toContain("Activity completed");
  });
  it("passes the requested club to generation instead of selecting another saved plan", async () => {
    await PracticeCompanionPage({
      searchParams: Promise.resolve({ club: "SW", intent: "confidence", time: "30" }),
    });
    expect(generatePracticePlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ focusClub: "sw", intent: "confidence", timeMinutes: 30 }),
    );
  });
  it("does not claim an unconfirmed match proves activity completion", () => {
    expect(renderToStaticMarkup(<MobileSavedPracticeReview plan={plan} />)).toContain(
      "possible matching import",
    );
  });
  it("keeps the main priority in a compact 20-minute plan", () => {
    const original = {
      estimatedTimeMinutes: 20,
      focusClubs: ["sw"],
      blocks: Array.from({ length: 6 }, (_, i) => ({
        id: String(i),
        title: i === 2 ? "Main priority: SW start line" : "Other block",
        clubs: [i === 2 ? "sw" : "7i"],
        ballCount: 10,
      })),
    } as unknown as PracticePlan;
    expect(compactCompanionPlan(original).blocks.map((b) => b.id)).toContain("2");
  });
});
