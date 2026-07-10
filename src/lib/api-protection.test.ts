import { describe, expect, it } from "vitest";

import { readBoundedJsonBody } from "@/lib/api-protection";

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

function jsonRequest(value: unknown) {
  return new Request("https://app.example/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}
