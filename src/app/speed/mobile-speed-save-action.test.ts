import { beforeEach, describe, expect, it, vi } from "vitest";

const saved = vi.hoisted(() => ({
  rows: [] as {
    userId?: string;
    rawMetadataJson?: Record<string, unknown>;
    maxSpeedMph?: number;
  }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => "owner-id" }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/achievements/service", () => ({
  syncAchievementsForUser: async () => ({ unlockedAchievements: [] }),
}));
vi.mock("@/lib/achievements/notification-flash", () => ({ setAchievementUnlockFlash: vi.fn() }));
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

import { createManualSpeedSessionAction } from "./actions";
beforeEach(() => {
  saved.rows = [];
});

describe("mobile speed save receipt persistence", () => {
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
