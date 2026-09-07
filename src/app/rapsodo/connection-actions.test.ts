import { beforeEach, describe, expect, it, vi } from "vitest";
import { disconnectRapsodoAction, loginRapsodoAction } from "./actions";

const state = vi.hoisted(() => ({ connected: false, refreshFails: false, cookieFails: false }));
vi.mock("next/cache", () => ({
  revalidatePath: () => {
    if (state.refreshFails) throw new Error("Synthetic refresh failure");
  },
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("@/lib/rapsodo/cloud-client", () => ({
  RapsodoCloudClient: class {
    async login() {
      return { token: "synthetic-token", profile: null };
    }
  },
  RapsodoCloudError: class extends Error {},
}));
vi.mock("@/lib/rapsodo/token-cookie", () => ({
  setStoredRapsodoToken: async () => {
    if (state.cookieFails) throw new Error("Synthetic cookie failure");
    state.connected = true;
  },
  clearStoredRapsodoToken: async () => {
    if (state.cookieFails) throw new Error("Synthetic cookie failure");
    state.connected = false;
  },
  getStoredRapsodoToken: async () => null,
}));

describe("provider connection committed outcomes", () => {
  beforeEach(() => {
    state.connected = false;
    state.refreshFails = false;
    state.cookieFails = false;
  });
  it("reports a successful connection even when the later page refresh fails", async () => {
    state.refreshFails = true;
    const result = await loginRapsodoAction({
      email: "synthetic@example.test",
      password: "synthetic",
    });
    expect(state.connected).toBe(true);
    expect(result).toMatchObject({ ok: true, data: { connected: true } });
  });
  it("reports a successful disconnect even when the later page refresh fails", async () => {
    state.connected = true;
    state.refreshFails = true;
    const result = await disconnectRapsodoAction();
    expect(state.connected).toBe(false);
    expect(result).toMatchObject({ ok: true, data: { connected: false } });
  });
  it("does not report success when the connection itself cannot be stored or cleared", async () => {
    state.cookieFails = true;
    expect(
      await loginRapsodoAction({ email: "synthetic@example.test", password: "synthetic" }),
    ).toMatchObject({ ok: false });
    expect(state.connected).toBe(false);
    state.connected = true;
    await expect(disconnectRapsodoAction()).rejects.toThrow("Synthetic cookie failure");
    expect(state.connected).toBe(true);
  });
});
