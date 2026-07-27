import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";
import { createHash } from "node:crypto";

import { courseTwinBuilds, courseTwins, courseTwinVersions } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  COURSE_TWIN_RUNTIME_VERSION,
  COURSE_TWIN_SCHEMA_VERSION,
  type CourseTwinManifest,
} from "@/lib/course-twin-contract";
import type { CourseTwinWorkerAsset } from "@/lib/course-twin-worker-protocol";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

const DEFAULT_BUCKET = "course-twins";
const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;
const SIGNED_ASSET_TTL_SECONDS = 60 * 60;
const ASSET_REFERENCE_PREFIX = "asset://";
const STORAGE_REFERENCE_PREFIX = "storage://";
let bucketReady: Promise<void> | null = null;

export async function loadActiveCourseTwinManifest(courseId: string) {
  const [active] = await getDb()
    .select({
      manifestPath: courseTwinVersions.manifestPath,
      manifestSha256: courseTwinVersions.manifestSha256,
    })
    .from(courseTwins)
    .innerJoin(
      courseTwinVersions,
      and(
        eq(courseTwinVersions.id, courseTwins.activeVersionId),
        eq(courseTwinVersions.courseTwinId, courseTwins.id),
      ),
    )
    .where(
      and(
        eq(courseTwins.courseId, courseId),
        eq(courseTwins.status, "published"),
        eq(courseTwinVersions.status, "published"),
      ),
    )
    .limit(1);
  if (!active) return null;

  const { data, error } = await getSupabaseServiceRoleClient()
    .storage.from(storageBucket())
    .download(active.manifestPath);
  if (error || !data) throw new Error("Published Course Twin manifest could not be downloaded.");
  if (data.size > MAX_MANIFEST_BYTES)
    throw new Error("Published Course Twin manifest is too large.");
  const bytes = Buffer.from(await data.arrayBuffer());
  const manifest = verifyCourseTwinManifest(bytes, active.manifestSha256, courseId);
  return resolveCourseTwinAssetReferences(manifest, async (path) => {
    const { data: signed, error: signError } = await getSupabaseServiceRoleClient()
      .storage.from(storageBucket())
      .createSignedUrl(path, SIGNED_ASSET_TTL_SECONDS);
    if (signError || !signed?.signedUrl) {
      throw new Error("Published Course Twin asset could not be signed for delivery.");
    }
    return signed.signedUrl;
  });
}

export async function stageCourseTwinVersion({
  courseTwinId,
  buildId,
  inputFingerprint,
  manifest,
  assets = [],
}: {
  courseTwinId: string;
  buildId: string;
  inputFingerprint: string;
  manifest: CourseTwinManifest;
  assets?: CourseTwinWorkerAsset[];
}) {
  await ensureCourseTwinStorageBucket();
  const db = getDb();
  const [latest] = await db
    .select({ packageVersion: courseTwinVersions.packageVersion })
    .from(courseTwinVersions)
    .where(eq(courseTwinVersions.courseTwinId, courseTwinId))
    .orderBy(desc(courseTwinVersions.packageVersion))
    .limit(1);
  const packageVersion = (latest?.packageVersion ?? 0) + 1;
  const storedAssetPaths = new Map<string, string>();
  for (const asset of assets) {
    const bytes = decodeCourseTwinWorkerAsset(asset);
    const assetPath = courseTwinStoragePath(courseTwinId, packageVersion, asset.fileName);
    const { error: assetError } = await getSupabaseServiceRoleClient()
      .storage.from(storageBucket())
      .upload(assetPath, bytes, {
        contentType: asset.contentType,
        cacheControl: "31536000, immutable",
        upsert: false,
      });
    if (assetError) {
      throw new Error(`Course Twin asset upload failed: ${assetError.message}`);
    }
    storedAssetPaths.set(asset.fileName, assetPath);
  }
  const path = courseTwinStoragePath(courseTwinId, packageVersion, "manifest.json");
  const manifestWithVersion = replaceWorkerAssetReferences(
    { ...manifest, packageVersion },
    storedAssetPaths,
  );
  const bytes = Buffer.from(`${JSON.stringify(manifestWithVersion, null, 2)}\n`, "utf8");
  const sha256 = sha256Hex(bytes);
  const { error } = await getSupabaseServiceRoleClient()
    .storage.from(storageBucket())
    .upload(path, bytes, {
      contentType: "application/json; charset=utf-8",
      cacheControl: "31536000, immutable",
      upsert: false,
    });
  if (error) throw new Error(`Course Twin manifest upload failed: ${error.message}`);

  const [version] = await db
    .insert(courseTwinVersions)
    .values({
      courseTwinId,
      buildId,
      packageVersion,
      schemaVersion: manifestWithVersion.schemaVersion,
      minimumRuntimeVersion: manifestWithVersion.minimumRuntimeVersion,
      status: "validated",
      manifestPath: path,
      manifestSha256: sha256,
      inputFingerprint,
      qualityJson: {
        ...manifestWithVersion.quality,
        supportedModes: manifestWithVersion.supportedModes,
      },
      attributionJson: manifestWithVersion.attribution,
      metricsJson: {
        terrainResolutionM: manifestWithVersion.terrain.resolutionM,
        mappedHoles: manifestWithVersion.quality.mappedHoles,
        mappedFeatures: manifestWithVersion.quality.mappedFeatures,
      },
    })
    .returning({ id: courseTwinVersions.id, packageVersion: courseTwinVersions.packageVersion });
  if (!version) throw new Error("Course Twin version metadata could not be staged.");
  return { ...version, manifestPath: path, manifestSha256: sha256 };
}

export function decodeCourseTwinWorkerAsset(asset: CourseTwinWorkerAsset) {
  const bytes = Buffer.from(asset.dataBase64, "base64");
  if (bytes.length < 1 || bytes.toString("base64") !== asset.dataBase64) {
    throw new Error(`Course Twin asset ${asset.fileName} has invalid base64 data.`);
  }
  if (sha256Hex(bytes) !== asset.sha256.toLowerCase()) {
    throw new Error(`Course Twin asset ${asset.fileName} failed its SHA-256 integrity check.`);
  }
  return bytes;
}

export function replaceWorkerAssetReferences(
  manifest: CourseTwinManifest,
  storedAssetPaths: ReadonlyMap<string, string>,
): CourseTwinManifest {
  const resolve = (url: string) => {
    if (!url.startsWith(ASSET_REFERENCE_PREFIX)) return url;
    const fileName = url.slice(ASSET_REFERENCE_PREFIX.length);
    const path = storedAssetPaths.get(fileName);
    if (!path) throw new Error(`Course Twin manifest references missing asset ${fileName}.`);
    return `${STORAGE_REFERENCE_PREFIX}${path}`;
  };
  return {
    ...manifest,
    terrain: {
      ...manifest.terrain,
      heightmap: manifest.terrain.heightmap
        ? { ...manifest.terrain.heightmap, url: resolve(manifest.terrain.heightmap.url) }
        : null,
      imagery: manifest.terrain.imagery
        ? { ...manifest.terrain.imagery, url: resolve(manifest.terrain.imagery.url) }
        : null,
    },
  };
}

export async function resolveCourseTwinAssetReferences(
  manifest: CourseTwinManifest,
  sign: (path: string) => Promise<string>,
): Promise<CourseTwinManifest> {
  const resolve = async (url: string) =>
    url.startsWith(STORAGE_REFERENCE_PREFIX)
      ? sign(url.slice(STORAGE_REFERENCE_PREFIX.length))
      : url;
  const heightmap = manifest.terrain.heightmap;
  const imagery = manifest.terrain.imagery;
  return {
    ...manifest,
    terrain: {
      ...manifest.terrain,
      heightmap: heightmap ? { ...heightmap, url: await resolve(heightmap.url) } : null,
      imagery: imagery ? { ...imagery, url: await resolve(imagery.url) } : null,
    },
  };
}

export function ensureCourseTwinStorageBucket() {
  bucketReady ??= (async () => {
    const storage = getSupabaseServiceRoleClient().storage;
    const { data, error } = await storage.listBuckets();
    if (error) throw new Error(`Course Twin storage could not be inspected: ${error.message}`);
    if (data.some((bucket) => bucket.name === storageBucket())) return;
    const { error: createError } = await storage.createBucket(storageBucket(), {
      public: false,
      fileSizeLimit: 250 * 1024 * 1024,
      allowedMimeTypes: [
        "application/json",
        "application/octet-stream",
        "image/jpeg",
        "image/png",
        "image/ktx2",
        "model/gltf-binary",
      ],
    });
    if (createError)
      throw new Error(`Course Twin storage bucket could not be created: ${createError.message}`);
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

export async function publishCourseTwinVersion({
  courseTwinId,
  versionId,
}: {
  courseTwinId: string;
  versionId: string;
}) {
  const now = new Date();
  return getDb().transaction(async (transaction) => {
    const [version] = await transaction
      .select({
        id: courseTwinVersions.id,
        buildId: courseTwinVersions.buildId,
        status: courseTwinVersions.status,
        quality: courseTwinVersions.qualityJson,
      })
      .from(courseTwinVersions)
      .where(
        and(
          eq(courseTwinVersions.id, versionId),
          eq(courseTwinVersions.courseTwinId, courseTwinId),
        ),
      )
      .limit(1);
    if (!version || version.status !== "validated") {
      throw new Error("Only a validated Course Twin version can be published.");
    }
    const quality = readPublishedQuality(version.quality);

    await transaction
      .update(courseTwinVersions)
      .set({ status: "superseded" })
      .where(
        and(
          eq(courseTwinVersions.courseTwinId, courseTwinId),
          eq(courseTwinVersions.status, "published"),
          ne(courseTwinVersions.id, versionId),
        ),
      );
    await transaction
      .update(courseTwinVersions)
      .set({ status: "published", publishedAt: now })
      .where(eq(courseTwinVersions.id, versionId));
    await transaction
      .update(courseTwins)
      .set({
        status: "published",
        activeVersionId: versionId,
        qualityGrade: quality.grade,
        supportedModesJson: quality.supportedModes,
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(courseTwins.id, courseTwinId));
    if (version.buildId) {
      await transaction
        .update(courseTwinBuilds)
        .set({
          status: "ready",
          completedAt: now,
          updatedAt: now,
          progressJson: { stage: "published", percent: 100 },
        })
        .where(eq(courseTwinBuilds.id, version.buildId));
    }
    return { courseTwinId, versionId, publishedAt: now.toISOString() };
  });
}

export function courseTwinStoragePath(
  courseTwinId: string,
  packageVersion: number,
  fileName: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(courseTwinId)) throw new Error("Course Twin id is invalid.");
  if (!Number.isInteger(packageVersion) || packageVersion < 1)
    throw new Error("Package version is invalid.");
  if (!/^[a-z0-9][a-z0-9._-]{0,120}$/i.test(fileName) || fileName.includes("..")) {
    throw new Error("Package file name is invalid.");
  }
  return `${courseTwinId}/v${packageVersion}/${fileName}`;
}

export function verifyCourseTwinManifest(
  bytes: Uint8Array,
  expectedSha256: string,
  expectedCourseId: string,
): CourseTwinManifest {
  if (sha256Hex(bytes) !== expectedSha256.toLowerCase()) {
    throw new Error("Published Course Twin manifest failed its SHA-256 integrity check.");
  }
  const parsed: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
  if (!isRecord(parsed) || parsed.schemaVersion !== COURSE_TWIN_SCHEMA_VERSION) {
    throw new Error("Published Course Twin manifest has an unsupported schema.");
  }
  if (!isRecord(parsed.course) || parsed.course.id !== expectedCourseId) {
    throw new Error("Published Course Twin manifest belongs to a different course.");
  }
  if (
    typeof parsed.minimumRuntimeVersion !== "string" ||
    !runtimeCompatible(parsed.minimumRuntimeVersion)
  ) {
    throw new Error("Published Course Twin package requires a newer runtime.");
  }
  return parsed as CourseTwinManifest;
}

function runtimeCompatible(minimum: string) {
  const required = minimum.split(".").map(Number);
  const current = COURSE_TWIN_RUNTIME_VERSION.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if ((current[index] ?? 0) > (required[index] ?? 0)) return true;
    if ((current[index] ?? 0) < (required[index] ?? 0)) return false;
  }
  return true;
}

function readPublishedQuality(value: Record<string, unknown>) {
  const grade = value.grade;
  const supportedModes = value.supportedModes;
  if (!(["A", "B", "C", "D"] as unknown[]).includes(grade) || !Array.isArray(supportedModes)) {
    throw new Error("Validated Course Twin quality metadata is incomplete.");
  }
  return {
    grade: grade as "A" | "B" | "C" | "D",
    supportedModes: supportedModes.filter(
      (mode): mode is "flyover" | "replay" | "strategy" | "play" =>
        ["flyover", "replay", "strategy", "play"].includes(String(mode)),
    ),
  };
}

function sha256Hex(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function storageBucket() {
  return process.env.COURSE_TWIN_STORAGE_BUCKET || DEFAULT_BUCKET;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
