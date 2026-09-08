import "server-only";
import { and, asc, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { importFiles, sessions, users } from "@/db/schema";
import { parseImportHistoryQuery, type ImportHistoryParams } from "./import-history-query";

/** The caller supplies the authenticated user ID; every query and linked session is owner-scoped. */
export async function getImportFileHistory(userId: string, params: ImportHistoryParams = {}) {
  const db = getDb();
  const query = parseImportHistoryQuery(params);
  const search = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
  const owner = eq(importFiles.userId, userId);
  const scope = and(
    owner,
    query.status === "active"
      ? ne(importFiles.status, "archived")
      : query.status === "all"
        ? undefined
        : eq(importFiles.status, query.status),
    query.source ? eq(importFiles.source, query.source) : undefined,
    query.q
      ? or(
          ilike(importFiles.fileName, search),
          ilike(importFiles.rawCsvHash, search),
          ilike(importFiles.parseVersion, search),
        )
      : undefined,
  );
  const [[totals], [active], [profile], statuses, sources] = await Promise.all([
    db.select({ count: count() }).from(importFiles).where(scope),
    db
      .select({ count: count() })
      .from(importFiles)
      .where(and(owner, ne(importFiles.status, "archived"))),
    db
      .select({ preferredUnits: users.preferredUnits })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .selectDistinct({ value: importFiles.status })
      .from(importFiles)
      .where(owner)
      .orderBy(importFiles.status),
    db
      .selectDistinct({ value: importFiles.source })
      .from(importFiles)
      .where(owner)
      .orderBy(importFiles.source),
  ]);
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(totals.count / pageSize));
  const rawPage = Array.isArray(params.importPage) ? params.importPage[0] : params.importPage;
  const requested = Number(rawPage || 1);
  const page = Math.min(pages, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  const direction = query.order === "oldest" ? asc : desc;
  const files = await db
    .select({
      id: importFiles.id,
      sessionId: sessions.id,
      source: importFiles.source,
      fileName: importFiles.fileName,
      fileSizeBytes: importFiles.fileSizeBytes,
      rawCsvHash: importFiles.rawCsvHash,
      parseVersion: importFiles.parseVersion,
      status: importFiles.status,
      metadataJson: importFiles.metadataJson,
      createdAt: importFiles.createdAt,
      sessionDate: sessions.date,
      sessionType: sessions.type,
    })
    .from(importFiles)
    .leftJoin(sessions, and(eq(sessions.id, importFiles.sessionId), eq(sessions.userId, userId)))
    .where(scope)
    .orderBy(direction(importFiles.createdAt), direction(importFiles.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return {
    files,
    total: totals.count,
    activeCount: active.count,
    page,
    pages,
    pageSize,
    query,
    statuses: statuses.map((row) => row.value),
    sources: sources.map((row) => row.value),
    preferredDistanceUnit: (profile?.preferredUnits === "metres" ? "meters" : "yards") as
      | "meters"
      | "yards",
  };
}
