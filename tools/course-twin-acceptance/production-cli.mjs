#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import postgres from "postgres";

import {
  check,
  evaluateDatabaseEvidence,
  evaluatePhysicalAcceptanceReport,
  evaluateProductionConfiguration,
  evaluateSignedReleaseEvidence,
  evaluateVisualCatalogue,
  productionEvidencePassed,
} from "./production-evidence.mjs";

const options = parseArguments(process.argv.slice(2));
const checks = [];
const report = {
  reportVersion: 1,
  product: "ForeKingHell Course Twin production acceptance",
  startedAt: new Date().toISOString(),
  checks,
};

checks.push(...evaluateProductionConfiguration(process.env, options));
checks.push(evaluateVisualCatalogue(await readJson(options.visualReport)));
checks.push(await verifyBuilderHealth(process.env.COURSE_TWIN_BUILDER_URL));
checks.push(await verifyPrivateStorageBucket(process.env));
checks.push(await readPhysicalEvidence(options.physicalReport));
checks.push(...(await readReleaseEvidence(options.releaseManifests, process.env)));
checks.push(...(await readDatabaseEvidence(options.gradeACourseId, process.env.DATABASE_URL)));

report.passed = productionEvidencePassed(checks);
report.completedAt = new Date().toISOString();
const outputPath = resolve(options.output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(
  `${report.passed ? "PASS" : "FAIL"}: ${outputPath}\n${checks
    .map((item) => `${item.passed ? "✓" : "✗"} ${item.name}: ${item.evidence}`)
    .join("\n")}\n`,
);
if (!report.passed) process.exitCode = 2;

async function verifyBuilderHealth(builderUrl) {
  if (!isHttpsUrl(builderUrl)) return check("hosted-builder-health", false, "not configured");
  try {
    const response = await fetch(new URL("/health", builderUrl), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const body = response.ok ? await response.json() : null;
    return check(
      "hosted-builder-health",
      response.status === 200 && body?.status === "ok",
      `HTTP ${response.status}; status=${body?.status ?? "unavailable"}`,
    );
  } catch (error) {
    return check("hosted-builder-health", false, safeError(error));
  }
}

async function verifyPrivateStorageBucket(env) {
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = env.COURSE_TWIN_STORAGE_BUCKET;
  if (!isHttpsUrl(baseUrl) || !serviceRole?.trim() || !bucket?.trim()) {
    return check("private-cdn-storage-bucket", false, "not configured");
  }
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/storage/v1/bucket/${encodeURIComponent(bucket)}`,
      {
        headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body = response.ok ? await response.json() : null;
    return check(
      "private-cdn-storage-bucket",
      response.status === 200 && body?.public === false,
      `HTTP ${response.status}; private=${body?.public === false}`,
    );
  } catch (error) {
    return check("private-cdn-storage-bucket", false, safeError(error));
  }
}

async function readPhysicalEvidence(filePath) {
  if (!filePath) return check("physical-mlm2pro-acceptance", false, "missing report");
  try {
    return evaluatePhysicalAcceptanceReport(await readJson(filePath));
  } catch (error) {
    return check("physical-mlm2pro-acceptance", false, safeError(error));
  }
}

async function readReleaseEvidence(manifestPaths, env) {
  if (manifestPaths.length === 0) {
    return evaluateSignedReleaseEvidence([], env.FKH_RELEASE_MANIFEST_PUBLIC_KEY);
  }
  const entries = [];
  for (const manifestPath of manifestPaths) {
    try {
      const absolutePath = resolve(manifestPath);
      const serialized = await readFile(absolutePath, "utf8");
      const signature = await readFile(
        resolve(dirname(absolutePath), "release-manifest.sig"),
        "utf8",
      );
      entries.push({ manifest: JSON.parse(serialized), serialized, signature: signature.trim() });
    } catch {
      // The platform-specific missing-manifest checks below remain the redacted evidence.
    }
  }
  return evaluateSignedReleaseEvidence(entries, env.FKH_RELEASE_MANIFEST_PUBLIC_KEY);
}

async function readDatabaseEvidence(courseId, databaseUrl) {
  if (!databaseUrl || !courseId) {
    return evaluateDatabaseEvidence({
      publishedVersions: 0,
      expectedHoles: 0,
      verifiedPuttingHoles: 0,
    });
  }
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });
  try {
    const [versions] = await sql`
      select count(*)::int as count
      from fkh_course_twin_versions
      where status = 'published'
    `;
    const [holes] = await sql`
      select count(distinct hole_number)::int as count
      from fkh_holes
      where course_id = ${courseId}
    `;
    const [surveys] = await sql`
      select count(distinct hole_number)::int as count
      from fkh_course_twin_putting_surveys
      where course_id = ${courseId}
        and status = 'verified'
    `;
    return evaluateDatabaseEvidence({
      publishedVersions: versions?.count ?? 0,
      expectedHoles: holes?.count ?? 0,
      verifiedPuttingHoles: surveys?.count ?? 0,
    });
  } catch (error) {
    return [
      check("published-cdn-package", false, safeError(error)),
      check("real-grade-a-putting-surveys", false, safeError(error)),
    ];
  } finally {
    await sql.end();
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(resolve(filePath), "utf8"));
}

function parseArguments(argumentsList) {
  const values = Object.fromEntries(
    argumentsList.flatMap((argument, index) =>
      argument.startsWith("--") ? [[argument.slice(2), argumentsList[index + 1]]] : [],
    ),
  );
  return {
    visualReport:
      values["visual-report"] ?? "tools/course-twin-builder/catalog/uk-first-wave-packages.json",
    physicalReport:
      values["physical-report"] ?? process.env.COURSE_TWIN_PHYSICAL_ACCEPTANCE_REPORT ?? null,
    releaseManifests: (
      values["release-manifests"] ??
      process.env.COURSE_TWIN_RELEASE_MANIFESTS ??
      ""
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    gradeACourseId:
      values["grade-a-course-id"] ?? process.env.COURSE_TWIN_GRADE_A_COURSE_ID ?? null,
    output:
      values.output ?? `dist/course-twin-acceptance/production-${new Date().toISOString()}.json`,
  };
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function safeError(error) {
  return error instanceof Error ? error.message.slice(0, 300) : "acceptance check failed";
}
