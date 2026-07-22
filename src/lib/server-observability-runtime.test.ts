import { afterEach, describe, expect, it, vi } from "vitest";

import { reportServerEvent, reportServerFailure } from "./server-observability";

describe("structured server event privacy", () => {
  afterEach(() => vi.restoreAllMocks());

  it("drops non-allow-listed attributes and bounds strings", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    reportServerEvent("unsafe event name", {
      "app.directive": "x".repeat(200),
      "private.email": "player@example.test",
    });

    expect(info).toHaveBeenCalledOnce();
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toEqual({
      event: "server.operation",
      "app.directive": "x".repeat(120),
    });
  });

  it("reports only a normalized error type, never the message", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    reportServerFailure("provider_sync_failed", new TypeError("token=private-secret"), {
      "provider.name": "rapsodo",
    });

    const event = JSON.parse(String(warn.mock.calls[0]?.[0]));
    expect(event).toEqual({
      event: "provider_sync_failed",
      errorType: "TypeError",
      "provider.name": "rapsodo",
    });
    expect(JSON.stringify(event)).not.toContain("private-secret");
  });
});
