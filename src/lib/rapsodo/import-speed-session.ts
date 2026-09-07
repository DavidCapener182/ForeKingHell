import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { speedTrainingSessions, speedTrainingSwings } from "@/db/schema";
import { RapsodoCloudClient } from "./cloud-client";
import { getStoredRapsodoToken } from "./token-cookie";
import { summarizeSpeedReadings } from "@/lib/speed-training";

export class SpeedImportError extends Error {}

export async function importRapsodoSpeedSession(userId: string, providerSessionId: string) {
  if (!providerSessionId.trim() || providerSessionId.length > 180)
    throw new SpeedImportError("Choose an R-Speed session from your connected account.");
  const stored = await getStoredRapsodoToken();
  if (!stored) throw new SpeedImportError("Connect R-Cloud before importing a speed session.");
  const client = new RapsodoCloudClient();
  const available = await client.listSpeedSessions(stored.token, { take: 100 });
  const selected = available.find((item) => item.providerSessionId === providerSessionId);
  if (!selected)
    throw new SpeedImportError("That session is not available in your connected R-Cloud account.");
  const db = getDb();
  const ownedKey = and(
    eq(speedTrainingSessions.userId, userId),
    eq(speedTrainingSessions.providerKind, "speed"),
    eq(speedTrainingSessions.providerSessionId, providerSessionId),
  );
  const [existing] = await db
    .select({ id: speedTrainingSessions.id })
    .from(speedTrainingSessions)
    .where(ownedKey)
    .limit(1);
  if (existing) return existing.id;
  const detail = await client.listSpeedSessionSwings(stored.token, providerSessionId, 500);
  const summary = summarizeSpeedReadings(detail.map((swing) => swing.clubSpeedMph));
  if (!summary || !detail.length)
    throw new SpeedImportError(
      "R-Cloud has no usable individual readings for this session. You can record it manually instead.",
    );
  if (
    summary.count !== detail.length ||
    (selected.swingCount === null && detail.length >= 500) ||
    (selected.swingCount !== null && selected.swingCount !== detail.length)
  )
    throw new SpeedImportError(
      "R-Cloud returned incomplete or invalid readings. No session was imported; try again or record it manually.",
    );
  const date = selected.dateIso ? new Date(selected.dateIso) : null;
  if (!date || !Number.isFinite(date.getTime()))
    throw new SpeedImportError(
      "The provider session has no valid date. Record it manually with the correct date.",
    );
  return db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(speedTrainingSessions)
      .values({
        userId,
        source: "rapsodo",
        providerKind: "speed",
        providerSessionId,
        sessionDate: date,
        title: selected.title.slice(0, 180),
        implementKind: "other",
        implementLabel: "R-Speed",
        speedSystem: selected.speedSystem?.slice(0, 80) ?? null,
        handedness: "unknown",
        swingCount: summary.count,
        minSpeedMph: summary.minSpeedMph,
        avgSpeedMph: summary.avgSpeedMph,
        maxSpeedMph: summary.maxSpeedMph,
        rawMetadataJson: {
          providerSession: selected.raw,
          detailCount: detail.length,
          speedNormalization: "rapsodo-cloud-client",
        },
      })
      .onConflictDoNothing({
        target: [
          speedTrainingSessions.userId,
          speedTrainingSessions.providerKind,
          speedTrainingSessions.providerSessionId,
        ],
      })
      .returning({ id: speedTrainingSessions.id });
    if (!saved) {
      const [winner] = await tx
        .select({ id: speedTrainingSessions.id })
        .from(speedTrainingSessions)
        .where(ownedKey)
        .limit(1);
      if (!winner) throw new Error("Concurrent import receipt unavailable");
      return winner.id;
    }
    await tx.insert(speedTrainingSwings).values(
      detail.map((swing, index) => ({
        userId,
        speedSessionId: saved.id,
        swingNumber: index + 1,
        clubSpeedMph: swing.clubSpeedMph,
        swingSide: reportedSide(swing.raw),
        sourceRawJson: {
          ...swing.raw,
          rapsodoSwingId: swing.rapsodoSwingId,
          providerSwingNumber: swing.swingNumber,
        },
      })),
    );
    return saved.id;
  });
}

function reportedSide(raw: Record<string, unknown>) {
  const side = raw.swingSide ?? raw.side;
  return typeof side === "string" && side.trim() ? side.trim().slice(0, 40) : null;
}
