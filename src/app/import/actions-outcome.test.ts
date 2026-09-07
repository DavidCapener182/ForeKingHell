import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveRapsodoImportAction, saveRapsodoImportBatchAction } from "./actions";
const state = vi.hoisted(() => ({ saveFails: false }));
vi.mock("@/lib/imports/save-rapsodo-import", () => ({
  saveRapsodoImport: async () =>
    state.saveFails
      ? { ok: false, message: "Save rejected" }
      : { ok: true, sessionId: "saved-session", achievementUnlockNotifications: [] },
  saveRapsodoImportBatch: async () =>
    state.saveFails
      ? { ok: false, message: "Save rejected" }
      : { ok: true, savedSessionId: "saved-session", achievementUnlockNotifications: [] },
}));
vi.mock("@/lib/achievements/notification-flash", () => ({
  setAchievementUnlockFlash: async () => {
    throw new Error("Notification unavailable");
  },
}));
describe("import action saved outcomes", () => {
  beforeEach(() => {
    state.saveFails = false;
  });
  it.each(["single", "batch"])(
    "preserves %s saved receipt when notifications fail",
    async (kind) => {
      const result =
        kind === "single"
          ? await saveRapsodoImportAction({} as Parameters<typeof saveRapsodoImportAction>[0])
          : await saveRapsodoImportBatchAction([]);
      expect(result).toMatchObject(
        kind === "single"
          ? { ok: true, sessionId: "saved-session" }
          : { ok: true, savedSessionId: "saved-session" },
      );
    },
  );
  it("preserves actual save rejection", async () => {
    state.saveFails = true;
    expect(await saveRapsodoImportBatchAction([])).toEqual({ ok: false, message: "Save rejected" });
  });
});
