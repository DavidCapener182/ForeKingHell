import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  parseCourseTwinWorkerCompletion,
  signCourseTwinWorkerPayload,
  verifyCourseTwinWorkerSignature,
} from "@/lib/course-twin-worker-protocol";

const secret = "course-twin-worker-secret-at-least-32-characters";

describe("Course Twin worker protocol", () => {
  it("authenticates exact request bytes within a five-minute replay window", () => {
    const body = '{"buildId":"build-1"}';
    const timestamp = "1000000";
    const signature = signCourseTwinWorkerPayload(body, timestamp, secret);
    expect(
      verifyCourseTwinWorkerSignature({ body, timestamp, signature, secret, now: 1_000_100 }),
    ).toBe(true);
    expect(
      verifyCourseTwinWorkerSignature({
        body: `${body} `,
        timestamp,
        signature,
        secret,
        now: 1_000_100,
      }),
    ).toBe(false);
    expect(
      verifyCourseTwinWorkerSignature({ body, timestamp, signature, secret, now: 1_400_001 }),
    ).toBe(false);
  });

  it("parses bounded failures and rejects incomplete successful manifests", () => {
    expect(
      parseCourseTwinWorkerCompletion({
        status: "failed",
        errorCode: "dem_unavailable",
        errorMessage: "No national coverage.",
      }),
    ).toEqual({
      status: "failed",
      errorCode: "dem_unavailable",
      errorMessage: "No national coverage.",
    });
    expect(() => parseCourseTwinWorkerCompletion({ status: "completed", manifest: {} })).toThrow(
      /incomplete/,
    );
  });

  it("accepts bounded integrity-labelled assets and rejects duplicate names", () => {
    const bytes = Buffer.from("terrain");
    const asset = {
      fileName: "terrain.f32",
      contentType: "application/octet-stream",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      dataBase64: bytes.toString("base64"),
    };
    const manifest = {
      schemaVersion: 1,
      course: { id: "course-1" },
      holes: [],
      features: [],
      quality: {},
      attribution: [],
    };
    expect(
      parseCourseTwinWorkerCompletion({ status: "completed", manifest, assets: [asset] }),
    ).toMatchObject({ status: "completed", assets: [asset] });
    expect(() =>
      parseCourseTwinWorkerCompletion({
        status: "completed",
        manifest,
        assets: [asset, asset],
      }),
    ).toThrow(/unique/);
  });
});
