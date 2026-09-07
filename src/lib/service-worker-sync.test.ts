import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("service worker sync dispatch", () => {
  it("requests replay from open windows without sending any queued payload itself", async () => {
    const handlers = new Map<
      string,
      (event: { tag: string; waitUntil: (work: Promise<unknown>) => void }) => void
    >();
    const messages = [vi.fn(), vi.fn()];
    const matchAll = vi.fn().mockResolvedValue(messages.map((postMessage) => ({ postMessage })));
    const fetch = vi.fn();
    runInNewContext(readFileSync("public/sw.js", "utf8"), {
      self: {
        addEventListener: (
          name: string,
          handler: typeof handlers extends Map<string, infer H> ? H : never,
        ) => handlers.set(name, handler),
        clients: { matchAll },
      },
      fetch,
    });
    const waitUntil = vi.fn();
    handlers.get("sync")!({ tag: "unrelated", waitUntil });
    expect(matchAll).not.toHaveBeenCalled();
    handlers.get("sync")!({ tag: "forekinghell-offline-sync", waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(matchAll).toHaveBeenCalledWith({ type: "window" });
    for (const message of messages)
      expect(message).toHaveBeenCalledWith({ type: "FKH_OFFLINE_SYNC_REQUESTED" });
    expect(fetch).not.toHaveBeenCalled();
    matchAll.mockResolvedValue([]);
    handlers.get("sync")!({ tag: "forekinghell-offline-sync", waitUntil });
    await waitUntil.mock.calls[1][0];
    expect(fetch).not.toHaveBeenCalled();
  });
});
