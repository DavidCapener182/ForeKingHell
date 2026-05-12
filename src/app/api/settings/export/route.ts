import { eq, inArray, or } from "drizzle-orm";

import {
  accountInvitations,
  accountMemberships,
  achievementProgress,
  achievementSyncState,
  ballModels,
  clubEquipmentHistory,
  clubs,
  courses,
  holes,
  importFiles,
  importRows,
  rapsodoSyncSessions,
  sessions,
  shareLinks,
  shots,
  stockYardages,
  strokesGainedShotEvents,
  teeSets,
  userAchievements,
  users,
  xpLedger,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getOptionalCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const db = getDb();
  const [
    profileRows,
    clubRows,
    sessionRows,
    importRowRows,
    importFileRows,
    shotRows,
    stockYardageRows,
    ballModelRows,
    clubEquipmentRows,
    strokesGainedRows,
    achievementRows,
    xpRows,
    progressRows,
    syncStateRows,
    rapsodoRows,
    shareLinkRows,
    membershipRows,
    invitationRows,
    createdCourseRows,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select().from(clubs).where(eq(clubs.userId, userId)),
    db.select().from(sessions).where(eq(sessions.userId, userId)),
    db.select().from(importRows).where(eq(importRows.userId, userId)),
    db.select().from(importFiles).where(eq(importFiles.userId, userId)),
    db.select().from(shots).where(eq(shots.userId, userId)),
    db.select().from(stockYardages).where(eq(stockYardages.userId, userId)),
    db.select().from(ballModels).where(eq(ballModels.userId, userId)),
    db.select().from(clubEquipmentHistory).where(eq(clubEquipmentHistory.userId, userId)),
    db.select().from(strokesGainedShotEvents).where(eq(strokesGainedShotEvents.userId, userId)),
    db.select().from(userAchievements).where(eq(userAchievements.userId, userId)),
    db.select().from(xpLedger).where(eq(xpLedger.userId, userId)),
    db.select().from(achievementProgress).where(eq(achievementProgress.userId, userId)),
    db.select().from(achievementSyncState).where(eq(achievementSyncState.userId, userId)),
    db.select().from(rapsodoSyncSessions).where(eq(rapsodoSyncSessions.userId, userId)),
    db.select().from(shareLinks).where(eq(shareLinks.userId, userId)),
    db
      .select()
      .from(accountMemberships)
      .where(orOwnerOrMember(userId)),
    db
      .select()
      .from(accountInvitations)
      .where(eq(accountInvitations.ownerUserId, userId)),
    db.select().from(courses).where(eq(courses.createdByUserId, userId)),
  ]);

  const courseIds = createdCourseRows.map((course) => course.id);
  const [teeSetRows, holeRows] =
    courseIds.length > 0
      ? await Promise.all([
          db.select().from(teeSets).where(inArray(teeSets.courseId, courseIds)),
          db.select().from(holes).where(inArray(holes.courseId, courseIds)),
        ])
      : [[], []];

  const payload = {
    exportedAt: new Date().toISOString(),
    userId,
    profile: profileRows[0] ?? null,
    data: {
      clubs: clubRows,
      sessions: sessionRows,
      importRows: importRowRows,
      importFiles: importFileRows,
      shots: shotRows,
      stockYardages: stockYardageRows,
      ballModels: ballModelRows,
      clubEquipmentHistory: clubEquipmentRows,
      strokesGainedShotEvents: strokesGainedRows,
      userAchievements: achievementRows,
      xpLedger: xpRows,
      achievementProgress: progressRows,
      achievementSyncState: syncStateRows,
      rapsodoSyncSessions: rapsodoRows,
      shareLinks: shareLinkRows,
      accountMemberships: membershipRows,
      accountInvitations: invitationRows,
      courses: createdCourseRows,
      teeSets: teeSetRows,
      holes: holeRows,
    },
  };

  return Response.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="forekinghell-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

function orOwnerOrMember(userId: string) {
  return or(eq(accountMemberships.ownerUserId, userId), eq(accountMemberships.memberUserId, userId));
}
