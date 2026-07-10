import "server-only";

import { readAiGenerationCache, hashAiRequest, writeAiGenerationCache } from "@/lib/ai/cache";
import { getAiFeature, resolveAiModel, type AiFeatureKey } from "@/lib/ai/features";
import {
  AiAccessError,
  finalizeAiCreditReservation,
  logAiUsageEvent,
  requireAiCredits,
  requireAiFeaturePlan,
  reserveAiCredits,
  type AiFeatureEntitlement,
  type AiUsageTokenStats,
} from "@/lib/ai/usage";

export type OpenAiTextPart = {
  type: "input_text";
  text: string;
};

export type OpenAiImagePart = {
  type: "input_image";
  image_url: string;
  detail?: "low" | "high" | "auto";
};

export type OpenAiInputMessage = {
  role: "system" | "user" | "assistant";
  content: Array<OpenAiTextPart | OpenAiImagePart>;
};

export type JsonSchema = {
  type: "object";
  additionalProperties: false;
  properties: Record<string, unknown>;
  required: string[];
};

export type AiJsonResult<T extends object> = {
  output: T;
  generatedAt: string;
  model: string;
  featureKey: AiFeatureKey;
  creditsCharged: number;
  creditsRemaining: number;
  cached: boolean;
  requestHash: string;
};

export async function generateAiJson<T extends object = Record<string, unknown>>(input: {
  userId: string;
  featureKey: AiFeatureKey;
  schemaName: string;
  schema: JsonSchema;
  messages: OpenAiInputMessage[];
  cachePayload?: unknown;
  useCache?: boolean;
  metadataJson?: Record<string, unknown>;
  maxOutputTokens?: number;
}) {
  const feature = getAiFeature(input.featureKey);
  const entitlement = await requireAiFeaturePlan(input.userId, input.featureKey);
  const model = resolveAiModel(input.featureKey);
  const requestHash = hashAiRequest({
    featureKey: input.featureKey,
    model,
    payload: input.cachePayload ?? input.messages,
  });

  if (input.useCache ?? Boolean(feature.cacheTtlMs)) {
    const cached = await readAiGenerationCache({
      userId: input.userId,
      featureKey: input.featureKey,
      requestHash,
      model,
    });

    if (cached) {
      await logAiUsageEvent({
        userId: input.userId,
        featureKey: input.featureKey,
        planKeySnapshot: entitlement.planKey,
        model,
        status: "cache_hit",
        aiCredits: 0,
        requestHash,
        metadataJson: input.metadataJson,
      });

      return {
        output: cached as T,
        generatedAt: new Date().toISOString(),
        model,
        featureKey: input.featureKey,
        creditsCharged: 0,
        creditsRemaining: entitlement.monthlyRemaining,
        cached: true,
        requestHash,
      } satisfies AiJsonResult<T>;
    }
  }

  requireAiCredits(entitlement, feature.creditCost);

  return callOpenAiJson<T>({
    ...input,
    model,
    requestHash,
    entitlement,
    maxOutputTokens: input.maxOutputTokens ?? feature.maxOutputTokens,
    cacheTtlMs: feature.cacheTtlMs,
  });
}

async function callOpenAiJson<T extends object>(input: {
  userId: string;
  featureKey: AiFeatureKey;
  schemaName: string;
  schema: JsonSchema;
  messages: OpenAiInputMessage[];
  metadataJson?: Record<string, unknown>;
  maxOutputTokens: number;
  model: string;
  requestHash: string;
  entitlement: AiFeatureEntitlement;
  cacheTtlMs?: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new AiAccessError({
      message: "OPENAI_API_KEY is required for AI features.",
      status: 500,
      code: "ai_not_configured",
    });
  }

  const creditsCharged = getAiFeature(input.featureKey).creditCost;
  const reservation = await reserveAiCredits({
    userId: input.userId,
    featureKey: input.featureKey,
    planKeySnapshot: input.entitlement.planKey,
    model: input.model,
    creditCost: creditsCharged,
    monthlyLimit: input.entitlement.monthlyLimit,
    requestHash: input.requestHash,
    metadataJson: input.metadataJson,
  });

  let upstream: Response;

  try {
    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        input: input.messages,
        text: {
          format: {
            type: "json_schema",
            name: input.schemaName,
            schema: input.schema,
            strict: true,
          },
        },
        max_output_tokens: input.maxOutputTokens,
      }),
    });
  } catch (error) {
    await finalizeAiCreditReservation({
      eventId: reservation.eventId,
      status: "error",
      releaseCredits: true,
      metadataJson: {
        ...input.metadataJson,
        failure: "upstream_unreachable",
      },
    });
    throw error;
  }

  const responsePayload = (await upstream.json().catch(() => null)) as unknown;

  if (!upstream.ok) {
    await finalizeAiCreditReservation({
      eventId: reservation.eventId,
      status: "error",
      releaseCredits: true,
      responseId: readResponseId(responsePayload),
      tokenStats: readTokenStats(responsePayload),
      metadataJson: {
        ...input.metadataJson,
        upstreamStatus: upstream.status,
      },
    });

    throw new AiAccessError({
      message: readOpenAiError(responsePayload) ?? "OpenAI request failed.",
      status: upstream.status,
      code: "ai_upstream_error",
      details: { featureKey: input.featureKey },
    });
  }

  let output: T;

  try {
    output = parseResponseJson<T>(responsePayload);
  } catch (error) {
    await finalizeAiCreditReservation({
      eventId: reservation.eventId,
      status: "error",
      releaseCredits: true,
      responseId: readResponseId(responsePayload),
      tokenStats: readTokenStats(responsePayload),
      metadataJson: {
        ...input.metadataJson,
        failure: "invalid_structured_response",
      },
    });
    throw error;
  }

  if (input.cacheTtlMs) {
    await writeAiGenerationCache({
      userId: input.userId,
      featureKey: input.featureKey,
      requestHash: input.requestHash,
      model: input.model,
      responseJson: output as Record<string, unknown>,
      metadataJson: input.metadataJson,
      ttlMs: input.cacheTtlMs,
    }).catch((error) => console.error("[ai] Failed to persist generation cache", error));
  }

  await finalizeAiCreditReservation({
    eventId: reservation.eventId,
    status: "success",
    responseId: readResponseId(responsePayload),
    tokenStats: readTokenStats(responsePayload),
    metadataJson: input.metadataJson,
  });

  return {
    output,
    generatedAt: new Date().toISOString(),
    model: input.model,
    featureKey: input.featureKey,
    creditsCharged,
    creditsRemaining: reservation.creditsRemaining,
    cached: false,
    requestHash: input.requestHash,
  } satisfies AiJsonResult<T>;
}

export function aiErrorPayload(error: unknown) {
  if (error instanceof AiAccessError) {
    return {
      body: {
        message: error.message,
        code: error.code,
        ...error.details,
      },
      status: error.status,
    };
  }

  return {
    body: {
      message: error instanceof Error ? error.message : "AI request failed.",
    },
    status: 500,
  };
}

function parseResponseJson<T extends object>(payload: unknown): T {
  const text = readResponseText(payload);
  const parsed = JSON.parse(text) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("OpenAI structured response was not a JSON object.");
  }

  return parsed as T;
}

function readResponseText(payload: unknown) {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    throw new Error("OpenAI response did not include text.");
  }

  const chunks: string[] = [];

  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  const text = chunks.join("\n").trim();

  if (!text) {
    throw new Error("OpenAI response did not include text.");
  }

  return text;
}

function readOpenAiError(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }

  return typeof payload.error.message === "string" ? payload.error.message : null;
}

function readResponseId(payload: unknown) {
  return isRecord(payload) && typeof payload.id === "string" ? payload.id.slice(0, 120) : null;
}

function readTokenStats(payload: unknown): AiUsageTokenStats | undefined {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    return undefined;
  }

  const inputTokens =
    typeof payload.usage.input_tokens === "number" ? payload.usage.input_tokens : null;
  const outputTokens =
    typeof payload.usage.output_tokens === "number" ? payload.usage.output_tokens : null;

  return { inputTokens, outputTokens };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
