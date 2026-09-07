import { beforeEach, expect, it, vi } from "vitest";
import { TOURNAMENT_ENTRY_TERMS_VERSION } from "@/lib/tournament-entry-terms";
const calls = vi.hoisted(() => ({ join: vi.fn(), withdraw: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: calls.redirect }));
vi.mock("@/lib/tournaments", () => ({
  joinTournament: calls.join,
  withdrawTournament: calls.withdraw,
  tournamentFormats: [],
}));
import { joinTournamentFormAction, withdrawTournamentFormAction } from "./actions";
beforeEach(() => vi.resetAllMocks());
function form() {
  const f = new FormData();
  f.set("tournamentId", "event");
  f.set("acceptEntryTerms", "accepted");
  f.set("entryTermsVersion", TOURNAMENT_ENTRY_TERMS_VERSION);
  return f;
}
it.each(["join", "withdraw"] as const)(
  "confirms %s only after service success and preserves errors",
  async (kind) => {
    const action = kind === "join" ? joinTournamentFormAction : withdrawTournamentFormAction;
    const mock = calls[kind];
    let finish!: () => void;
    mock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let done = false;
    const pending = action({ ok: false }, form()).then((result) => {
      done = true;
      return result;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    finish();
    expect(await pending).toEqual({ ok: true });
    mock.mockRejectedValueOnce(new Error("Service refused"));
    expect(await action({ ok: true }, form())).toEqual({ ok: false, error: "Service refused" });
    expect(calls.redirect).not.toHaveBeenCalled();
  },
);
it("requires current accepted terms and forwards recorded acceptance", async () => {
  const f = form();
  f.set("entryTermsVersion", "old");
  expect(await joinTournamentFormAction({ ok: false }, f)).toMatchObject({ ok: false });
  expect(calls.join).not.toHaveBeenCalled();
  f.set("entryTermsVersion", TOURNAMENT_ENTRY_TERMS_VERSION);
  expect(await joinTournamentFormAction({ ok: false }, f)).toEqual({ ok: true });
  expect(calls.join).toHaveBeenCalledWith(
    "event",
    expect.objectContaining({
      accepted: true,
      version: TOURNAMENT_ENTRY_TERMS_VERSION,
      acceptedAt: expect.any(Date),
    }),
  );
});
