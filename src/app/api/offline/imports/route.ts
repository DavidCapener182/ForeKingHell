import { NextRequest } from "next/server";

import { saveRapsodoImportBatch } from "@/lib/imports/save-rapsodo-import";
import { parseOfflineImportPayload } from "@/lib/offline-import-payload";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await getOptionalCurrentUserId())) {
    return Response.json({ ok: false, message: "Authentication required." }, { status: 401 });
  }

  const payload = parseOfflineImportPayload(await request.json().catch(() => null));

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
