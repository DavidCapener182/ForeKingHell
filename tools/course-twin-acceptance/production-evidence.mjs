import { verifyReleaseManifest } from "../course-twin-bridge/release-manifest.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function check(name, passed, evidence) {
  return { name, passed: Boolean(passed), evidence };
}

export function evaluateProductionConfiguration(env, { gradeACourseId } = {}) {
  return [
    check(
      "builder-https-url",
      isHttpsUrl(env.COURSE_TWIN_BUILDER_URL),
      present(env.COURSE_TWIN_BUILDER_URL),
    ),
    check(
      "callback-https-url",
      isHttpsUrl(env.COURSE_TWIN_CALLBACK_BASE_URL),
      present(env.COURSE_TWIN_CALLBACK_BASE_URL),
    ),
    check(
      "worker-secret",
      typeof env.COURSE_TWIN_WORKER_SECRET === "string" &&
        env.COURSE_TWIN_WORKER_SECRET.length >= 32,
      secretEvidence(env.COURSE_TWIN_WORKER_SECRET, 32),
    ),
    check(
      "cron-secret",
      typeof env.CRON_SECRET === "string" && env.CRON_SECRET.length >= 32,
      secretEvidence(env.CRON_SECRET, 32),
    ),
    check(
      "supabase-url",
      isHttpsUrl(env.NEXT_PUBLIC_SUPABASE_URL),
      present(env.NEXT_PUBLIC_SUPABASE_URL),
    ),
    check(
      "supabase-service-role",
      Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      secretEvidence(env.SUPABASE_SERVICE_ROLE_KEY, 1),
    ),
    check(
      "storage-bucket",
      Boolean(env.COURSE_TWIN_STORAGE_BUCKET?.trim()),
      present(env.COURSE_TWIN_STORAGE_BUCKET),
    ),
    check("database-url", Boolean(env.DATABASE_URL?.trim()), secretEvidence(env.DATABASE_URL, 1)),
    check("grade-a-course-id", UUID_PATTERN.test(gradeACourseId ?? ""), present(gradeACourseId)),
  ];
}

export function evaluateVisualCatalogue(report) {
  const completed = Number(report?.completed ?? 0);
  const approved = Number(report?.visualQa?.approved ?? 0);
  const passed =
    completed >= 20 &&
    completed <= 50 &&
    report?.packageGenerationComplete === true &&
    report?.manualVisualQaComplete === true &&
    report?.visualQa?.complete === true &&
    approved === completed;
  return check(
    "first-wave-catalogue",
    passed,
    `${completed} generated; ${approved} visually approved; manual=${report?.manualVisualQaComplete === true}`,
  );
}

export function evaluatePhysicalAcceptanceReport(report) {
  const device = normalise(report?.expectedDevice);
  const privacy = report?.privacy ?? {};
  const passed =
    report?.reportVersion === 1 &&
    report?.result?.passed === true &&
    device.includes("rapsodomlm2pro") &&
    privacy.containsPairingCode === false &&
    privacy.containsSessionToken === false &&
    privacy.containsRawShotPayload === false &&
    privacy.containsShotMetrics === false;
  const acceptedShots = Number(report?.result?.counters?.acceptedShots ?? 0);
  return check(
    "physical-mlm2pro-acceptance",
    passed,
    `${report?.expectedDevice ?? "missing device"}; ${acceptedShots} accepted shot(s); passed=${report?.result?.passed === true}`,
  );
}

export function evaluateSignedReleaseEvidence(entries, publicKey) {
  const checks = [];
  for (const platform of ["darwin", "win32", "linux"]) {
    const entry = entries.find((candidate) => candidate.manifest?.platform === platform);
    let signatureValid = false;
    if (entry && publicKey) {
      try {
        signatureValid = verifyReleaseManifest(entry.serialized, entry.signature, publicKey);
      } catch {
        signatureValid = false;
      }
    }
    const trust = entry?.manifest?.trust ?? {};
    const platformTrust =
      platform === "darwin"
        ? trust.codeSignature === "developer-id" && trust.notarized === true
        : platform === "win32"
          ? trust.codeSignature === "authenticode"
          : true;
    checks.push(
      check(
        `stable-${platform}-release`,
        entry?.manifest?.channel === "stable" &&
          trust.manifestSignature === "ed25519" &&
          signatureValid &&
          platformTrust,
        entry
          ? `${entry.manifest.channel}; ${trust.codeSignature}; signed=${signatureValid}; notarized=${trust.notarized === true}`
          : "missing manifest",
      ),
    );
  }
  return checks;
}

export function evaluateDatabaseEvidence({
  publishedVersions,
  expectedHoles,
  verifiedPuttingHoles,
}) {
  return [
    check(
      "published-cdn-package",
      Number(publishedVersions) > 0,
      `${Number(publishedVersions) || 0} published immutable version(s)`,
    ),
    check(
      "real-grade-a-putting-surveys",
      Number(expectedHoles) > 0 && Number(verifiedPuttingHoles) >= Number(expectedHoles),
      `${Number(verifiedPuttingHoles) || 0}/${Number(expectedHoles) || 0} verified hole grid(s)`,
    ),
  ];
}

export function productionEvidencePassed(checks) {
  return checks.length > 0 && checks.every((item) => item.passed);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function present(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "missing";
}

function secretEvidence(value, minimumLength) {
  const length = typeof value === "string" ? value.length : 0;
  return length >= minimumLength ? `configured (${length} characters)` : "missing or too short";
}

function normalise(value) {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}
