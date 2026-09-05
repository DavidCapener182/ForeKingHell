import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/offline-queue", () => ({
  clearOfflineActions: vi.fn().mockResolvedValue(undefined),
}));
import { purgeCompanionDataForOtherAccounts, purgePrivateClientData } from "./service-worker-cache";

describe("companion device data isolation", () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        get length() {
          return values.size;
        },
        key: (index: number) => [...values.keys()][index] ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    vi.stubGlobal("navigator", {});
  });
  afterEach(() => vi.unstubAllGlobals());
  it("keeps only the signed-in account's activities and updates the offline identity", () => {
    values.set("fkh:quick-bag:alice", "private bag");
    values.set("fkh:active-practice:alice", "private plan");
    values.set("fkh:live-round:bob:round-1", "current round");
    values.set("appearance", "dark");
    purgeCompanionDataForOtherAccounts("bob");
    expect([...values.keys()]).toEqual([
      "fkh:live-round:bob:round-1",
      "appearance",
      "fkh:offline-account",
    ]);
    expect(values.get("fkh:offline-account")).toBe("bob");
  });
  it("sign-out removes the offline identity and every private activity cache", async () => {
    for (const prefix of [
      "active-practice",
      "live-round",
      "quick-range",
      "speed-session",
      "quick-bag",
      "round-download",
      "recent-review",
    ])
      values.set(`fkh:${prefix}:alice`, "private");
    values.set("fkh:offline-account", "alice");
    values.set("appearance", "dark");
    await purgePrivateClientData();
    expect([...values.entries()]).toEqual([["appearance", "dark"]]);
  });
  it("storage refusal does not break account navigation", () => {
    window.localStorage.setItem = () => {
      throw new Error("Storage disabled");
    };
    expect(() => purgeCompanionDataForOtherAccounts("alice")).not.toThrow();
  });
});
