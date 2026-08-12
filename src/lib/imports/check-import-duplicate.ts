import "server-only";

import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { sessions } from "@/db/schema";
import { MAX_IMPORT_CSV_BYTES, utf8ByteLength } from "@/lib/imports/import-limits";

export async function checkImportDuplicate(userId: string, rawCsvText: string) {
  if (!rawCsvText.trim() || utf8ByteLength(rawCsvText) > MAX_IMPORT_CSV_BYTES) {
    return { duplicate: false as const, sessionId: null };
  }

  const rawCsvHash = createHash("sha256").update(rawCsvText, "utf8").digest("hex");
  const [existing] = await getDb()
    .select({ sessionId: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.rawCsvHash, rawCsvHash)))
    .limit(1);

  return {
    duplicate: Boolean(existing),
    sessionId: existing?.sessionId ?? null,
  };
}
