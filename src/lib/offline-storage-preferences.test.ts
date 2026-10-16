import { afterEach, describe, expect, it, vi } from "vitest";
import { offlineImportRetentionDays } from "./offline-storage-preferences";

afterEach(() => vi.unstubAllGlobals());

function preferences(values: Record<string, string>) {
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values[key] ?? null } });
}

describe("offline import retention preference migration", () => {
  it("keeps an existing explicit legacy opt-in when no retention value is stored", () => {
    preferences({ "forekinghell:offline-import-storage-enabled": "1" });
    expect(offlineImportRetentionDays()).toBe(7);
  });
  it("keeps storage disabled without an opt-in", () => {
    preferences({});
    expect(offlineImportRetentionDays()).toBe(0);
  });
  it("honours explicit zero retention even when a legacy opt-in remains", () => {
    preferences({
      "forekinghell:offline-import-retention-days": "0",
      "forekinghell:offline-import-storage-enabled": "1",
    });
    expect(offlineImportRetentionDays()).toBe(0);
  });
  it("preserves a supported configured retention period", () => {
    preferences({ "forekinghell:offline-import-retention-days": "3" });
    expect(offlineImportRetentionDays()).toBe(3);
  });
});
