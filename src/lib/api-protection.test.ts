import { describe, expect, it } from "vitest";

import { isSupportedImageDataUrl, readBoundedJsonBody } from "@/lib/api-protection";

describe("readBoundedJsonBody", () => {
  it("parses JSON below the actual byte limit", async () => {
    const result = await readBoundedJsonBody(jsonRequest({ message: "hello" }), 64);
    expect(result).toEqual({ ok: true, value: { message: "hello" } });
  });

  it("rejects an oversized body without relying on Content-Length", async () => {
    const request = jsonRequest({ message: "x".repeat(200) });
    expect(request.headers.has("content-length")).toBe(false);

    const result = await readBoundedJsonBody(request, 32);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("returns null for malformed JSON", async () => {
    const request = new Request("https://app.example/api", { method: "POST", body: "{" });
    await expect(readBoundedJsonBody(request, 16)).resolves.toEqual({ ok: true, value: null });
  });
});

describe("isSupportedImageDataUrl", () => {
  it.each([
    ["jpeg", [0xff, 0xd8, 0xff, 0x00]],
    ["png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["webp", [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]],
  ])("accepts base64 %s images with matching magic bytes", (type, bytes) => {
    const encoded = Buffer.from(bytes as number[]).toString("base64");
    expect(isSupportedImageDataUrl(`data:image/${type};base64,${encoded}`)).toBe(true);
  });

  it.each([
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "data:image/jpeg,not-base64",
    "data:image/png;base64,aGVsbG8=",
    "data:text/html;base64,PGgxPm5vPC9oMT4=",
    "data:image/png;base64,",
  ])("rejects unsupported or malformed image data %s", (dataUrl) => {
    expect(isSupportedImageDataUrl(dataUrl)).toBe(false);
  });
});

function jsonRequest(value: unknown) {
  return new Request("https://app.example/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}
