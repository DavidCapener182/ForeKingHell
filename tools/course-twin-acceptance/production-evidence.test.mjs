import { generateKeyPairSync, sign } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateDatabaseEvidence,
  evaluatePhysicalAcceptanceReport,
  evaluateProductionConfiguration,
  evaluateSignedReleaseEvidence,
  evaluateVisualCatalogue,
  productionEvidencePassed,
} from "./production-evidence.mjs";

test("production configuration reports secrets without exposing their values", () => {
  const checks = evaluateProductionConfiguration(
    {
      COURSE_TWIN_BUILDER_URL: "https://builder.example.com",
      COURSE_TWIN_CALLBACK_BASE_URL: "https://app.example.com",
      COURSE_TWIN_WORKER_SECRET: "w".repeat(32),
      CRON_SECRET: "c".repeat(32),
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
      COURSE_TWIN_STORAGE_BUCKET: "course-twins",
      DATABASE_URL: "postgres://redacted",
    },
    { gradeACourseId: "00000000-0000-4000-8000-000000000001" },
  );

  assert.equal(productionEvidencePassed(checks), true);
  assert.equal(JSON.stringify(checks).includes("service-role-value"), false);
  assert.equal(JSON.stringify(checks).includes("postgres://redacted"), false);
});

test("production evidence requires complete catalogue, physical device and real database state", () => {
  const checks = [
    evaluateVisualCatalogue({
      completed: 21,
      packageGenerationComplete: true,
      manualVisualQaComplete: true,
      visualQa: { complete: true, approved: 21 },
    }),
    evaluatePhysicalAcceptanceReport({
      reportVersion: 1,
      expectedDevice: "Rapsodo MLM2PRO",
      result: { passed: true, counters: { acceptedShots: 5 } },
      privacy: {
        containsPairingCode: false,
        containsSessionToken: false,
        containsRawShotPayload: false,
        containsShotMetrics: false,
      },
    }),
    ...evaluateDatabaseEvidence({
      publishedVersions: 21,
      expectedHoles: 18,
      verifiedPuttingHoles: 18,
    }),
  ];

  assert.equal(productionEvidencePassed(checks), true);
  assert.equal(
    evaluatePhysicalAcceptanceReport({ expectedDevice: "Rapsodo MLM2PRO", result: {} }).passed,
    false,
  );
  assert.equal(
    productionEvidencePassed(
      evaluateDatabaseEvidence({
        publishedVersions: 0,
        expectedHoles: 18,
        verifiedPuttingHoles: 0,
      }),
    ),
    false,
  );
});

test("stable release evidence requires Ed25519 manifests and platform trust", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const entries = [
    ["darwin", "developer-id", true],
    ["win32", "authenticode", false],
    ["linux", "unsigned", false],
  ].map(([platform, codeSignature, notarized]) => {
    const manifest = {
      channel: "stable",
      platform,
      trust: { manifestSignature: "ed25519", codeSignature, notarized },
    };
    const serialized = `${JSON.stringify(manifest)}\n`;
    return {
      manifest,
      serialized,
      signature: sign(null, Buffer.from(serialized), privateKey).toString("base64"),
    };
  });

  const checks = evaluateSignedReleaseEvidence(
    entries,
    publicKey.export({ type: "spki", format: "pem" }),
  );
  assert.equal(productionEvidencePassed(checks), true);

  entries[0].manifest.trust.notarized = false;
  assert.equal(productionEvidencePassed(evaluateSignedReleaseEvidence(entries, publicKey)), false);
});
