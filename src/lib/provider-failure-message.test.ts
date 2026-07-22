import { describe, expect, it } from "vitest";

import { safeProviderFailureMessage } from "./provider-failure-message";

describe("safeProviderFailureMessage", () => {
  it("maps infrastructure and provider failures to bounded golfer-safe messages", () => {
    expect(safeProviderFailureMessage("ECONNRESET database.internal:5432 secret=abc")).toBe(
      "Provider unavailable — retry shortly.",
    );
    expect(safeProviderFailureMessage("401 unauthorized token=private")).toBe(
      "Connection expired — reconnect this provider.",
    );
    expect(safeProviderFailureMessage("CSV parse failed at raw cell value=private")).toBe(
      "File format needs review before it can import.",
    );
  });

  it("never returns an unknown raw error message", () => {
    const raw = "Postgres exception for user@example.com";
    const result = safeProviderFailureMessage(raw);

    expect(result).toBe("Import failed — retry or reconnect this provider.");
    expect(result).not.toContain(raw);
  });

  it("keeps empty job failures empty", () => {
    expect(safeProviderFailureMessage(null)).toBeNull();
    expect(safeProviderFailureMessage(undefined)).toBeNull();
  });
});
