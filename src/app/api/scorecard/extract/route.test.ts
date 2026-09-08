import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const fixtures = vi.hoisted(() => ({
  user: "fixture-owner" as string | null,
  limited: false,
  generate: vi.fn(),
  sanitize: vi.fn(),
  proof: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ getOptionalCurrentUserId: async () => fixtures.user }));
vi.mock("@/lib/api-protection", async (original) => ({
  ...(await original<typeof import("@/lib/api-protection")>()),
  rateLimitRequest: () =>
    fixtures.limited ? NextResponse.json({ message: "limited" }, { status: 429 }) : null,
}));
vi.mock("@/lib/ai/client", () => ({
  generateAiJson: fixtures.generate,
  aiErrorPayload: () => ({ body: { message: "Synthetic provider unavailable" }, status: 503 }),
}));
vi.mock("@/lib/image-sanitization", () => ({ sanitizeScorecardImageDataUrl: fixtures.sanitize }));
vi.mock("@/lib/scorecard-proof-token", () => ({ createScorecardProofToken: fixtures.proof }));
import { POST } from "./route";
const imageDataUrl = "data:image/png;base64,iVBORw0KGgo=";
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/scorecard/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  fixtures.user = "fixture-owner";
  fixtures.limited = false;
  fixtures.sanitize.mockResolvedValue({ dataUrl: "data:image/png;base64,c2FmZQ==", byteLength: 4 });
  fixtures.generate.mockResolvedValue({
    output: {
      courseName: "Synthetic course",
      holes: [{ holeNumber: 1, par: 4, yards: 350, score: 5 }],
    },
    generatedAt: "2026-09-08",
    creditsCharged: 0,
    creditsRemaining: 0,
  });
  fixtures.proof.mockReturnValue("bound-protected-token");
});
describe("scorecard extraction purpose boundary", () => {
  it("accepts the canonical import request and returns normalised review data without proof", async () => {
    const response = await POST(request({ imageDataUrl, purpose: "import_review" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.scorecard.holes[0]).toMatchObject({ holeNumber: 1, yards: 350, score: 5 });
    expect(data).not.toHaveProperty("proofToken");
    expect(fixtures.proof).not.toHaveBeenCalled();
    expect(fixtures.sanitize).toHaveBeenCalledWith(imageDataUrl);
    expect(fixtures.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "fixture-owner",
        featureKey: "scorecard_extract",
        messages: [
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                type: "input_image",
                image_url: "data:image/png;base64,c2FmZQ==",
              }),
            ]),
          }),
        ],
      }),
    );
  });
  it("preserves protected proof scope and owner binding", async () => {
    const response = await POST(
      request({
        imageDataUrl,
        proofScopeType: "tournament",
        proofScopeId: "fixture-tournament",
        proofRoundNumber: 2,
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).proofToken).toBe("bound-protected-token");
    expect(fixtures.proof).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "fixture-owner",
        scopeType: "tournament",
        scopeId: "fixture-tournament",
        roundNumber: 2,
      }),
    );
  });
  it.each([
    { imageDataUrl },
    { imageDataUrl, purpose: "import_review", proofScopeType: "tournament", proofScopeId: "mixed" },
    { imageDataUrl, purpose: "invented" },
    { imageDataUrl, proofScopeType: "tournament" },
  ])("rejects missing or mixed purpose/scope before AI", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(fixtures.generate).not.toHaveBeenCalled();
  });
  it("retains authentication and rate limits", async () => {
    fixtures.user = null;
    expect((await POST(request({ imageDataUrl, purpose: "import_review" }))).status).toBe(401);
    fixtures.user = "fixture-owner";
    fixtures.limited = true;
    expect((await POST(request({ imageDataUrl, purpose: "import_review" }))).status).toBe(429);
    expect(fixtures.generate).not.toHaveBeenCalled();
  });
  it("retains unsupported and undecodable image rejection", async () => {
    expect(
      (
        await POST(
          request({ imageDataUrl: "data:image/svg+xml;base64,PHN2Zz4=", purpose: "import_review" }),
        )
      ).status,
    ).toBe(415);
    fixtures.sanitize.mockRejectedValueOnce(new Error("Synthetic decode failure"));
    expect((await POST(request({ imageDataUrl, purpose: "import_review" }))).status).toBe(415);
    expect(fixtures.generate).not.toHaveBeenCalled();
  });
  it("returns recoverable provider failure and rejects empty extraction", async () => {
    fixtures.generate.mockRejectedValueOnce(new Error("Synthetic"));
    expect((await POST(request({ imageDataUrl, purpose: "import_review" }))).status).toBe(503);
    fixtures.generate.mockResolvedValueOnce({ output: { holes: [] } });
    expect((await POST(request({ imageDataUrl, purpose: "import_review" }))).status).toBe(422);
  });
});
