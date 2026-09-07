import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clubs, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  isShotReviewStatus,
  effectiveShotReviewStatus,
  shotReviewStatusLabel,
} from "@/lib/shot-review";
import { ShotReviewButton } from "@/app/shots/shot-review-controls";
import { ShotEvidenceSheet } from "@/app/shots/shot-evidence-sheet";

export async function ImportResultShotReview({ sessionId }: { sessionId: string }) {
  const userId = await requireCurrentUserId();
  const [records, ownedClubs] = await Promise.all([
    getDb()
      .select({
        id: shots.id,
        number: shots.shotNumber,
        club: shots.clubType,
        carry: shots.carryYd,
        total: shots.totalYd,
        reviewStatus: shots.reviewStatus,
        qualityTag: shots.qualityTag,
        shotCategory: shots.shotCategory,
      })
      .from(shots)
      .where(and(eq(shots.userId, userId), eq(shots.sessionId, sessionId)))
      .orderBy(asc(shots.shotNumber)),
    getDb()
      .select({ value: clubs.id, label: clubs.type })
      .from(clubs)
      .where(eq(clubs.userId, userId)),
  ]);
  return (
    <section className="grid gap-3" aria-label="Saved shot review">
      <h2 className="text-lg font-semibold">Review saved shots</h2>
      <p className="text-sm text-muted-foreground">
        Keep, exclude or correct club labels using the saved source evidence. Original measurements
        remain available.
      </p>
      <details className="rounded-xl border bg-card p-3">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">
          {records.length} saved shots · review and correct
        </summary>
        <div className="max-h-[65dvh] overflow-y-auto divide-y">
          {records.map((shot) => {
            const status = effectiveShotReviewStatus({
              reviewStatus: isShotReviewStatus(shot.reviewStatus) ? shot.reviewStatus : "included",
              qualityTag: shot.qualityTag,
              shotCategory: shot.shotCategory,
            });
            return (
              <article key={shot.id} className="grid gap-2 py-4">
                <h3 className="font-medium">
                  Shot {shot.number} · {shot.club}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {shotReviewStatusLabel(status)} · Carry {shot.carry ?? "—"} yd · Total{" "}
                  {shot.total ?? "—"} yd
                </p>
                <div className="flex flex-wrap gap-2">
                  <ShotReviewButton shotId={shot.id} reviewStatus={status} companion />
                  <ShotEvidenceSheet
                    shotId={shot.id}
                    title={`Shot ${shot.number} · ${shot.club}`}
                    clubs={ownedClubs}
                  />
                </div>
              </article>
            );
          })}
          {!records.length && (
            <p className="py-3">No saved shot rows are available for this session.</p>
          )}
        </div>
      </details>
    </section>
  );
}
