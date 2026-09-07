import { beforeEach, describe, expect, it, vi } from "vitest";
import { importRapsodoSessionAction } from "./actions";

const state = vi.hoisted(() => ({ failure: "", marked: false, refreshed: false }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidatePath: () => {
    state.refreshed = true;
    if (state.failure === "refresh") throw new Error("Refresh failed");
  },
}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => "synthetic-owner" }));
vi.mock("@/db/client", () => ({
  getDb: () => ({
    update: () => ({
      set: () => ({
        where: async () => {
          if (state.failure === "metadata") throw new Error("Metadata failed");
          state.marked = true;
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/achievements/notification-flash", () => ({
  setAchievementUnlockFlash: async () => {
    if (state.failure === "notification") throw new Error("Notification failed");
  },
}));
vi.mock("@/lib/imports/save-rapsodo-import", () => ({
  saveRapsodoImport: async () => {
    if (state.failure === "save") return { ok: false, message: "Save failed" };
    return {
      ok: true,
      sessionId: "saved-session",
      shotCount: 2,
      warnings: [],
      achievementUnlockNotifications: [],
    };
  },
}));
const input = {
  session: { providerKind: "practice", providerSessionId: "synthetic-provider-session" },
  importInput: { rawCsvText: "synthetic CSV" },
} as Parameters<typeof importRapsodoSessionAction>[0];

describe("R-Cloud saved import outcome", () => {
  beforeEach(() => {
    state.failure = "";
    state.marked = false;
    state.refreshed = false;
  });
  it.each(["notification", "metadata", "refresh"])(
    "preserves the saved receipt after %s failure",
    async (failure) => {
      state.failure = failure;
      const result = await importRapsodoSessionAction(input);
      expect(result).toMatchObject({
        ok: true,
        data: { ok: true, sessionId: "saved-session", shotCount: 2 },
      });
      expect(state.refreshed).toBe(true);
      if (failure !== "metadata") expect(state.marked).toBe(true);
      if (failure === "metadata") {
        expect(result).toMatchObject({
          data: {
            warnings: [
              "Your session is saved, but the R-Cloud list could not be updated. Open the saved session to review it.",
            ],
          },
        });
      }
    },
  );
  it("does not run post-save operations for a rejected import", async () => {
    state.failure = "save";
    expect(await importRapsodoSessionAction(input)).toMatchObject({
      ok: true,
      data: { ok: false, message: "Save failed" },
    });
    expect(state.marked).toBe(false);
    expect(state.refreshed).toBe(false);
  });
});
