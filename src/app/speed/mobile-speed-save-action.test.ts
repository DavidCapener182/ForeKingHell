import { beforeEach, describe, expect, it, vi } from "vitest";

const saved = vi.hoisted(() => ({
  failure: "",
  authFails: false,
  rows: [] as {
    userId?: string;
    rawMetadataJson?: Record<string, unknown>;
    maxSpeedMph?: number;
  }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUserId: async () => {
    if (saved.authFails) throw new Error("Authentication required");
    return "owner-id";
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => {
    if (saved.failure === "refresh") throw new Error("Refresh failed");
  },
}));
vi.mock("@/lib/achievements/service", () => ({
  syncAchievementsForUser: async () => ({ unlockedAchievements: [] }),
}));
vi.mock("@/lib/achievements/notification-flash", () => ({
  setAchievementUnlockFlash: () => {
    if (saved.failure === "notification") throw new Error("Notification failed");
  },
}));
vi.mock("@/db/client", () => ({
  getDb: () => ({
    transaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work({
        insert: () => ({
          values: (value: (typeof saved.rows)[number]) => {
            saved.rows.push(value);
            return { returning: async () => [{ id: "saved-speed-session" }] };
          },
        }),
      }),
  }),
}));

import { createManualSpeedSessionAction, createManualSpeedSessionWithStateAction } from "./actions";
beforeEach(() => {
  saved.rows = [];
  saved.failure = "";
  saved.authFails = false;
});

describe("mobile speed save receipt persistence", () => {
  it("rejects impossible calendar dates rather than moving the saved session into March", async () => {
    const form = new FormData();
    form.set("speedReadings", "100\n102");
    form.set("sessionDate", "2026-02-30");
    expect(await createManualSpeedSessionWithStateAction(form)).toMatchObject({ ok: false });
    expect(saved.rows).toHaveLength(0);
  });

  it("accepts a real leap day", async () => {
    const form = new FormData();
    form.set("speedReadings", "100\n102");
    form.set("sessionDate", "2024-02-29");
    expect(await createManualSpeedSessionWithStateAction(form)).toMatchObject({ ok: true });
  });
  it("returns validation errors without losing submitted fields and does not catch auth", async () => {
    const form = new FormData();
    form.set("title", "Keep my draft");
    expect(await createManualSpeedSessionWithStateAction(form)).toMatchObject({
      ok: false,
      error: "Add the swing speeds, or enter min, average, max and swing count.",
    });
    expect(form.get("title")).toBe("Keep my draft");
    expect(saved.rows).toHaveLength(0);
    saved.authFails = true;
    await expect(createManualSpeedSessionWithStateAction(form)).rejects.toThrow(
      "Authentication required",
    );
  });
  it("returns the saved session ID without navigation", async () => {
    const form = new FormData();
    form.set("speedReadings", "100\n102");
    expect(await createManualSpeedSessionWithStateAction(form)).toEqual({
      ok: true,
      sessionId: "saved-speed-session",
    });
  });
  it.each(["notification", "refresh"])(
    "preserves saved identity after %s failure",
    async (failure) => {
      saved.failure = failure;
      const form = new FormData();
      form.set("speedReadings", "100\n102");
      form.set("mobileDraftId", "8a74e8a5-3c68-4cc1-8aa9-82df31521e7f");
      form.set("mobileDraftRevision", "4");
      await expect(createManualSpeedSessionAction(form)).rejects.toThrow(
        "redirect:/speed?speed_saved=1&speed_session=saved-speed-session",
      );
      expect(saved.rows[0].rawMetadataJson).toMatchObject({ mobileSaveReceipt: { revision: 4 } });
    },
  );
  it("persists the submitted draft revision with the owned speed session before acknowledging it", async () => {
    const form = new FormData();
    form.set("speedReadings", "100\n102\n101");
    form.set("warmupReadings", "105");
    form.set("mobileDraftId", "8a74e8a5-3c68-4cc1-8aa9-82df31521e7f");
    form.set("mobileDraftRevision", "4");
    await expect(createManualSpeedSessionAction(form)).rejects.toThrow(
      "redirect:/speed?speed_saved=1&speed_session=saved-speed-session",
    );
    expect(saved.rows[0]).toMatchObject({
      userId: "owner-id",
      maxSpeedMph: 102,
      rawMetadataJson: {
        mobileSaveReceipt: { draftId: "8a74e8a5-3c68-4cc1-8aa9-82df31521e7f", revision: 4 },
      },
    });
    expect(saved.rows).toHaveLength(2);
  });
  it("preserves the existing desktop redirect and metadata when no draft identity is supplied", async () => {
    const form = new FormData();
    form.set("speedReadings", "100\n102");
    await expect(createManualSpeedSessionAction(form)).rejects.toThrow(
      "redirect:/speed?speed_saved=1",
    );
    expect(saved.rows[0].rawMetadataJson).not.toHaveProperty("mobileSaveReceipt");
  });
});
