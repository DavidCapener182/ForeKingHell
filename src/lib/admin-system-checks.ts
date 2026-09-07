import "server-only";
import { count, desc, eq } from "drizzle-orm";
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
export async function getAdminSystemCheckHistory(requestedPage: string | number = 1) {
  await requireAdminUser();
  const db = getDb();
  const [result] = await db
    .select({ total: count() })
    .from(adminAuditLog)
    .where(eq(adminAuditLog.action, "system_snapshot_checked"));
  const total = result.total;
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number(requestedPage);
  const page = Math.min(pages, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  const records = await db
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
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { records, total, page, pages };
}
