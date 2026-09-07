import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { createHash } from "node:crypto";

import { and, eq, lt, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { offlineOperations, sessions } from "@/db/schema";
import { reportServerFailure } from "@/lib/server-observability";

export const OFFLINE_OPERATION_HEADER = "x-fkh-offline-operation";
const activeClaim = new AsyncLocalStorage<{
  ledgerId: string;
  attemptCount: number;
  userId: string;
  kind: OfflineOperationKind;
}>();
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
    const result = await activeClaim.run({ ...claim, userId, kind }, execute);
    const terminalStatus = result.status >= 500 ? "failed_transient" : "completed";
    const finished = await finishOfflineOperation(
      claim.ledgerId,
      claim.attemptCount,
      terminalStatus,
      result,
    );
    if (!finished)
      return (
        (await readCommittedClaim(claim.ledgerId, claim.attemptCount, result)) ??
        supersededOperationResponse()
      );
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    const committed = await readCommittedClaim(claim.ledgerId, claim.attemptCount);
    if (committed) {
      reportServerFailure("offline_operation_post_commit_failed", error, {
        "app.operation_kind": kind,
      });
      return committed;
    }
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
    const finished = await finishOfflineOperation(
      claim.ledgerId,
      claim.attemptCount,
      "failed_transient",
      result,
    );
    if (!finished)
      return (
        (await readCommittedClaim(claim.ledgerId, claim.attemptCount)) ??
        supersededOperationResponse()
      );
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
    .returning({ id: offlineOperations.id, attemptCount: offlineOperations.attemptCount });

  if (created) {
    return { kind: "claimed", ledgerId: created.id, attemptCount: created.attemptCount } as const;
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
    .returning({ id: offlineOperations.id, attemptCount: offlineOperations.attemptCount });

  return reclaimed
    ? ({ kind: "claimed", ledgerId: reclaimed.id, attemptCount: reclaimed.attemptCount } as const)
    : ({ kind: "in_progress" } as const);
}

async function finishOfflineOperation(
  ledgerId: string,
  attemptCount: number,
  status: "completed" | "failed_transient" | "failed_permanent",
  result: OfflineOperationResult,
) {
  const now = new Date();
  const [finished] = await getDb()
    .update(offlineOperations)
    .set({
      status,
      responseStatus: result.status,
      responseJson: result.body,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(offlineOperations.id, ledgerId),
        eq(offlineOperations.status, "pending"),
        eq(offlineOperations.attemptCount, attemptCount),
      ),
    )
    .returning({ id: offlineOperations.id });
  return Boolean(finished);
}

function supersededOperationResponse() {
  return Response.json(
    {
      ok: false,
      code: "offline_operation_in_progress",
      message: "A newer attempt is processing this offline action. Retry to retrieve its result.",
    },
    { status: 409, headers: { "retry-after": "2" } },
  );
}

/** Persist the core round receipt in the same transaction as its domain writes. */
export async function recordOfflineRoundCommit(
  tx: Pick<ReturnType<typeof getDb>, "select" | "update">,
  userId: string,
  sessionId: string,
) {
  const claim = activeClaim.getStore();
  if (!claim || claim.kind !== "round-edit") return;
  if (claim.userId !== userId) throw new Error("Offline round owner mismatch.");
  const [round] = await tx
    .select({ updatedAt: sessions.updatedAt })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);
  if (!round) throw new Error("Offline round unavailable.");
  const now = new Date();
  const [saved] = await tx
    .update(offlineOperations)
    .set({
      status: "completed",
      responseStatus: 200,
      responseJson: {
        ok: true,
        recordVersion: round.updatedAt.toISOString(),
        warning:
          "Round saved. Refresh the round to check linked practice results and achievements.",
      },
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(offlineOperations.id, claim.ledgerId),
        eq(offlineOperations.userId, userId),
        eq(offlineOperations.status, "pending"),
        eq(offlineOperations.attemptCount, claim.attemptCount),
      ),
    )
    .returning({ id: offlineOperations.id });
  if (!saved)
    throw new Error("Offline round claim was replaced. Retry to retrieve the current result.");
}

async function readCommittedClaim(
  ledgerId: string,
  attemptCount: number,
  successfulResult?: OfflineOperationResult,
) {
  const [saved] = await getDb()
    .select()
    .from(offlineOperations)
    .where(
      and(
        eq(offlineOperations.id, ledgerId),
        eq(offlineOperations.attemptCount, attemptCount),
        eq(offlineOperations.status, "completed"),
      ),
    )
    .limit(1);
  if (!saved) return null;
  if (successfulResult?.status === 200) {
    // Preserve the transaction's version even if a later edit happened before refresh finished.
    const body = { ...successfulResult.body, recordVersion: saved.responseJson?.recordVersion };
    await getDb()
      .update(offlineOperations)
      .set({ responseJson: body })
      .where(
        and(
          eq(offlineOperations.id, ledgerId),
          eq(offlineOperations.attemptCount, attemptCount),
          eq(offlineOperations.status, "completed"),
        ),
      );
    return Response.json(body, { status: 200 });
  }
  return Response.json(saved.responseJson, { status: saved.responseStatus ?? 200 });
}
