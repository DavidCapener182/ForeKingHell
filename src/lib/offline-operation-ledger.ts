import "server-only";

import { createHash } from "node:crypto";

import { and, eq, lt, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { offlineOperations } from "@/db/schema";
import { reportServerFailure } from "@/lib/server-observability";

export const OFFLINE_OPERATION_HEADER = "x-fkh-offline-operation";
const STALE_CLAIM_MS = 5 * 60 * 1000;

type OfflineOperationKind = "import-csv" | "round-edit";
type OfflineOperationBody = Record<string, unknown>;

export type OfflineOperationResult = {
  status: number;
  body: OfflineOperationBody;
};

export async function runIdempotentOfflineOperation({
  request,
  userId,
  kind,
  payload,
  execute,
}: {
  request: NextRequest;
  userId: string;
  kind: OfflineOperationKind;
  payload: unknown;
  execute: () => Promise<OfflineOperationResult>;
}) {
  const operationId = parseOfflineOperationId(request.headers.get(OFFLINE_OPERATION_HEADER));
  if (!operationId) {
    return Response.json(
      {
        ok: false,
        code: "offline_operation_id_required",
        message: "A valid offline operation identifier is required.",
      },
      { status: 400 },
    );
  }

  const requestHash = hashOfflineOperationPayload(payload);
  const claim = await claimOfflineOperation({ userId, operationId, kind, requestHash });

  if (claim.kind === "reused_with_different_payload") {
    return Response.json(
      {
        ok: false,
        code: "offline_operation_payload_conflict",
        message: "This offline operation identifier was already used for different data.",
      },
      { status: 409 },
    );
  }

  if (claim.kind === "in_progress") {
    return Response.json(
      {
        ok: false,
        code: "offline_operation_in_progress",
        message: "This offline action is already being processed.",
      },
      { status: 409, headers: { "retry-after": "2" } },
    );
  }

  if (claim.kind === "replay") {
    return Response.json(claim.body, {
      status: claim.status,
      headers: { "x-fkh-offline-replayed": "1" },
    });
  }

  try {
    const result = await execute();
    const terminalStatus = result.status >= 500 ? "failed_transient" : "completed";
    await finishOfflineOperation(claim.ledgerId, terminalStatus, result);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    reportServerFailure("offline_operation_failed", error, {
      "app.operation_kind": kind,
    });
    const result = {
      status: 503,
      body: {
        ok: false,
        code: "offline_operation_retryable",
        message: "This offline action could not be completed yet. It is safe to retry.",
      },
    } satisfies OfflineOperationResult;
    await finishOfflineOperation(claim.ledgerId, "failed_transient", result);
    return Response.json(result.body, { status: result.status });
  }
}

export function parseOfflineOperationId(value: string | null) {
  const operationId = value?.trim() ?? "";
  return /^[a-z0-9][a-z0-9-]{7,127}$/i.test(operationId) ? operationId : null;
}

export function hashOfflineOperationPayload(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function claimOfflineOperation({
  userId,
  operationId,
  kind,
  requestHash,
}: {
  userId: string;
  operationId: string;
  kind: OfflineOperationKind;
  requestHash: string;
}) {
  const db = getDb();
  const now = new Date();
  const [created] = await db
    .insert(offlineOperations)
    .values({
      userId,
      operationId,
      operationKind: kind,
      requestHash,
      status: "pending",
      claimedAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [offlineOperations.userId, offlineOperations.operationId],
    })
    .returning({ id: offlineOperations.id });

  if (created) {
    return { kind: "claimed", ledgerId: created.id } as const;
  }

  const [existing] = await db
    .select()
    .from(offlineOperations)
    .where(
      and(eq(offlineOperations.userId, userId), eq(offlineOperations.operationId, operationId)),
    )
    .limit(1);

  if (!existing || existing.requestHash !== requestHash || existing.operationKind !== kind) {
    return { kind: "reused_with_different_payload" } as const;
  }

  if (existing.status === "completed" || existing.status === "failed_permanent") {
    return {
      kind: "replay",
      status: existing.responseStatus ?? (existing.status === "completed" ? 200 : 400),
      body: existing.responseJson ?? { ok: existing.status === "completed" },
    } as const;
  }

  const reclaimBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  const retryable =
    existing.status === "failed_transient" ||
    (existing.status === "pending" && existing.updatedAt < reclaimBefore);

  if (!retryable) {
    return { kind: "in_progress" } as const;
  }

  const [reclaimed] = await db
    .update(offlineOperations)
    .set({
      status: "pending",
      attemptCount: sql`${offlineOperations.attemptCount} + 1`,
      responseStatus: null,
      responseJson: null,
      claimedAt: now,
      completedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(offlineOperations.id, existing.id),
        existing.status === "pending"
          ? and(
              eq(offlineOperations.status, "pending"),
              lt(offlineOperations.updatedAt, reclaimBefore),
            )
          : eq(offlineOperations.status, "failed_transient"),
      ),
    )
    .returning({ id: offlineOperations.id });

  return reclaimed
    ? ({ kind: "claimed", ledgerId: reclaimed.id } as const)
    : ({ kind: "in_progress" } as const);
}

async function finishOfflineOperation(
  ledgerId: string,
  status: "completed" | "failed_transient" | "failed_permanent",
  result: OfflineOperationResult,
) {
  const now = new Date();
  await getDb()
    .update(offlineOperations)
    .set({
      status,
      responseStatus: result.status,
      responseJson: result.body,
      completedAt: now,
      updatedAt: now,
    })
    .where(and(eq(offlineOperations.id, ledgerId), eq(offlineOperations.status, "pending")));
}
