"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";

import { clubs, rapsodoSyncSessions, sessions, shots, stockYardages, users } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  RapsodoCloudClient,
  RapsodoCloudError,
  type RapsodoCloudSession,
} from "@/lib/rapsodo/cloud-client";
import {
  reportedRapsodoClubChoice,
  suggestRapsodoClub,
  uniqueClubChoices,
  type RapsodoClubChoice,
} from "@/lib/rapsodo/club-inference";
import type { RapsodoSessionListItem, RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";
import {
  clearStoredRapsodoToken,
  getStoredRapsodoToken,
  setStoredRapsodoToken,
} from "@/lib/rapsodo/token-cookie";
import { calculateStockYardage } from "@/lib/stock-yardage";
import { getDefaultUserId } from "@/lib/current-user";
import {
  type SaveRapsodoImportInput,
  saveRapsodoImport,
} from "@/lib/imports/save-rapsodo-import";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { formatClubType } from "@/lib/club-format";
import { parseRapsodoCsv } from "@/lib/rapsodo/parser";
import { buildRapsodoSyncSessionKey, hashRapsodoExportCsv } from "@/lib/rapsodo/sync-identity";

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string; code?: string };

export async function getRapsodoConnectionStatusAction(): Promise<
  ActionResult<{ connected: boolean; expiresAt: string | null; profile: Record<string, unknown> | null }>
> {
  const stored = await getStoredRapsodoToken();

  return {
    ok: true,
    data: {
      connected: Boolean(stored),
      expiresAt: stored ? new Date(stored.expiresAt).toISOString() : null,
      profile: stored?.profile ?? null,
    },
  };
}

export async function loginRapsodoAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ connected: boolean; profile: Record<string, unknown> | null }>> {
  const email = input.email.trim();
  const password = input.password;

  if (!email || !password) {
    return { ok: false, message: "Enter your Rapsodo email and password." };
  }

  try {
    const result = await new RapsodoCloudClient().login(email, password);
    await setStoredRapsodoToken(result.token, result.profile);
    revalidatePath("/rapsodo");

    return {
      ok: true,
      data: {
        connected: true,
        profile: result.profile,
      },
    };
  } catch (error) {
    return rapsodoActionError(error, "R-Cloud login failed. Check the credentials and try again.");
  }
}

export async function disconnectRapsodoAction(): Promise<ActionResult<{ connected: boolean }>> {
  await clearStoredRapsodoToken();
  revalidatePath("/rapsodo");
  return { ok: true, data: { connected: false } };
}

export async function listRapsodoSessionsAction(input: {
  take?: number;
  startDate?: string | null;
  endDate?: string | null;
} = {}): Promise<ActionResult<RapsodoSessionListItem[]>> {
  const stored = await getStoredRapsodoToken();

  if (!stored) {
    return { ok: false, message: "Sign in to R-Cloud before loading sessions.", code: "RAPSODO_NOT_CONNECTED" };
  }

  try {
    const remoteSessions = await new RapsodoCloudClient().listSessions(stored.token, {
      take: Math.min(Math.max(input.take ?? 50, 1), 100),
      startDate: dateOnly(input.startDate),
      endDate: dateOnly(input.endDate),
    });
    const rows = await upsertRapsodoSyncSessions(remoteSessions);

    return { ok: true, data: rows };
  } catch (error) {
    if (isAuthError(error)) {
      await clearStoredRapsodoToken();
    }

    return rapsodoActionError(
      error,
      "R-Cloud sessions could not be loaded. You can still export CSV files manually and import them from /import.",
    );
  }
}

export async function previewRapsodoSessionAction(
  session: RapsodoSessionListItem,
): Promise<ActionResult<RapsodoSessionPreview>> {
  const stored = await getStoredRapsodoToken();

  if (!stored) {
    return { ok: false, message: "Sign in to R-Cloud before previewing a session.", code: "RAPSODO_NOT_CONNECTED" };
  }

  try {
    const client = new RapsodoCloudClient();
    const rawCsvText = await client.exportSessionCsv(stored.token, session);
    const parsed = parseRapsodoCsv(rawCsvText, { fallbackDistanceUnit: "yards" });

    if (parsed.shots.length === 0) {
      return {
        ok: false,
        message: parsed.warnings[0] ?? "R-Cloud exported a CSV, but ForeKingHell could not find shot rows.",
      };
    }

    const [clubChoices, shotRefs] = await Promise.all([
      getRapsodoClubChoices(client, stored.token),
      client
        .listSessionShotRefs(stored.token, session, Math.max(parsed.shots.length + 20, 100))
        .catch(() => []),
    ]);
    const suggestions = parsed.shots.map((shot) => suggestRapsodoClub(shot, clubChoices));
    const reportedChoices = parsed.shots.map((shot) => reportedRapsodoClubChoice(shot, clubChoices));
    const allChoices = uniqueClubChoices([
      ...clubChoices,
      ...reportedChoices,
      ...suggestions.map((suggestion) => suggestion.choice),
    ]);
    const rawCsvHash = hashRapsodoExportCsv(rawCsvText);
    await updateRapsodoExportHash(session, rawCsvHash);

    return {
      ok: true,
      data: {
        session,
        rawCsvText,
        fileName: buildRapsodoFileName(session),
        fileSizeBytes: byteLength(rawCsvText),
        rawCsvHash,
        distanceUnit: parsed.appliedDistanceUnit,
        sessionType: inferForeKingHellSessionType(session),
        sessionDate: parsed.exportedAtIso ?? session.dateIso ?? new Date().toISOString(),
        courseName: session.courseName ?? "",
        warnings: parsed.warnings,
        shotCount: parsed.shotCount,
        rawRowCount: parsed.rawRows.length,
        shots: parsed.shots.map((shot, index) => ({
          rowNumber: shot.rowNumber,
          shotNumber: shot.shotNumber,
          reportedClubLabel: shot.clubLabel,
          reportedClubType: shot.clubType,
          carryYd: shot.carryYd,
          totalYd: shot.totalYd,
          ballSpeedMph: shot.ballSpeedMph,
          launchAngleDeg: shot.launchAngleDeg,
          sideCarryYd: shot.sideCarryYd,
          rapsodoShotId: rapsodoShotIdFor(shot.shotNumber, index, shotRefs),
          reportedChoice:
            reportedChoices[index].clubType === "unknown" || reportedChoices[index].clubType === "other"
              ? null
              : reportedChoices[index],
          suggestion: suggestions[index],
        })),
        clubChoices: allChoices,
      },
    };
  } catch (error) {
    if (isAuthError(error)) {
      await clearStoredRapsodoToken();
    }

    return rapsodoActionError(
      error,
      "R-Cloud could not export that session. Export the CSV manually from R-Cloud and use /import if this keeps happening.",
    );
  }
}

export async function syncRapsodoShotClubsAction(input: {
  session: RapsodoSessionListItem;
  updates: Array<{
    rowNumber: number;
    rapsodoShotId: string | null;
    rapsodoClubId: string | null;
    clubLabel: string;
  }>;
}): Promise<ActionResult<{ attempted: number; updated: number; skipped: number }>> {
  const stored = await getStoredRapsodoToken();

  if (!stored) {
    return { ok: false, message: "Sign in to R-Cloud before updating Rapsodo clubs.", code: "RAPSODO_NOT_CONNECTED" };
  }

  const validUpdates = input.updates
    .map((update) => ({
      rapsodoShotId: update.rapsodoShotId?.trim() ?? "",
      rapsodoClubId: update.rapsodoClubId?.trim() ?? "",
    }))
    .filter((update) => update.rapsodoShotId && update.rapsodoClubId);

  if (validUpdates.length === 0) {
    return {
      ok: true,
      data: {
        attempted: input.updates.length,
        updated: 0,
        skipped: input.updates.length,
      },
    };
  }

  try {
    const updated = await new RapsodoCloudClient().updateShotClubs(stored.token, input.session, validUpdates);

    return {
      ok: true,
      data: {
        attempted: input.updates.length,
        updated,
        skipped: Math.max(0, input.updates.length - updated),
      },
    };
  } catch (error) {
    if (isAuthError(error)) {
      await clearStoredRapsodoToken();
    }

    return rapsodoActionError(
      error,
      "R-Cloud could not update those clubs. Save with ForeKingHell recommendations or update the clubs in Rapsodo manually.",
    );
  }
}

export async function importRapsodoSessionAction(input: {
  session: RapsodoSessionListItem;
  importInput: SaveRapsodoImportInput;
}): Promise<ActionResult<Awaited<ReturnType<typeof saveRapsodoImport>>>> {
  try {
    const result = await saveRapsodoImport(input.importInput);

    if (result.ok) {
      await setAchievementUnlockFlash(result.achievementUnlockNotifications);
      await markRapsodoSessionImported(input.session, input.importInput.rawCsvText, result.sessionId);
      revalidatePath("/rapsodo");
    }

    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Rapsodo session import failed.",
    };
  }
}

async function upsertRapsodoSyncSessions(remoteSessions: RapsodoCloudSession[]) {
  const db = getDb();
  const userId = getDefaultUserId();
  const now = new Date();

  await ensureDefaultUser();
  const existingRows = await db
    .select({
      providerKind: rapsodoSyncSessions.providerKind,
      providerSessionId: rapsodoSyncSessions.providerSessionId,
    })
    .from(rapsodoSyncSessions)
    .where(eq(rapsodoSyncSessions.userId, userId));
  const existingKeys = new Set(
    existingRows.map((row) => buildRapsodoSyncSessionKey(row.providerKind, row.providerSessionId)),
  );

  if (remoteSessions.length > 0) {
    await db
      .insert(rapsodoSyncSessions)
      .values(
        remoteSessions.map((session) => ({
          userId,
          providerKind: session.providerKind,
          providerSessionId: session.providerSessionId,
          providerSessionType: session.providerSessionType,
          providerSessionMode: session.providerSessionMode,
          sessionDate: parseOptionalDate(session.dateIso),
          title: session.title.slice(0, 260),
          rawMetadataJson: session.raw,
          lastSeenAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [
          rapsodoSyncSessions.userId,
          rapsodoSyncSessions.providerKind,
          rapsodoSyncSessions.providerSessionId,
        ],
        set: {
          providerSessionType: excluded("provider_session_type"),
          providerSessionMode: excluded("provider_session_mode"),
          sessionDate: excluded("session_date"),
          title: excluded("title"),
          rawMetadataJson: excluded("raw_metadata_json"),
          lastSeenAt: now,
          updatedAt: now,
        },
      });
  }

  const syncRows = await db
    .select()
    .from(rapsodoSyncSessions)
    .where(eq(rapsodoSyncSessions.userId, userId))
    .orderBy(desc(rapsodoSyncSessions.lastSeenAt));
  const syncByKey = new Map(
    syncRows.map((row) => [buildRapsodoSyncSessionKey(row.providerKind, row.providerSessionId), row]),
  );

  return remoteSessions.map((session): RapsodoSessionListItem => {
    const sync = syncByKey.get(buildRapsodoSyncSessionKey(session.providerKind, session.providerSessionId));

    return {
      providerKind: session.providerKind,
      providerSessionId: session.providerSessionId,
      providerSessionType: session.providerSessionType,
      providerSessionMode: session.providerSessionMode,
      title: session.title,
      dateIso: session.dateIso,
      shotCount: session.shotCount,
      courseName: session.courseName,
      importedSessionId: sync?.importedSessionId ?? null,
      exportRawCsvHash: sync?.exportRawCsvHash ?? null,
      lastImportedAt: sync?.lastImportedAt?.toISOString() ?? null,
      firstSeenAt: sync?.createdAt?.toISOString() ?? null,
      lastSeenAt: sync?.lastSeenAt?.toISOString() ?? null,
      isNew: !existingKeys.has(buildRapsodoSyncSessionKey(session.providerKind, session.providerSessionId)),
    };
  });
}

async function getRapsodoClubChoices(client: RapsodoCloudClient, token: string): Promise<RapsodoClubChoice[]> {
  const db = getDb();
  const userId = getDefaultUserId();
  const [clubRows, stockRows, rapsodoBagClubs] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
        normalizedClubKey: clubs.normalizedClubKey,
      })
      .from(clubs)
      .where(and(eq(clubs.userId, userId), eq(clubs.active, true))),
    db
      .select({
        clubId: stockYardages.clubId,
        sampleSize: stockYardages.sampleSize,
        carryMedianYd: stockYardages.carryMedianYd,
        totalMedianYd: stockYardages.totalMedianYd,
        calculatedAt: stockYardages.calculatedAt,
      })
      .from(stockYardages)
      .where(eq(stockYardages.userId, userId))
      .orderBy(desc(stockYardages.calculatedAt)),
    client.listBagClubs(token).catch(() => []),
  ]);
  const latestStockByClubId = new Map<string, (typeof stockRows)[number]>();

  for (const stock of stockRows) {
    if (!latestStockByClubId.has(stock.clubId)) {
      latestStockByClubId.set(stock.clubId, stock);
    }
  }

  const recentShotRows = await db
    .select({
      clubId: shots.clubId,
      clubType: shots.clubType,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: shots.sideCarryYd,
      ballSpeedMph: shots.ballSpeedMph,
      launchAngleDeg: shots.launchAngleDeg,
      courseHoleNumber: shots.courseHoleNumber,
      sessionType: sessions.type,
      shotCategory: shots.shotCategory,
      qualityTag: shots.qualityTag,
      shotAt: shots.shotAt,
    })
    .from(shots)
    .innerJoin(sessions, eq(shots.sessionId, sessions.id))
    .where(and(eq(shots.userId, userId), eq(sessions.userId, userId)))
    .orderBy(desc(shots.shotAt))
    .limit(1200);
  const recentShotsByClubId = groupBy(recentShotRows, (shot) => shot.clubId);

  const rapsodoClubByExactKey = new Map(rapsodoBagClubs.map((club) => [club.clubKey, club]));
  const rapsodoClubsByType = groupBy(rapsodoBagClubs, (club) => club.clubType);
  const localChoices = clubRows.map((club) => {
    const latestStock = latestStockByClubId.get(club.id);
    const calculatedStock = calculateStockYardage(recentShotsByClubId.get(club.id) ?? [], 50, {
      clubType: club.type,
    });
    const stockShots = recentShotsByClubId.get(club.id) ?? [];
    const ballSpeedValues = stockShots
      .map((shot) => shot.ballSpeedMph)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    return {
      clubKey: club.normalizedClubKey,
      clubType: club.type,
      clubLabel: formatClubType(club.type),
      clubBrand: club.brand,
      clubModel: club.model,
      stockCarryYd: latestStock ? latestStock.carryMedianYd : calculatedStock.carryMedianYd,
      stockTotalYd: latestStock ? latestStock.totalMedianYd : calculatedStock.totalMedianYd,
      averageBallSpeedMph:
        ballSpeedValues.length === 0
          ? null
          : Math.round((ballSpeedValues.reduce((total, value) => total + value, 0) / ballSpeedValues.length) * 10) /
            10,
      sampleSize: latestStock ? latestStock.sampleSize : calculatedStock.sampleSize,
      rapsodoClubId: rapsodoClubIdFor(club.normalizedClubKey, club.type, rapsodoClubByExactKey, rapsodoClubsByType),
    };
  });

  const localKeys = new Set(localChoices.map((choice) => choice.clubKey));
  const rapsodoOnlyChoices = rapsodoBagClubs
    .filter((club) => !localKeys.has(club.clubKey))
    .map((club): RapsodoClubChoice => ({
      clubKey: club.clubKey,
      clubType: club.clubType,
      clubLabel: club.clubLabel,
      clubBrand: club.clubBrand,
      clubModel: club.clubModel,
      stockCarryYd: null,
      stockTotalYd: null,
      averageBallSpeedMph: null,
      sampleSize: 0,
      rapsodoClubId: club.rapsodoClubId,
    }));

  return uniqueClubChoices([...localChoices, ...rapsodoOnlyChoices]);
}

async function updateRapsodoExportHash(session: RapsodoSessionListItem, rawCsvHash: string) {
  const db = getDb();
  const userId = getDefaultUserId();
  const now = new Date();

  await db
    .update(rapsodoSyncSessions)
    .set({ exportRawCsvHash: rawCsvHash, updatedAt: now })
    .where(
      and(
        eq(rapsodoSyncSessions.userId, userId),
        eq(rapsodoSyncSessions.providerKind, session.providerKind),
        eq(rapsodoSyncSessions.providerSessionId, session.providerSessionId),
      ),
    );
}

async function markRapsodoSessionImported(
  session: RapsodoSessionListItem,
  rawCsvText: string,
  importedSessionId: string,
) {
  const db = getDb();
  const userId = getDefaultUserId();
  const now = new Date();

  await db
    .update(rapsodoSyncSessions)
    .set({
      exportRawCsvHash: hashRapsodoExportCsv(rawCsvText),
      importedSessionId,
      lastImportedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(rapsodoSyncSessions.userId, userId),
        eq(rapsodoSyncSessions.providerKind, session.providerKind),
        eq(rapsodoSyncSessions.providerSessionId, session.providerSessionId),
      ),
    );
}

async function ensureDefaultUser() {
  const db = getDb();
  const userId = getDefaultUserId();
  const now = new Date();

  await db
    .insert(users)
    .values({
      id: userId,
      email: "single-user@forekinghell.local",
      name: "ForeKingHell Player",
      preferredUnits: "yards",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        preferredUnits: "yards",
        updatedAt: now,
      },
    });
}

function inferForeKingHellSessionType(
  session: Pick<RapsodoSessionListItem, "providerKind" | "providerSessionMode" | "providerSessionType" | "title">,
) {
  const descriptor = [session.providerSessionMode, session.providerSessionType, session.title].join(" ").toLowerCase();

  if (session.providerKind === "simulation" && /course|courses/.test(descriptor)) {
    return "simulated_course";
  }

  if (session.providerKind === "simulation") {
    return "simulator";
  }

  return "range";
}

function buildRapsodoFileName(session: RapsodoSessionListItem) {
  const date = session.dateIso?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const title = session.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `rapsodo-cloud-${title || session.providerSessionId}-${date}.csv`;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function dateOnly(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value ?? null : null;
}

function parseOptionalDate(value: string | null) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function rapsodoShotIdFor(
  shotNumber: number | null,
  index: number,
  shotRefs: Array<{ rapsodoShotId: string; shotNumber: number | null; sequenceIndex: number }>,
) {
  const byShotNumber = shotNumber === null ? null : shotRefs.find((ref) => ref.shotNumber === shotNumber);
  return byShotNumber?.rapsodoShotId ?? shotRefs[index]?.rapsodoShotId ?? null;
}

function rapsodoClubIdFor(
  clubKey: string,
  clubType: string,
  byExactKey: Map<string, { rapsodoClubId: string }>,
  byType: Map<string, Array<{ rapsodoClubId: string }>>,
) {
  const exact = byExactKey.get(clubKey);

  if (exact) {
    return exact.rapsodoClubId;
  }

  const sameType = byType.get(clubType);
  return sameType?.length === 1 ? sameType[0].rapsodoClubId : null;
}

function groupBy<T, K>(values: T[], keyFn: (value: T) => K) {
  const grouped = new Map<K, T[]>();

  for (const value of values) {
    const key = keyFn(value);
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }

  return grouped;
}

function isAuthError(error: unknown) {
  return error instanceof RapsodoCloudError && (error.status === 401 || error.status === 403);
}

function rapsodoActionError(error: unknown, fallback: string): ActionResult<never> {
  if (error instanceof RapsodoCloudError) {
    return { ok: false, message: error.message || fallback, code: error.code };
  }

  if (isMissingRapsodoSyncMigrationError(error)) {
    return {
      ok: false,
      message: "The Rapsodo sync database table is missing. Run npm run db:migrate, then load sessions again.",
      code: "RAPSODO_SYNC_MIGRATION_MISSING",
    };
  }

  return {
    ok: false,
    message: error instanceof Error ? error.message : fallback,
  };
}

function isMissingRapsodoSyncMigrationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /fkh_rapsodo_sync_sessions/i.test(error.message) && /does not exist|failed query/i.test(error.message);
}

function excluded(columnName: string) {
  return sql.raw(`excluded.${columnName}`);
}
