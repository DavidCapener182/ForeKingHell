import { beforeEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ create: vi.fn(async () => "created"), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: calls.redirect }));
vi.mock("@/lib/tournaments", () => ({
  createTournament: calls.create,
  tournamentFormats: ["two_round_open", "four_round_major"],
}));
import { createTournamentAction } from "./actions";
beforeEach(() => vi.clearAllMocks());
it.each(["invalid", "2026-02-30"])(
  "rejects invalid calendar input %s before saving",
  async (date) => {
    const form = new FormData();
    form.set("startsAt", date);
    await expect(createTournamentAction(form)).rejects.toThrow(/valid date/);
    expect(calls.create).not.toHaveBeenCalled();
  },
);
it("preserves noon UTC for valid dates and defaults blank dates", async () => {
  const form = new FormData();
  form.set("startsAt", "2026-09-10");
  await createTournamentAction(form);
  expect(calls.create).toHaveBeenCalledWith(
    expect.objectContaining({ startsAt: new Date("2026-09-10T12:00:00.000Z"), endsAt: null }),
  );
});
