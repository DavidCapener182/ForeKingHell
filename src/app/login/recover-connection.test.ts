import { describe, expect, it, vi } from "vitest";
import { recoverLoginConnection } from "./recover-connection";

const initial = { status: "idle" as const, message: null };

describe("sign-in transport recovery", () => {
  it.each(["Load failed", "Failed to fetch", "NetworkError when attempting to fetch resource."])(
    "keeps %s inside the form and allows a deliberate retry",
    async (message) => {
      const success = { status: "success" as const, message: "Check your inbox" };
      const action = vi
        .fn()
        .mockRejectedValueOnce(new TypeError(message))
        .mockResolvedValueOnce(success);
      const recover = recoverLoginConnection(action, "Check your connection");
      const form = new FormData();
      const failed = await recover(initial, form);
      expect(failed).toEqual({ status: "error", message: "Check your connection" });
      expect(action).toHaveBeenCalledTimes(1);
      expect(await recover(failed, form)).toBe(success);
      expect(action).toHaveBeenLastCalledWith(failed, form);
    },
  );

  it("preserves validation responses without classifying them as connection failures", async () => {
    const invalid = { status: "error" as const, message: "Invalid email or password." };
    expect(
      await recoverLoginConnection(async () => invalid, "Connection dropped")(
        initial,
        new FormData(),
      ),
    ).toBe(invalid);
  });

  it.each([
    Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/today;303;" }),
    new TypeError("Cannot read properties of undefined"),
    new Error("Server render failed"),
  ])("does not swallow framework control flow or application errors", async (error) => {
    const recover = recoverLoginConnection(async () => {
      throw error;
    }, "Connection dropped");
    await expect(recover(initial, new FormData())).rejects.toBe(error);
  });
});
