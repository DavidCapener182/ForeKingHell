import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(async () => "created"), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/challenges", () => ({ createChallenge: mocks.create }));
vi.mock("@/lib/social", () => ({ parseVisibility: () => "public" }));
import { createChallengeAction } from "./actions";
beforeEach(() => vi.clearAllMocks());
it.each(["not-a-date", "2026-02-30"])(
  "rejects nonempty invalid date %s before creation",
  async (date) => {
    const form = new FormData();
    form.set("templateId", "template");
    form.set("title", "Date test");
    form.set("startsAt", date);
    await expect(createChallengeAction(form)).rejects.toThrow(/date/i);
    expect(mocks.create).not.toHaveBeenCalled();
  },
);
it("preserves optional blank dates and valid dates", async () => {
  const form = new FormData();
  form.set("templateId", "template");
  form.set("title", "Date test");
  form.set("startsAt", "2026-09-10");
  form.set("endsAt", "");
  await createChallengeAction(form);
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ startsAt: new Date("2026-09-10"), endsAt: null }),
  );
});
