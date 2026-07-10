import { NextRequest } from "next/server";

import { saveRapsodoImportBatch } from "@/lib/imports/save-rapsodo-import";
import { parseOfflineImportPayload } from "@/lib/offline-import-payload";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { getOptionalCurrentUserId } from "@/lib/current-user";
import { readBoundedJsonBody } from "@/lib/api-protection";

export const dynamic = "force-dynamic";
const MAX_REQUEST_BYTES = 52 * 1024 * 1024;

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
  const payload = parseOfflineImportPayload(bodyResult.value);

  if (!payload) {
    return Response.json(
      { ok: false, message: "Invalid offline import payload." },
      { status: 400 },
    );
  }

  const result = await saveRapsodoImportBatch(payload.inputs);

  if (result.ok) {
    await setAchievementUnlockFlash(result.achievementUnlockNotifications);
  }

  return Response.json(result, { status: result.ok ? 200 : 400 });
}
