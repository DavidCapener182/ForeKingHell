import { createHmac, timingSafeEqual } from "node:crypto";

import type { CourseTwinManifest } from "@/lib/course-twin-contract";

const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const MAX_WORKER_ASSETS = 8;
const MAX_WORKER_ASSET_BYTES = 6 * 1024 * 1024;

export type CourseTwinWorkerAsset = {
  fileName: string;
  contentType:
    | "application/octet-stream"
    | "image/jpeg"
    | "image/png"
    | "image/ktx2"
    | "model/gltf-binary";
  sha256: string;
  dataBase64: string;
};

export function signCourseTwinWorkerPayload(body: string, timestamp: string, secret: string) {
  if (secret.length < 32)
    throw new Error("Course Twin worker secret must be at least 32 characters.");
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyCourseTwinWorkerSignature({
  body,
  timestamp,
  signature,
  secret,
  now = Date.now(),
}: {
  body: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  now?: number;
}) {
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(now - timestampNumber) > MAX_CLOCK_SKEW_MS) {
    return false;
  }
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = signCourseTwinWorkerPayload(body, String(timestamp), secret);
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function parseCourseTwinWorkerCompletion(value: unknown):
  | { status: "failed"; errorCode: string; errorMessage: string }
  | {
      status: "completed";
      manifest: CourseTwinManifest;
      assets: CourseTwinWorkerAsset[];
      metrics: Record<string, unknown>;
    } {
  if (!isRecord(value)) throw new Error("Worker completion body must be an object.");
  if (value.status === "failed") {
    if (typeof value.errorCode !== "string" || !/^[a-z0-9_]{2,80}$/i.test(value.errorCode)) {
      throw new Error("Worker error code is invalid.");
    }
    if (
      typeof value.errorMessage !== "string" ||
      value.errorMessage.length < 1 ||
      value.errorMessage.length > 2_000
    ) {
      throw new Error("Worker error message is invalid.");
    }
    return { status: "failed", errorCode: value.errorCode, errorMessage: value.errorMessage };
  }
  if (value.status !== "completed" || !isRecord(value.manifest)) {
    throw new Error("Worker completion status is invalid.");
  }
  const manifest = value.manifest;
  if (
    manifest.schemaVersion !== 1 ||
    !isRecord(manifest.course) ||
    typeof manifest.course.id !== "string" ||
    !Array.isArray(manifest.holes) ||
    !Array.isArray(manifest.features) ||
    !isRecord(manifest.quality) ||
    !Array.isArray(manifest.attribution)
  ) {
    throw new Error("Worker manifest is incomplete.");
  }
  const assets = Array.isArray(value.assets) ? value.assets.map(parseWorkerAsset) : [];
  if (assets.length > MAX_WORKER_ASSETS) throw new Error("Worker returned too many assets.");
  const duplicateNames = new Set<string>();
  for (const asset of assets) {
    if (duplicateNames.has(asset.fileName)) throw new Error("Worker asset names must be unique.");
    duplicateNames.add(asset.fileName);
  }
  return {
    status: "completed",
    manifest: manifest as CourseTwinManifest,
    assets,
    metrics: isRecord(value.metrics) ? value.metrics : {},
  };
}

function parseWorkerAsset(value: unknown): CourseTwinWorkerAsset {
  if (!isRecord(value)) throw new Error("Worker asset must be an object.");
  if (
    typeof value.fileName !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,120}$/i.test(value.fileName) ||
    value.fileName.includes("..")
  ) {
    throw new Error("Worker asset file name is invalid.");
  }
  const allowedTypes = [
    "application/octet-stream",
    "image/jpeg",
    "image/png",
    "image/ktx2",
    "model/gltf-binary",
  ] as const;
  if (!allowedTypes.includes(value.contentType as (typeof allowedTypes)[number])) {
    throw new Error("Worker asset content type is invalid.");
  }
  if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(value.sha256)) {
    throw new Error("Worker asset digest is invalid.");
  }
  if (typeof value.dataBase64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.dataBase64)) {
    throw new Error("Worker asset data is invalid.");
  }
  const estimatedBytes = Math.floor((value.dataBase64.length * 3) / 4);
  if (estimatedBytes < 1 || estimatedBytes > MAX_WORKER_ASSET_BYTES) {
    throw new Error("Worker asset is empty or too large.");
  }
  return value as CourseTwinWorkerAsset;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
