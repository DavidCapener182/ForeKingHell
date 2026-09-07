import { describe, expect, it } from "vitest";
import {
  canApplyAppUpdate,
  dismissInstallNotice,
  installNoticeDismissed,
} from "./pwa-notice-policy";

describe("PWA notice policy", () => {
  it("remembers install dismissal for seven days without affecting update eligibility", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(installNoticeDismissed(storage, 10)).toBe(false);
    dismissInstallNotice(storage, 10);
    expect(installNoticeDismissed(storage, 11)).toBe(true);
    expect(installNoticeDismissed(storage, 10 + 7 * 86400000)).toBe(false);
    expect(canApplyAppUpdate({ pathname: "/settings", queued: 0, hasDraft: false })).toBe(true);
  });
  it("fails closed for unknown queue state, drafts and active entry routes", () => {
    for (const pathname of [
      "/import",
      "/import/result",
      "/rounds/new",
      "/play/fixture",
      "/practice/quick-range",
    ]) {
      expect(canApplyAppUpdate({ pathname, queued: 0, hasDraft: false })).toBe(false);
    }
    expect(canApplyAppUpdate({ pathname: "/settings", queued: null, hasDraft: false })).toBe(false);
    expect(canApplyAppUpdate({ pathname: "/settings", queued: 2, hasDraft: false })).toBe(false);
    expect(canApplyAppUpdate({ pathname: "/settings", queued: 0, hasDraft: true })).toBe(false);
  });
});
