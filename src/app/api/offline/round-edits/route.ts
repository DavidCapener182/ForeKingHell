import { NextRequest } from "next/server";

import {
  resplitRoundAction,
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

  const formData = offlineRoundEditPayloadToFormData(payload);

  switch (payload.editKind) {
    case "round-context":
      await updateRoundContextAction(formData);
      break;
    case "round-course-link":
      await updateRoundCourseLinkAction(formData);
      break;
    case "round-hole":
      await updateRoundHoleAction(formData);
      break;
    case "shot-club":
      await updateShotClubAction(formData);
      break;
    case "club":
      await updateClubAction(formData);
      break;
    case "resplit-round":
      await resplitRoundAction(formData);
      break;
  }

  return Response.json({ ok: true });
}
