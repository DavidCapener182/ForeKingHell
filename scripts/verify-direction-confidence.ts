/** Live regression check: every temporary confidence update is rolled back. */
import { loadEnvConfig } from "@next/env";
import { and, eq } from "drizzle-orm";
import { getDb, closeDb } from "../src/db/client";
import { sessions, shots } from "../src/db/schema";
import { directionalMetricSql } from "../src/lib/directional-confidence-sql";
import assert from "node:assert/strict";
async function main() {
  loadEnvConfig(process.cwd());
  const shotId = process.argv[2];
  if (!shotId || !/^[0-9a-f-]{36}$/i.test(shotId))
    throw new Error("Pass the exact shot UUID to verify.");
  const db = getDb();
  const rollback = new Error("verification rollback");
  let before: unknown;
  let sessionId = "";
  let ownerId = "";
  try {
    await db
      .transaction(async (tx) => {
        const [source] = await tx
          .select({ shot: shots, confidence: sessions.dataConfidenceJson })
          .from(shots)
          .innerJoin(
            sessions,
            and(eq(shots.sessionId, sessions.id), eq(shots.userId, sessions.userId)),
          )
          .where(eq(shots.id, shotId))
          .limit(1);
        assert(source, "Shot not found");
        sessionId = source.shot.sessionId;
        ownerId = source.shot.userId;
        before = source.confidence;
        await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(and(eq(sessions.id, sessionId), eq(sessions.userId, ownerId)))
          .for("update");
        const read = async () =>
          (
            await tx
              .select({
                rawSide: shots.sideCarryYd,
                side: directionalMetricSql(shots.sideCarryYd),
                path: directionalMetricSql(shots.clubPathDeg),
                carry: shots.carryYd,
                speed: shots.ballSpeedMph,
                raw: shots.sourceRawJson,
              })
              .from(shots)
              .where(and(eq(shots.id, shotId), eq(shots.userId, ownerId)))
          )[0];
        for (const alignment of ["possibly_misaligned", "misaligned"] as const) {
          await tx
            .update(sessions)
            .set({ dataConfidenceJson: { ...source.confidence, alignment } })
            .where(and(eq(sessions.id, sessionId), eq(sessions.userId, ownerId)));
          const r = await read();
          assert.equal(r.side, null, `Masked SIDE for ${alignment}`);
          assert.equal(r.path, null, `Masked path for ${alignment}`);
          assert.equal(r.carry, source.shot.carryYd);
          assert.equal(r.speed, source.shot.ballSpeedMph);
          assert.deepEqual(r.raw, source.shot.sourceRawJson);
          assert.equal(r.rawSide, source.shot.sideCarryYd);
        }
        await tx
          .update(sessions)
          .set({
            dataConfidenceJson: {
              alignment: "aligned",
              directionReviews: {
                [shotId]: { status: "questionable", updatedAt: new Date().toISOString() },
              },
            },
          })
          .where(and(eq(sessions.id, sessionId), eq(sessions.userId, ownerId)));
        assert.equal((await read()).side, null, "Per-shot question");
        await tx
          .update(sessions)
          .set({
            dataConfidenceJson: {
              alignment: "aligned",
              directionReviews: {
                [shotId]: { status: "confirmed", updatedAt: new Date().toISOString() },
              },
            },
          })
          .where(and(eq(sessions.id, sessionId), eq(sessions.userId, ownerId)));
        assert.equal((await read()).side, source.shot.sideCarryYd);
        throw rollback;
      })
      .catch((e) => {
        if (e !== rollback) throw e;
      });
    const [after] = await db
      .select({ data: sessions.dataConfidenceJson })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, ownerId)));
    assert.deepEqual(after.data, before);
    console.log(
      "PASS: both alignment states and per-shot question/confirm; carry, speed and raw provenance retained. Rollback independently verified.",
    );
  } finally {
    await closeDb();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.stack : "Verification failed");
  process.exitCode = 1;
});
