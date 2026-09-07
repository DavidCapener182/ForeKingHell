import { beforeEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({
  invite: vi.fn(),
  comment: vi.fn(),
  leave: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: calls.redirect }));
vi.mock("@/lib/challenges", () => ({
  inviteFriendToChallenge: calls.invite,
  addChallengeComment: calls.comment,
  leaveChallenge: calls.leave,
}));
vi.mock("@/lib/social", () => ({ parseVisibility: () => "public" }));
import {
  addChallengeCommentAction,
  addChallengeCommentFormAction,
  inviteFriendToChallengeFormAction,
  leaveChallengeAction,
} from "./actions";
beforeEach(() => vi.resetAllMocks());
function form() {
  const value = new FormData();
  value.set("challengeId", "challenge");
  value.set("inviteeUserId", "friend");
  value.set("body", "Comment");
  return value;
}
it("returns invitation success only after the service completes", async () => {
  let finish!: () => void;
  calls.invite.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let done = false;
  const pending = inviteFriendToChallengeFormAction({ ok: false }, form()).then((result) => {
    done = true;
    return result;
  });
  await Promise.resolve();
  expect(done).toBe(false);
  finish();
  expect(await pending).toEqual({ ok: true });
  expect(calls.redirect).not.toHaveBeenCalled();
});
it("returns server failure without a success receipt", async () => {
  calls.invite.mockRejectedValue(new Error("This challenge is no longer open to invitations."));
  expect(await inviteFriendToChallengeFormAction({ ok: false }, form())).toEqual({
    ok: false,
    error: "This challenge is no longer open to invitations.",
  });
});
it("keeps comment and leave destinations in their relevant tabs", async () => {
  await addChallengeCommentAction(form());
  expect(calls.redirect).toHaveBeenLastCalledWith("/challenges/challenge?tab=chat");
  await leaveChallengeAction(form());
  expect(calls.redirect).toHaveBeenLastCalledWith("/challenges?tab=active");
});
it("does not redirect a failed comment", async () => {
  calls.comment.mockRejectedValue(new Error("Save failed"));
  await expect(addChallengeCommentAction(form())).rejects.toThrow("Save failed");
  expect(calls.redirect).not.toHaveBeenCalled();
});

it("returns confirmed comment state without redirect and retains failure details", async () => {
  let finish!: () => void;
  calls.comment.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let done = false;
  const pending = addChallengeCommentFormAction({ ok: false }, form()).then((result) => {
    done = true;
    return result;
  });
  await Promise.resolve();
  expect(done).toBe(false);
  finish();
  expect(await pending).toEqual({ ok: true });
  expect(calls.redirect).not.toHaveBeenCalled();
  calls.comment.mockRejectedValueOnce(new Error("Save failed"));
  expect(await addChallengeCommentFormAction({ ok: false }, form())).toEqual({
    ok: false,
    error: "Save failed",
  });
});
