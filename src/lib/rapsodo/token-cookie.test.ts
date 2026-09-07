import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredRapsodoToken, setStoredRapsodoToken } from "./token-cookie";
const state = vi.hoisted(() => ({ userId: "owner-a" as string | null, value: "" }));
vi.mock("@/lib/current-user", () => ({
  getOptionalCurrentUserId: async () => state.userId,
  requireCurrentUserId: async () => {
    if (!state.userId) throw new Error("Sign in required");
    return state.userId;
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.value ? { value: state.value } : undefined),
    set: (input: { value: string }) => {
      state.value = input.value;
    },
    delete: () => {
      state.value = "";
    },
  }),
}));
describe("provider token account binding", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    state.userId = "owner-a";
    state.value = "";
  });
  it("only returns an encrypted provider connection to its original app account", async () => {
    await setStoredRapsodoToken("synthetic-provider-token", { displayName: "Synthetic" });
    expect(state.value).not.toContain("synthetic-provider-token");
    expect((await getStoredRapsodoToken())?.token).toBe("synthetic-provider-token");
    state.userId = "owner-b";
    expect(await getStoredRapsodoToken()).toBeNull();
    state.userId = null;
    expect(await getStoredRapsodoToken()).toBeNull();
  });
  it("rejects expired and tampered connections", async () => {
    vi.useFakeTimers();
    await setStoredRapsodoToken("synthetic-provider-token", null);
    const original = state.value;
    state.value = original.slice(0, -4) + "AAAA";
    expect(await getStoredRapsodoToken()).toBeNull();
    state.value = original;
    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    expect(await getStoredRapsodoToken()).toBeNull();
  });
  it("cannot create an anonymous provider connection", async () => {
    state.userId = null;
    await expect(setStoredRapsodoToken("synthetic-provider-token", null)).rejects.toThrow(
      "Sign in required",
    );
    expect(state.value).toBe("");
  });
});
