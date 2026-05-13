import { describe, expect, it } from "vitest";

import {
  inferRapsodoImportSessionType,
  isRoundHistorySession,
} from "@/lib/round-sessions";

describe("round session classification", () => {
  it("keeps normal round-like sessions in round history", () => {
    expect(isRoundHistorySession({ type: "real_round" })).toBe(true);
    expect(isRoundHistorySession({ type: "simulated_course", providerKind: "simulation", providerSessionMode: "courses" })).toBe(true);
    expect(isRoundHistorySession({ type: "simulator" })).toBe(true);
  });

  it("excludes synced non-course Rapsodo simulation modes from round history", () => {
    expect(isRoundHistorySession({ type: "simulator", providerKind: "simulation", providerSessionMode: "range" })).toBe(false);
    expect(isRoundHistorySession({ type: "simulator", providerKind: "simulation", providerSessionMode: "target" })).toBe(false);
    expect(isRoundHistorySession({ type: "simulator", providerKind: "simulation", providerSessionMode: "ctp" })).toBe(false);
  });

  it("maps Rapsodo target and range sessions to range imports", () => {
    expect(inferRapsodoImportSessionType({ providerKind: "simulation", providerSessionMode: "courses" })).toBe("simulated_course");
    expect(inferRapsodoImportSessionType({ providerKind: "simulation", providerSessionMode: "range" })).toBe("range");
    expect(inferRapsodoImportSessionType({ providerKind: "simulation", providerSessionMode: "target" })).toBe("range");
    expect(inferRapsodoImportSessionType({ providerKind: "simulation", providerSessionMode: "ctp" })).toBe("range");
    expect(inferRapsodoImportSessionType({ providerKind: "simulation", providerSessionMode: "simulator" })).toBe("simulator");
    expect(inferRapsodoImportSessionType({ providerKind: "practice", providerSessionMode: "practice" })).toBe("range");
  });
});
