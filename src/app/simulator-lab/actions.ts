"use server";

import { revalidatePath } from "next/cache";

import { createFeedItem } from "@/lib/social";
import { requireCurrentUserId } from "@/lib/current-user";
import { getSessionRoastContext } from "@/lib/simulator-lab";

export async function createSessionRoastFeedItemAction(input: {
  sessionId: string;
  headline: string;
  roast: string;
  shortCaption: string;
}) {
  const userId = await requireCurrentUserId();
  const context = await getSessionRoastContext(userId, input.sessionId);

  if (!context) {
    return { ok: false, message: "Session not found." };
  }

  await createFeedItem({
    userId,
    itemType: "session_roast",
    headline: input.headline.trim().slice(0, 220) || "Simulator roast draft",
    metricLabel: "Roast",
    metricValue: `${context.facts.length} facts`,
    context: input.shortCaption.trim().slice(0, 500) || input.roast.trim().slice(0, 500),
    proofUrl: `/today?session=${encodeURIComponent(context.session.id)}`,
    sourceType: "session",
    sourceId: context.session.id,
    visibility: "private",
    verificationLabel: "Private draft",
    dedupeKey: `session-roast:${context.session.id}`,
    metadataJson: {
      roast: input.roast.trim().slice(0, 1200),
      facts: context.facts,
    },
  });

  revalidatePath("/feed");
  revalidatePath("/simulator-lab");

  return { ok: true };
}
