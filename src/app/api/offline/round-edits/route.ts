import { NextRequest } from "next/server";

import {
  moveRoundShotHoleAction,
  moveRoundShotToHoleAction,
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

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = parseOfflineRoundEditPayload(await request.json().catch(() => null));

  if (!payload) {
    return Response.json({ ok: false, message: "Invalid offline round edit payload." }, { status: 400 });
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
    case "move-shot-hole":
      await moveRoundShotHoleAction(formData);
      break;
    case "move-shot-to-hole":
      await moveRoundShotToHoleAction(formData);
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
