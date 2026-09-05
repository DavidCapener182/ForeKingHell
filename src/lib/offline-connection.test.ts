import { afterEach, expect, it, vi } from "vitest";
import { checkAppConnection, createOfflineConnectionCheck } from "./offline-connection";
afterEach(() => vi.useRealTimers());
it("requires the exact network marker and bypasses browser caches without sending account cookies", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("forekinghell-connection-v1\n"));
  expect(await checkAppConnection(fetcher)).toBe(true);
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringMatching(/^\/assets\/connection.txt\?t=\d+$/),
    expect.objectContaining({ cache: "no-store", credentials: "omit", redirect: "error" }),
  );
  for (const response of [
    new Response("<html>Sign in to train Wi-Fi</html>"),
    new Response("forekinghell-connection-v1", { status: 503 }),
  ]) {
    fetcher.mockResolvedValue(response);
    expect(await checkAppConnection(fetcher)).toBe(false);
  }
  fetcher.mockRejectedValue(new Error("TLS failure"));
  expect(await checkAppConnection(fetcher)).toBe(false);
});
it("bounds a stalled connection so the retry control becomes available again", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(
    (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
      }),
  );
  const result = checkAppConnection(fetcher);
  await vi.advanceTimersByTimeAsync(8000);
  expect(await result).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("ignores a late success after saved-activity navigation or a newer retry", async () => {
  const pending: ((result: boolean) => void)[] = [];
  const check = createOfflineConnectionCheck(() => new Promise((resolve) => pending.push(resolve)));
  const first = check.check();
  check.cancel();
  pending[0](true);
  expect(await first).toBeNull();
  const stale = check.check();
  const latest = check.check();
  pending[1](true);
  pending[2](false);
  expect(await stale).toBeNull();
  expect(await latest).toBe(false);
});
