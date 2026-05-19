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
import { requireCurrentUserId } from "@/lib/current-user";
import { type SaveRapsodoImportInput, saveRapsodoImport } from "@/lib/imports/save-rapsodo-import";
import { setAchievementUnlockFlash } from "@/lib/achievements/notification-flash";
import { formatClubType } from "@/lib/club-format";
import { parseRapsodoCsv, type ParsedRapsodoShot } from "@/lib/rapsodo/parser";
import { inferRapsodoImportSessionType } from "@/lib/round-sessions";
import { buildRapsodoSyncSessionKey, hashRapsodoExportCsv } from "@/lib/rapsodo/sync-identity";

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string; code?: string };

export async function getRapsodoConnectionStatusAction(): Promise<
  ActionResult<{
    connected: boolean;
    expiresAt: string | null;
    profile: Record<string, unknown> | null;
  }>
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

export async function listRapsodoSessionsAction(
  input: {
    take?: number;
    startDate?: string | null;
    endDate?: string | null;
  } = {},
): Promise<ActionResult<RapsodoSessionListItem[]>> {
  const stored = await getStoredRapsodoToken();

  if (!stored) {
    return {
      ok: false,
      message: "Sign in to R-Cloud before loading sessions.",
      code: "RAPSODO_NOT_CONNECTED",
    };
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
    return {
      ok: false,
      message: "Sign in to R-Cloud before previewing a session.",
      code: "RAPSODO_NOT_CONNECTED",
    };
  }

  try {
    const client = new RapsodoCloudClient();
    const rawCsvText = await client.exportSessionCsv(stored.token, session);
    const parsed = parseRapsodoCsv(rawCsvText, { fallbackDistanceUnit: "yards" });

    if (parsed.shots.length === 0) {
      return {
        ok: false,
        message:
          parsed.warnings[0] ??
          "R-Cloud exported a CSV, but ForeKingHell could not find shot rows.",
      };
    }

    const sessionDate = parsed.exportedAtIso ?? session.dateIso ?? new Date().toISOString();
    const [clubChoices, shotRefs] = await Promise.all([
      getRapsodoClubChoices(client, stored.token),
      client
        .listSessionShotRefs(stored.token, session, Math.max(parsed.shots.length + 20, 100))
        .catch(() => []),
    ]);
    const preferredClubKeyByRowNumber = new Map(
      parsed.shots.map((shot) => [
        shot.rowNumber,
        preferredClubKeyForShotDate(shot, clubChoices, sessionDate),
      ]),
    );
    const suggestions = parsed.shots.map((shot) =>
      suggestRapsodoClub(shot, clubChoices, {
        preferredClubKey: preferredClubKeyByRowNumber.get(shot.rowNumber),
      }),
    );
    const reportedChoices = parsed.shots.map((shot) =>
      reportedRapsodoClubChoice(shot, clubChoices, {
        preferredClubKey: preferredClubKeyByRowNumber.get(shot.rowNumber),
      }),
    );
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
        sessionType: inferRapsodoImportSessionType(session),
        sessionDate,
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
            reportedChoices[index].clubType === "unknown" ||
            reportedChoices[index].clubType === "other"
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
    return {
      ok: false,
      message: "Sign in to R-Cloud before updating Rapsodo clubs.",
      code: "RAPSODO_NOT_CONNECTED",
    };
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
    const updated = await new RapsodoCloudClient().updateShotClubs(
      stored.token,
      input.session,
      validUpdates,
    );

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
      await markRapsodoSessionImported(
        input.session,
        input.importInput.rawCsvText,
        result.sessionId,
      );
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
  const userId = await requireCurrentUserId();
  const now = new Date();

  await ensureCurrentRapsodoUser();
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

  let syncRows = await db
    .select()
    .from(rapsodoSyncSessions)
    .where(eq(rapsodoSyncSessions.userId, userId))
    .orderBy(desc(rapsodoSyncSessions.lastSeenAt));
  const reconciledCount = await reconcileExistingRapsodoImports(syncRows, remoteSessions);

  if (reconciledCount > 0) {
    syncRows = await db
      .select()
      .from(rapsodoSyncSessions)
      .where(eq(rapsodoSyncSessions.userId, userId))
      .orderBy(desc(rapsodoSyncSessions.lastSeenAt));
  }

  const syncByKey = new Map(
    syncRows.map((row) => [
      buildRapsodoSyncSessionKey(row.providerKind, row.providerSessionId),
      row,
    ]),
  );

  return remoteSessions.map((session): RapsodoSessionListItem => {
    const sync = syncByKey.get(
      buildRapsodoSyncSessionKey(session.providerKind, session.providerSessionId),
    );

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
      isNew: !existingKeys.has(
        buildRapsodoSyncSessionKey(session.providerKind, session.providerSessionId),
      ),
    };
  });
}

async function reconcileExistingRapsodoImports(
  syncRows: Array<typeof rapsodoSyncSessions.$inferSelect>,
  remoteSessions: RapsodoCloudSession[],
) {
  const unlinkedRows = syncRows.filter((row) => !row.importedSessionId);

  if (unlinkedRows.length === 0) {
    return 0;
  }

  const db = getDb();
  const userId = await requireCurrentUserId();
  const remoteByKey = new Map(
    remoteSessions.map((session) => [
      buildRapsodoSyncSessionKey(session.providerKind, session.providerSessionId),
      session,
    ]),
  );
  const importedRows = await db
    .select({
      id: sessions.id,
      type: sessions.type,
      date: sessions.date,
      courseName: sessions.courseName,
      fileName: sessions.fileName,
      rawCsvHash: sessions.rawCsvHash,
      rawCsvText: sessions.rawCsvText,
      shotCount: sql<number>`count(${shots.id})::int`,
    })
    .from(sessions)
    .leftJoin(shots, eq(shots.sessionId, sessions.id))
    .where(and(eq(sessions.userId, userId), eq(sessions.source, "rapsodo")))
    .groupBy(sessions.id);

  if (importedRows.length === 0) {
    return 0;
  }

  const importedByHash = new Map<string, (typeof importedRows)[number]>();

  for (const row of importedRows) {
    const hash = row.rawCsvHash ?? hashRapsodoExportCsv(row.rawCsvText);
    importedByHash.set(hash, row);
  }

  const usedImportedIds = new Set(
    syncRows.map((row) => row.importedSessionId).filter((id): id is string => Boolean(id)),
  );
  const links: Array<{
    providerKind: string;
    providerSessionId: string;
    importedSessionId: string;
  }> = [];

  for (const sync of unlinkedRows) {
    const remote = remoteByKey.get(
      buildRapsodoSyncSessionKey(sync.providerKind, sync.providerSessionId),
    );
    const hashMatch = sync.exportRawCsvHash ? importedByHash.get(sync.exportRawCsvHash) : null;
    const match =
      hashMatch && !usedImportedIds.has(hashMatch.id)
        ? hashMatch
        : findExistingRapsodoImportMatch(sync, remote, importedRows, usedImportedIds);

    if (!match) {
      continue;
    }

    usedImportedIds.add(match.id);
    links.push({
      providerKind: sync.providerKind,
      providerSessionId: sync.providerSessionId,
      importedSessionId: match.id,
    });
  }

  if (links.length === 0) {
    return 0;
  }

  const now = new Date();

  for (const link of links) {
    await db
      .update(rapsodoSyncSessions)
      .set({
        importedSessionId: link.importedSessionId,
        lastImportedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(rapsodoSyncSessions.userId, userId),
          eq(rapsodoSyncSessions.providerKind, link.providerKind),
          eq(rapsodoSyncSessions.providerSessionId, link.providerSessionId),
        ),
      );
  }

  return links.length;
}

function findExistingRapsodoImportMatch(
  sync: typeof rapsodoSyncSessions.$inferSelect,
  remote: RapsodoCloudSession | undefined,
  importedRows: Array<{
    id: string;
    type: string;
    date: Date;
    courseName: string | null;
    fileName: string | null;
    rawCsvHash: string | null;
    rawCsvText: string;
    shotCount: number;
  }>,
  usedImportedIds: Set<string>,
) {
  const remoteDate = sync.sessionDate;

  if (!remoteDate) {
    return null;
  }

  const remoteShotCount =
    remote?.shotCount ?? numberFromMetadata(sync.rawMetadataJson, "numberOfShots");
  const remoteTitle = remote?.courseName ?? sync.title ?? "";
  const isCourse = isRapsodoCourseSync(sync, remote);
  const candidates = importedRows.filter((row) => {
    if (usedImportedIds.has(row.id)) {
      return false;
    }

    if (!dateMatchesRemote(row, remoteDate)) {
      return false;
    }

    if (isCourse) {
      return row.type === "simulated_course" && courseNamesLikelyMatch(remoteTitle, row.courseName);
    }

    if (
      row.type === "simulated_course" ||
      remoteShotCount === null ||
      row.shotCount !== remoteShotCount
    ) {
      return false;
    }

    return (
      minutesBetween(row.date, remoteDate) <= 10 || fileNameDateMatches(row.fileName, remoteDate)
    );
  });

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort(
    (left, right) => matchDistance(left, remoteDate) - matchDistance(right, remoteDate),
  )[0];
}

function isRapsodoCourseSync(
  sync: Pick<
    typeof rapsodoSyncSessions.$inferSelect,
    "providerKind" | "providerSessionMode" | "providerSessionType" | "title"
  >,
  remote: RapsodoCloudSession | undefined,
) {
  return [
    remote?.providerSessionMode,
    remote?.providerSessionType,
    remote?.title,
    sync.providerSessionMode,
    sync.providerSessionType,
    sync.title,
  ]
    .join(" ")
    .toLowerCase()
    .includes("course");
}

function numberFromMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function dateMatchesRemote(row: { date: Date; fileName: string | null }, remoteDate: Date) {
  return sameDate(row.date, remoteDate) || fileNameDateMatches(row.fileName, remoteDate);
}

function fileNameDateMatches(fileName: string | null, remoteDate: Date) {
  const fileDate = fileNameDate(fileName);
  return fileDate ? sameDate(fileDate, remoteDate) : false;
}

function fileNameDate(fileName: string | null) {
  const match = fileName?.match(/(?:^|_)(\d{2})(\d{2})(\d{2})(?:[-.]|$)/);

  if (!match) {
    return null;
  }

  const [, monthText, dayText, yearText] = match;
  const year = 2000 + Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDate(left: Date, right: Date) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function minutesBetween(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / 60000;
}

function matchDistance(row: { date: Date; fileName: string | null }, remoteDate: Date) {
  const directMinutes = minutesBetween(row.date, remoteDate);
  return fileNameDateMatches(row.fileName, remoteDate)
    ? Math.min(directMinutes, 60 * 24)
    : directMinutes;
}

function courseNamesLikelyMatch(remoteName: string, localName: string | null) {
  const remoteTokens = courseNameTokens(remoteName);
  const localTokens = courseNameTokens(localName ?? "");

  if (remoteTokens.length === 0 || localTokens.length === 0) {
    return false;
  }

  const localSet = new Set(localTokens);
  const sharedTokens = remoteTokens.filter((token) => localSet.has(token));

  return sharedTokens.length >= Math.min(2, remoteTokens.length);
}

function courseNameTokens(value: string) {
  const stopWords = new Set([
    "the",
    "players",
    "course",
    "club",
    "golf",
    "white",
    "centre",
    "center",
    "and",
  ]);

  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

async function getRapsodoClubChoices(
  client: RapsodoCloudClient,
  token: string,
): Promise<RapsodoClubChoice[]> {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [clubRows, stockRows, clubDateRows, rapsodoBagClubs] = await Promise.all([
    db
      .select({
        id: clubs.id,
        type: clubs.type,
        brand: clubs.brand,
        model: clubs.model,
        normalizedClubKey: clubs.normalizedClubKey,
        active: clubs.active,
      })
      .from(clubs)
      .where(eq(clubs.userId, userId)),
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
    db
      .select({
        clubId: shots.clubId,
        firstShotAt: sql<Date | null>`min(${shots.shotAt})`,
        lastShotAt: sql<Date | null>`max(${shots.shotAt})`,
      })
      .from(shots)
      .where(eq(shots.userId, userId))
      .groupBy(shots.clubId),
    client.listBagClubs(token).catch(() => []),
  ]);
  const latestStockByClubId = new Map<string, (typeof stockRows)[number]>();
  const shotDatesByClubId = new Map(clubDateRows.map((row) => [row.clubId, row]));

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
  const localChoices = clubRows
    .map((club) => {
      const latestStock = latestStockByClubId.get(club.id);
      const shotDates = shotDatesByClubId.get(club.id);
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
        active: club.active,
        firstShotAt: timestampToIso(shotDates?.firstShotAt),
        lastShotAt: timestampToIso(shotDates?.lastShotAt),
        stockCarryYd: latestStock ? latestStock.carryMedianYd : calculatedStock.carryMedianYd,
        stockTotalYd: latestStock ? latestStock.totalMedianYd : calculatedStock.totalMedianYd,
        averageBallSpeedMph:
          ballSpeedValues.length === 0
            ? null
            : Math.round(
                (ballSpeedValues.reduce((total, value) => total + value, 0) /
                  ballSpeedValues.length) *
                  10,
              ) / 10,
        sampleSize: latestStock ? latestStock.sampleSize : calculatedStock.sampleSize,
        rapsodoClubId: rapsodoClubIdFor(
          club.normalizedClubKey,
          club.type,
          rapsodoClubByExactKey,
          rapsodoClubsByType,
        ),
      };
    })
    .sort(
      (left, right) =>
        Number(right.active ?? false) - Number(left.active ?? false) ||
        left.clubLabel.localeCompare(right.clubLabel),
    );

  const localKeys = new Set(localChoices.map((choice) => choice.clubKey));
  const rapsodoOnlyChoices = rapsodoBagClubs
    .filter((club) => !localKeys.has(club.clubKey))
    .map(
      (club): RapsodoClubChoice => ({
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
      }),
    );

  return uniqueClubChoices([...localChoices, ...rapsodoOnlyChoices]);
}

function preferredClubKeyForShotDate(
  shot: ParsedRapsodoShot,
  choices: RapsodoClubChoice[],
  sessionDateIso: string,
) {
  if (
    shot.clubBrand ||
    shot.clubModel ||
    shot.clubType === "unknown" ||
    shot.clubType === "other"
  ) {
    return null;
  }

  const sessionTime = dateOnlyTimestamp(sessionDateIso);

  if (sessionTime === null) {
    return null;
  }

  const sameTypeChoices = choices.filter(
    (choice) => choice.clubType === shot.clubType && (choice.firstShotAt || choice.lastShotAt),
  );

  if (sameTypeChoices.length <= 1) {
    return null;
  }

  const best = sameTypeChoices
    .map((choice) => ({
      choice,
      distanceDays: clubDateDistanceDays(choice, sessionTime),
    }))
    .filter((entry) => Number.isFinite(entry.distanceDays))
    .sort(
      (left, right) =>
        left.distanceDays - right.distanceDays ||
        Number(right.choice.active ?? false) - Number(left.choice.active ?? false) ||
        right.choice.sampleSize - left.choice.sampleSize,
    )[0];

  return best?.choice.clubKey ?? null;
}

function clubDateDistanceDays(choice: RapsodoClubChoice, sessionTime: number) {
  const firstShotTime = dateOnlyTimestamp(choice.firstShotAt);
  const lastShotTime = dateOnlyTimestamp(choice.lastShotAt);

  if (firstShotTime !== null && sessionTime < firstShotTime) {
    return (firstShotTime - sessionTime) / 86_400_000;
  }

  if (lastShotTime !== null && sessionTime > lastShotTime) {
    return (sessionTime - lastShotTime) / 86_400_000;
  }

  return 0;
}

function dateOnlyTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function timestampToIso(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function updateRapsodoExportHash(session: RapsodoSessionListItem, rawCsvHash: string) {
  const db = getDb();
  const userId = await requireCurrentUserId();
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
  const userId = await requireCurrentUserId();
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

async function ensureCurrentRapsodoUser() {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const now = new Date();

  await db
    .insert(users)
    .values({
      id: userId,
      preferredUnits: "yards",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        updatedAt: now,
      },
    });
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
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? (value ?? null) : null;
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
  const byShotNumber =
    shotNumber === null ? null : shotRefs.find((ref) => ref.shotNumber === shotNumber);
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
      message:
        "The Rapsodo sync database table is missing. Run npm run db:migrate, then load sessions again.",
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

  return (
    /fkh_rapsodo_sync_sessions/i.test(error.message) &&
    /does not exist|failed query/i.test(error.message)
  );
}

function excluded(columnName: string) {
  return sql.raw(`excluded.${columnName}`);
}
