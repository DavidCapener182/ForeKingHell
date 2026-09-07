import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { adminAuditLog, users } from "@/db/schema";
import { getAdminOperationsSnapshot, requireAdminUser } from "@/lib/admin";
export async function recordAdminSystemSnapshot() {
  const actor = await requireAdminUser();
  const operations = await getAdminOperationsSnapshot();
  const checkedAt = new Date();
  const [record] = await getDb()
    .insert(adminAuditLog)
    .values({
      actorUserId: actor.userId,
      action: "system_snapshot_checked",
      targetType: "system_snapshot",
      targetId: "stored-operational-records",
      metadataJson: {
        checkedAt: checkedAt.toISOString(),
        scope: "stored operational records",
        operations,
        liveProvidersChecked: false,
      },
    })
    .returning({ id: adminAuditLog.id });
  return { id: record.id, checkedAt: checkedAt.toISOString(), operations };
}
export async function getAdminSystemCheckHistory() {
  await requireAdminUser();
  return getDb()
    .select({
      id: adminAuditLog.id,
      actorUserId: adminAuditLog.actorUserId,
      actorEmail: users.email,
      createdAt: adminAuditLog.createdAt,
      metadataJson: adminAuditLog.metadataJson,
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(users.id, adminAuditLog.actorUserId))
    .where(eq(adminAuditLog.action, "system_snapshot_checked"))
    .orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
    .limit(80);
}
