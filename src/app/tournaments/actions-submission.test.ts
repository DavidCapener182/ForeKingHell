import { beforeEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ submit: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: calls.redirect }));
vi.mock("@/lib/tournaments", () => ({
  submitTournamentRound: calls.submit,
  tournamentFormats: [],
}));
import { submitTournamentRoundAction, submitTournamentRoundFormAction } from "./actions";
beforeEach(() => vi.resetAllMocks());
function form() {
  const f = new FormData();
  for (const [key, value] of Object.entries({
    tournamentId: "event",
    roundNumber: "2",
    grossScore: "72",
    netScore: "68",
    stablefordPoints: "38",
    sessionId: "session",
    csvHash: "hash",
    scorecardScreenshotPath: "proof",
    extractedScorecardTotal: "72",
    scorecardProofToken: "token",
  }))
    f.set(key, value);
  return f;
}
it("preserves every submission input across redirect and state actions", async () => {
  calls.submit.mockResolvedValue("saved-id");
  await submitTournamentRoundAction(form());
  const input = calls.submit.mock.calls[0][0];
  expect(input).toEqual({
    tournamentId: "event",
    roundNumber: 2,
    grossScore: 72,
    netScore: 68,
    stablefordPoints: 38,
    sessionId: "session",
    csvHash: "hash",
    scorecardScreenshotPath: "proof",
    extractedScorecardTotal: 72,
    scorecardProofToken: "token",
  });
  expect(await submitTournamentRoundFormAction({ ok: false }, form())).toEqual({
    ok: true,
    submissionId: "saved-id",
  });
  expect(calls.submit).toHaveBeenLastCalledWith(input);
  expect(calls.redirect).toHaveBeenCalledTimes(1);
});
it("does not confirm until saved and returns errors without a stale receipt", async () => {
  let finish!: (id: string) => void;
  calls.submit.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  let done = false;
  const pending = submitTournamentRoundFormAction({ ok: false }, form()).then((result) => {
    done = true;
    return result;
  });
  await Promise.resolve();
  expect(done).toBe(false);
  finish("saved-id");
  expect(await pending).toEqual({ ok: true, submissionId: "saved-id" });
  calls.submit.mockRejectedValueOnce(new Error("Save failed"));
  expect(
    await submitTournamentRoundFormAction({ ok: true, submissionId: "old-id" }, form()),
  ).toEqual({ ok: false, error: "Save failed" });
  expect(calls.redirect).not.toHaveBeenCalled();
});
it("rejects missing event before invoking submission", async () => {
  expect(await submitTournamentRoundFormAction({ ok: false }, new FormData())).toEqual({
    ok: false,
    error: "Tournament is required.",
  });
  expect(calls.submit).not.toHaveBeenCalled();
});
