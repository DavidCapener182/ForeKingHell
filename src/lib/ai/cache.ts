import "server-only";

import { createHash } from "node:crypto";

import { and, eq, gt, isNull, or } from "drizzle-orm";

import { aiGenerationCache } from "@/db/schema";
import { getDb } from "@/db/client";
import type { AiFeatureKey } from "@/lib/ai/features";

export function hashAiRequest(input: unknown) {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

export async function readAiGenerationCache(input: {
  userId: string;
  featureKey: AiFeatureKey;
  requestHash: string;
  model: string;
}) {
  const now = new Date();
  const [row] = await getDb()
    .select({ responseJson: aiGenerationCache.responseJson })
    .from(aiGenerationCache)
    .where(
      and(
        eq(aiGenerationCache.userId, input.userId),
        eq(aiGenerationCache.featureKey, input.featureKey),
        eq(aiGenerationCache.requestHash, input.requestHash),
        eq(aiGenerationCache.model, input.model),
        or(isNull(aiGenerationCache.expiresAt), gt(aiGenerationCache.expiresAt, now)),
      ),
    )
    .limit(1);

  return row?.responseJson ?? null;
}

export async function writeAiGenerationCache(input: {
  userId: string;
  featureKey: AiFeatureKey;
  requestHash: string;
  model: string;
  responseJson: Record<string, unknown>;
  metadataJson?: Record<string, unknown>;
  ttlMs?: number;
}) {
  const now = new Date();
  const expiresAt = input.ttlMs ? new Date(now.getTime() + input.ttlMs) : null;

  await getDb()
    .insert(aiGenerationCache)
    .values({
      userId: input.userId,
      featureKey: input.featureKey,
      requestHash: input.requestHash,
      model: input.model,
      responseJson: input.responseJson,
      metadataJson: input.metadataJson ?? {},
      expiresAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        aiGenerationCache.userId,
        aiGenerationCache.featureKey,
        aiGenerationCache.requestHash,
        aiGenerationCache.model,
      ],
      set: {
        responseJson: input.responseJson,
        metadataJson: input.metadataJson ?? {},
        expiresAt,
        updatedAt: now,
      },
    });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

  return `{${entries.join(",")}}`;
}
