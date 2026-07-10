import { describe, expect, it } from "vitest";

import { isSafeResolvedRemoteUrl, safeRemoteResourceUrl } from "@/lib/remote-image-response";

describe("remote resource network boundaries", () => {
  it("rejects hostnames that resolve to private addresses", async () => {
    const url = safeRemoteResourceUrl("https://course-logo.example/image.png");
    expect(url).not.toBeNull();
    await expect(
      isSafeResolvedRemoteUrl(url!, async () => [{ address: "127.0.0.1", family: 4 }] as const),
    ).resolves.toBe(false);
  });

  it("accepts a hostname only when every resolved address is public", async () => {
    const url = new URL("https://course-logo.example/image.png");
    await expect(
      isSafeResolvedRemoteUrl(url, async () => [
        { address: "203.0.113.10", family: 4 },
        { address: "2001:db8::10", family: 6 },
      ]),
    ).resolves.toBe(true);
    await expect(
      isSafeResolvedRemoteUrl(url, async () => [
        { address: "203.0.113.10", family: 4 },
        { address: "10.0.0.2", family: 4 },
      ]),
    ).resolves.toBe(false);
  });
});
