import { NextRequest } from "next/server";

import {
  resplitRoundAction,
  completeLiveRoundAction,
  updateClubAction,
  updateRoundContextAction,
  updateRoundCourseLinkAction,
  updateRoundHoleAction,
  updateShotClubAction,
} from "@/app/rounds/actions";
import {
  offlineRoundEditPayloadToFormData,
  parseOfflineRoundEditPayload,
} from "@/lib/offline-round-edit-payload";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { readBoundedJsonBody } from "@/lib/api-protection";
import { runIdempotentOfflineOperation } from "@/lib/offline-operation-ledger";
import {
  OfflineRoundConflict,
  withOfflineRoundPrecondition,
} from "@/lib/offline-round-precondition";
import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
const MAX_REQUEST_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  const userId = await getOptionalCurrentUserId();
  if (!userId) {
    return Response.json({ ok: false, message: "Authentication required." }, { status: 401 });
  }

  if (request.headers.get("x-fkh-offline-owner") !== userId) {
    return Response.json(
      { ok: false, message: "Offline action belongs to a different account." },
      { status: 409 },
    );
  }

  const bodyResult = await readBoundedJsonBody(request, MAX_REQUEST_BYTES);
  if (!bodyResult.ok) return bodyResult.response;
  const payload = parseOfflineRoundEditPayload(bodyResult.value);

  if (!payload) {
    return Response.json(
      { ok: false, message: "Invalid offline round edit payload." },
      { status: 400 },
    );
  }

  return runIdempotentOfflineOperation({
    request,
    userId,
    kind: "round-edit",
    payload,
    execute: async () => {
      const versionCheck = await checkRoundEditVersion(userId, payload.fields);
      if (!versionCheck.ok) {
        return {
          status: 409,
          body: {
            ok: false,
            code: "offline_edit_conflict",
            message:
              "This round changed after the offline edit was queued. Review the latest round before applying it again.",
            currentVersion: versionCheck.currentVersion,
          },
        };
      }

      const formData = offlineRoundEditPayloadToFormData(payload);
      let warning: string | undefined;

      try {
        await withOfflineRoundPrecondition(
          {
            userId,
            sessionId: versionCheck.sessionId,
            expectedVersion: versionCheck.expectedVersion,
          },
          async () => {
            switch (payload.editKind) {
              case "round-context":
                await updateRoundContextAction(formData);
                break;
              case "round-course-link":
                await updateRoundCourseLinkAction(formData);
                break;
              case "round-complete":
                await completeLiveRoundAction(formData);
                break;
              case "round-hole":
                await updateRoundHoleAction(formData);
                break;
              case "shot-club":
                ({ warning } = await updateShotClubAction(formData));
                break;
              case "club":
                ({ warning } = await updateClubAction(formData));
                break;
              case "resplit-round":
                await resplitRoundAction(formData);
                break;
            }
          },
        );
      } catch (error) {
        if (error instanceof OfflineRoundConflict) {
          return {
            status: 409,
            body: {
              ok: false,
              code: "offline_edit_conflict",
              message: error.message,
              currentVersion: error.currentVersion,
            },
          };
        }
        throw error;
      }
      const [saved] = await getDb()
        .select({ updatedAt: sessions.updatedAt })
        .from(sessions)
        .where(and(eq(sessions.id, versionCheck.sessionId), eq(sessions.userId, userId)))
        .limit(1);
      return {
        status: 200,
        body: {
          ok: true,
          recordVersion: saved?.updatedAt.toISOString() ?? null,
          ...(warning ? { warning } : {}),
        },
      };
    },
  });
}

async function checkRoundEditVersion(userId: string, fields: Array<[string, string]>) {
  const sessionId = fields.find(([key]) => key === "sessionId")?.[1];
  const expectedUpdatedAt = fields.find(([key]) => key === "expectedUpdatedAt")?.[1];
  if (!sessionId || !expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
    return { ok: false as const, currentVersion: null };
  }

  const [round] = await getDb()
    .select({ updatedAt: sessions.updatedAt })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);
  const currentVersion = round?.updatedAt.toISOString() ?? null;

  return currentVersion === new Date(expectedUpdatedAt).toISOString()
    ? { ok: true as const, sessionId, expectedVersion: currentVersion }
    : { ok: false as const, currentVersion };
}
