import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/admin-challenge-templates", () => ({
  saveAdminChallengeTemplate: mocks.save,
  TemplateValidationError: class extends Error {},
}));
import { TemplateValidationError } from "@/lib/admin-challenge-templates";
import { saveAdminChallengeTemplateAction } from "./admin-challenge-template-actions";
beforeEach(() => vi.resetAllMocks());
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    id: "template",
    expectedUpdatedAt: "version",
    slug: "test-template",
    name: "Template",
    description: "Description",
    challengeType: "consistency",
    scoringDirection: "asc",
    active: "on",
    rulesJson: '{"minShots":5}',
  }))
    data.set(key, value);
  return data;
}
it("preserves reviewed identity, version and scoring fields", async () => {
  expect(await saveAdminChallengeTemplateAction({ ok: false }, form())).toEqual({
    ok: true,
    message: "Template updated.",
  });
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
    id: "template",
    expectedUpdatedAt: "version",
    slug: "test-template",
    name: "Template",
    description: "Description",
    challengeType: "consistency",
    scoringDirection: "asc",
    active: true,
    rulesJson: { minShots: 5 },
  });
});
it("does not save malformed rules or refresh on validation failure", async () => {
  const data = form();
  data.set("rulesJson", "{");
  expect((await saveAdminChallengeTemplateAction({ ok: false }, data)).ok).toBe(false);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("returns actionable domain errors and hides unexpected storage details", async () => {
  mocks.save.mockRejectedValue(
    new TemplateValidationError("This template has changed. Reload it before saving."),
  );
  expect(await saveAdminChallengeTemplateAction({ ok: true, message: "old" }, form())).toEqual({
    ok: false,
    error: "This template has changed. Reload it before saving.",
  });
  mocks.save.mockRejectedValue(new Error("sensitive database detail"));
  expect(await saveAdminChallengeTemplateAction({ ok: false }, form())).toEqual({
    ok: false,
    error: "The template could not be saved. Try again.",
  });
  expect(mocks.refresh).not.toHaveBeenCalled();
});
