import "server-only";

import { eq, sql } from "drizzle-orm";

import {
  courses,
  teeSets,
  tournamentEntries,
  tournamentRounds,
  tournamentSubmissions,
  tournaments,
  userProfiles,
  users,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getScheduledTournamentSet } from "@/lib/tournament-calendar";
import { ensureScheduledTournaments, recalculateTournamentStandings } from "@/lib/tournaments";

const ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";
const ESPN_EVENT_DETAIL_URL = "https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events";
const ROUND_COUNT = 4;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type TourCalendarSelection = {
  event: EspnCalendarEvent;
  kind: "weekly" | "monthly";
  scheduledKey: string;
  startsAt: Date;
  endsAt: Date;
};

type ParsedTourScore = {
  externalAthleteId: string;
  playerName: string;
  position: number | null;
  totalScore: string | null;
  roundScores: Array<{
    roundNumber: number;
    grossScore: number;
    displayScore: string | null;
  }>;
};

type SyncResult = {
  selectedEvents: Array<{
    eventId: string;
    name: string;
    kind: "weekly" | "monthly";
    tournamentId: string;
    matchedPlayers: number;
    importedScores: number;
    availableScores: number;
  }>;
  fallbackScheduled: boolean;
};

type EspnScoreboard = {
  leagues?: Array<{
    calendar?: EspnCalendarEvent[];
  }>;
  events?: EspnScoreboardEvent[];
};

type EspnCalendarEvent = {
  id?: string;
  label?: string;
  startDate?: string;
  endDate?: string;
};

type EspnScoreboardEvent = {
  id?: string;
  name?: string;
  shortName?: string;
  date?: string;
  competitions?: EspnCompetition[];
  status?: EspnStatus;
};

type EspnCompetition = {
  id?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  competitors?: EspnCompetitor[];
  status?: EspnStatus;
};

type EspnStatus = {
  period?: number;
  type?: {
    state?: string;
    completed?: boolean;
    description?: string;
    detail?: string;
    shortDetail?: string;
  };
};

type EspnCompetitor = {
  id?: string;
  order?: number;
  score?: string;
  athlete?: {
    displayName?: string;
    fullName?: string;
    shortName?: string;
  };
  linescores?: EspnLineScore[];
};

type EspnLineScore = {
  value?: number;
  displayValue?: string;
  period?: number;
};

type EspnEventDetail = {
  id?: string;
  name?: string;
  shortName?: string;
  date?: string;
  endDate?: string;
  courses?: Array<{
    id?: string;
    name?: string;
    address?: {
      city?: string;
      state?: string;
      country?: string;
    };
  }>;
  primary?: boolean;
  isSignature?: boolean;
};

type TourEventRecord = {
  id: string;
  name: string;
  shortName: string;
  startDate: Date;
  endDate: Date;
  courseName: string;
  country: string | null;
  isMajor: boolean;
  statusDetail: string | null;
};

export async function syncTourEventLeaderboards(now = new Date()): Promise<SyncResult> {
  const scoreboard = await fetchEspnScoreboard();
  const selections = pickTourCalendarEvents(scoreboard.leagues?.[0]?.calendar ?? [], now);
  const systemUserId = await getSystemUserId();

  if (selections.length === 0) {
    await ensureScheduledTournaments(systemUserId, getScheduledTournamentSet(now));

    return {
      selectedEvents: [],
      fallbackScheduled: true,
    };
  }

  const selectedEvents: SyncResult["selectedEvents"] = [];

  for (const selection of selections) {
    const eventId = selection.event.id;

    if (!eventId) {
      continue;
    }

    const eventScoreboard = await fetchEspnScoreboard(parseDate(selection.event.startDate) ?? now);
    const scoreboardEvent =
      eventScoreboard.events?.find((event) => event.id === eventId) ??
      scoreboard.events?.find((event) => event.id === eventId) ??
      null;
    const eventDetail = await fetchEspnEventDetail(eventId);
    const tourEvent = toTourEventRecord(selection, scoreboardEvent, eventDetail);
    const { tournament } = await upsertTourTournament(systemUserId, selection, tourEvent);
    const scoreRows = parseEspnTourScores(scoreboardEvent);
    const scoreSummary = await importTourScores(tournament.id, tourEvent, scoreRows);

    selectedEvents.push({
      eventId,
      name: tourEvent.name,
      kind: selection.kind,
      tournamentId: tournament.id,
      matchedPlayers: scoreSummary.matchedPlayers,
      importedScores: scoreSummary.importedScores,
      availableScores: scoreSummary.availableScores,
    });
  }

  return {
    selectedEvents,
    fallbackScheduled: false,
  };
}

export function pickTourCalendarEvents(calendar: EspnCalendarEvent[], now = new Date()): TourCalendarSelection[] {
  const monthStart = startOfUtcMonth(now);
  const monthEnd = endOfUtcMonth(now);
  const weekStart = startOfUtcWeek(now);
  const weekEnd = endOfUtcDay(addUtcDays(weekStart, 6));
  const parsed = calendar
    .map((event) => ({ event, start: parseDate(event.startDate), end: parseDate(event.endDate) }))
    .filter((row): row is { event: EspnCalendarEvent; start: Date; end: Date } =>
      Boolean(row.event.id && row.event.label && row.start && row.end),
    );
  const major = parsed.find((row) => isMajorTourEvent(row.event.label) && row.start >= monthStart && row.start <= monthEnd);
  const weekly = parsed.find((row) => row.start <= weekEnd && row.end >= weekStart);
  const selections: TourCalendarSelection[] = [];

  if (major) {
    selections.push({
      event: major.event,
      kind: "monthly",
      scheduledKey: `monthly-major-${monthStart.toISOString().slice(0, 7)}`,
      startsAt: monthStart,
      endsAt: monthEnd,
    });
  }

  if (weekly && weekly.event.id !== major?.event.id) {
    selections.push({
      event: weekly.event,
      kind: "weekly",
      scheduledKey: `weekly-open-${weekStart.toISOString().slice(0, 10)}`,
      startsAt: weekStart,
      endsAt: weekEnd,
    });
  }

  return selections;
}

export function isMajorTourEvent(name: string | null | undefined) {
  const normalized = normalizeTourPlayerName(name ?? "");

  return (
    normalized === "masters tournament" ||
    normalized === "pga championship" ||
    normalized === "us open" ||
    normalized === "u s open" ||
    normalized === "the open" ||
    normalized === "the open championship"
  );
}

export function parseEspnTourScores(event: EspnScoreboardEvent | null | undefined): ParsedTourScore[] {
  const competitors = event?.competitions?.[0]?.competitors ?? [];

  return competitors
    .map((competitor) => {
      const playerName = competitor.athlete?.displayName ?? competitor.athlete?.fullName ?? "";

      if (!competitor.id || !playerName) {
        return null;
      }

      const roundScores = (competitor.linescores ?? [])
        .map((lineScore) => {
          const roundNumber = lineScore.period;
          const grossScore = lineScore.value;

          if (
            typeof roundNumber !== "number" ||
            roundNumber < 1 ||
            roundNumber > ROUND_COUNT ||
            typeof grossScore !== "number" ||
            grossScore <= 0
          ) {
            return null;
          }

          return {
            roundNumber,
            grossScore,
            displayScore: lineScore.displayValue ?? null,
          };
        })
        .filter((score): score is ParsedTourScore["roundScores"][number] => Boolean(score));

      return {
        externalAthleteId: competitor.id,
        playerName,
        position: typeof competitor.order === "number" ? competitor.order : null,
        totalScore: competitor.score ?? null,
        roundScores,
      };
    })
    .filter((score): score is ParsedTourScore => Boolean(score));
}

export function normalizeTourPlayerName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchEspnScoreboard(date?: Date): Promise<EspnScoreboard> {
  const url = new URL(ESPN_SCOREBOARD_URL);

  if (date) {
    url.searchParams.set("dates", formatEspnDate(date));
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": "ForeKingHell/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`ESPN scoreboard request failed with ${response.status}.`);
  }

  return response.json() as Promise<EspnScoreboard>;
}

async function fetchEspnEventDetail(eventId: string): Promise<EspnEventDetail | null> {
  const response = await fetch(`${ESPN_EVENT_DETAIL_URL}/${eventId}?lang=en&region=us`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": "ForeKingHell/1.0",
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<EspnEventDetail>;
}

async function getSystemUserId() {
  const db = getDb();
  const [forekingHell] = await db
    .select({ userId: userProfiles.userId })
    .from(userProfiles)
    .where(eq(userProfiles.username, "forekinghell"))
    .limit(1);

  if (forekingHell) {
    return forekingHell.userId;
  }

  const [fallbackUser] = await db.select({ id: users.id }).from(users).limit(1);

  if (!fallbackUser) {
    throw new Error("A system user is required before tour event sync can create tournaments.");
  }

  return fallbackUser.id;
}

async function upsertTourTournament(userId: string, selection: TourCalendarSelection, event: TourEventRecord) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(tournaments)
    .where(sql`${tournaments.metadataJson}->>'scheduledKey' = ${selection.scheduledKey}`)
    .limit(1);
  const { course, teeSet } = await ensureTourCourse(userId, event);
  const now = new Date();
  const metadata = {
    ...(isRecord(existing?.metadataJson) ? existing?.metadataJson : {}),
    actualTourEvent: true,
    scheduled: true,
    scheduledKey: selection.scheduledKey,
    scheduledKind: selection.kind,
    scheduleEyebrow: selection.kind === "monthly" ? "Tour major" : "This week on tour",
    externalSource: "espn",
    externalLeague: "pga",
    externalEventId: event.id,
    externalEventName: event.name,
    eventStatus: event.statusDetail,
    eventStartsAt: event.startDate.toISOString(),
    eventEndsAt: event.endDate.toISOString(),
    major: event.isMajor,
    syncedAt: now.toISOString(),
  };
  const tournamentValues = {
    title: event.name,
    description: tourEventDescription(event, selection.kind),
    courseId: course.id,
    teeSetId: teeSet.id,
    format: event.isMajor ? "four_round_major" : "tour_event",
    visibility: "public",
    status: "open",
    startsAt: selection.startsAt,
    endsAt: selection.endsAt,
    roundCount: ROUND_COUNT,
    verificationPolicy: "gold",
    screenshotRequired: true,
    directRapsodoRequired: false,
    cutRuleJson: event.isMajor ? { enabled: true, afterRound: 2, topAndTies: 50 } : {},
    playoffRuleJson: { type: "countback", order: ["final_round", "back_nine", "earliest_submission"] },
    createdByUserId: userId,
    metadataJson: metadata,
    updatedAt: now,
  };

  if (existing) {
    const [tournament] = await db
      .update(tournaments)
      .set(tournamentValues)
      .where(eq(tournaments.id, existing.id))
      .returning();
    await upsertTourRounds(tournament.id, event, selection, now);

    return { tournament, course, teeSet };
  }

  const [tournament] = await db
    .insert(tournaments)
    .values(tournamentValues)
    .returning();
  await upsertTourRounds(tournament.id, event, selection, now);

  return { tournament, course, teeSet };
}

async function ensureTourCourse(userId: string, event: TourEventRecord) {
  const db = getDb();
  const now = new Date();
  const externalId = `espn-pga-${event.id}`;
  const [course] = await db
    .insert(courses)
    .values({
      name: event.courseName,
      country: event.country,
      provider: "espn-pga",
      externalId,
      visibility: "shared",
      createdByUserId: userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [courses.provider, courses.externalId],
      set: {
        name: event.courseName,
        country: event.country,
        updatedAt: now,
      },
    })
    .returning();
  const [teeSet] = await db
    .insert(teeSets)
    .values({
      courseId: course.id,
      name: "Tournament tees",
      par: 72,
      courseRating: 72,
      slopeRating: 130,
      yards: 7200,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [teeSets.courseId, teeSets.name],
      set: {
        updatedAt: now,
      },
    })
    .returning();

  return { course, teeSet };
}

async function upsertTourRounds(
  tournamentId: string,
  event: TourEventRecord,
  selection: TourCalendarSelection,
  now: Date,
) {
  const eventStartDay = startOfUtcDay(event.startDate);

  for (let roundNumber = 1; roundNumber <= ROUND_COUNT; roundNumber += 1) {
    const roundStart = addUtcDays(eventStartDay, roundNumber - 1);
    const [round] = await getDb()
      .insert(tournamentRounds)
      .values({
        tournamentId,
        roundNumber,
        title: `Round ${roundNumber}`,
        startsAt: roundStart,
        endsAt: endOfUtcDay(roundStart),
        status: roundStart <= now && selection.endsAt >= now ? "open" : "scheduled",
        metadataJson: {
          actualTourEvent: true,
          externalEventId: event.id,
          eventRoundNumber: roundNumber,
        },
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [tournamentRounds.tournamentId, tournamentRounds.roundNumber],
        set: {
          title: `Round ${roundNumber}`,
          startsAt: roundStart,
          endsAt: endOfUtcDay(roundStart),
          status: roundStart <= now && selection.endsAt >= now ? "open" : "scheduled",
          metadataJson: {
            actualTourEvent: true,
            externalEventId: event.id,
            eventRoundNumber: roundNumber,
          },
          updatedAt: now,
        },
      })
      .returning();

    void round;
  }
}

async function importTourScores(tournamentId: string, event: TourEventRecord, scoreRows: ParsedTourScore[]) {
  const db = getDb();
  const profiles = await db
    .select()
    .from(userProfiles)
    .where(sql`${userProfiles.visibilitySettingsJson}->>'profileKind' = 'tour-player'`);
  const profilesByName = new Map(profiles.map((profile) => [normalizeTourPlayerName(profile.displayName), profile]));
  const now = new Date();
  let matchedPlayers = 0;
  let importedScores = 0;
  let availableScores = 0;

  for (const scoreRow of scoreRows) {
    availableScores += scoreRow.roundScores.length;
    const profile = profilesByName.get(normalizeTourPlayerName(scoreRow.playerName));

    if (!profile || scoreRow.roundScores.length === 0) {
      continue;
    }

    matchedPlayers += 1;
    const [entry] = await db
      .insert(tournamentEntries)
      .values({
        tournamentId,
        userId: profile.userId,
        status: "entered",
        seed: scoreRow.position,
        metadataJson: {
          actualTourEvent: true,
          source: "espn",
          externalEventId: event.id,
          externalAthleteId: scoreRow.externalAthleteId,
          playerName: scoreRow.playerName,
          totalScore: scoreRow.totalScore,
        },
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [tournamentEntries.tournamentId, tournamentEntries.userId],
        set: {
          status: "entered",
          seed: scoreRow.position,
          metadataJson: {
            actualTourEvent: true,
            source: "espn",
            externalEventId: event.id,
            externalAthleteId: scoreRow.externalAthleteId,
            playerName: scoreRow.playerName,
            totalScore: scoreRow.totalScore,
          },
          updatedAt: now,
        },
      })
      .returning();

    for (const roundScore of scoreRow.roundScores) {
      const roundDate = addUtcDays(startOfUtcDay(event.startDate), roundScore.roundNumber - 1);
      const [submission] = await db
        .insert(tournamentSubmissions)
        .values({
          tournamentId,
          entryId: entry.id,
          userId: profile.userId,
          roundNumber: roundScore.roundNumber,
          grossScore: roundScore.grossScore,
          netScore: roundScore.grossScore,
          scorecardScreenshotPath: `espn:pga:${event.id}:${scoreRow.externalAthleteId}:round-${roundScore.roundNumber}`,
          extractedScorecardTotal: roundScore.grossScore,
          verificationStatus: "verified",
          verificationTier: "gold",
          proofStatus: "approved",
          submittedAt: roundDate,
          reviewedAt: now,
          metadataJson: {
            actualTourEvent: true,
            source: "espn",
            externalEventId: event.id,
            externalAthleteId: scoreRow.externalAthleteId,
            playerName: scoreRow.playerName,
            displayScore: roundScore.displayScore,
            totalScore: scoreRow.totalScore,
          },
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [tournamentSubmissions.entryId, tournamentSubmissions.roundNumber],
          set: {
            grossScore: roundScore.grossScore,
            netScore: roundScore.grossScore,
            scorecardScreenshotPath: `espn:pga:${event.id}:${scoreRow.externalAthleteId}:round-${roundScore.roundNumber}`,
            extractedScorecardTotal: roundScore.grossScore,
            verificationStatus: "verified",
            verificationTier: "gold",
            proofStatus: "approved",
            reviewedAt: now,
            metadataJson: {
              actualTourEvent: true,
              source: "espn",
              externalEventId: event.id,
              externalAthleteId: scoreRow.externalAthleteId,
              playerName: scoreRow.playerName,
              displayScore: roundScore.displayScore,
              totalScore: scoreRow.totalScore,
            },
            updatedAt: now,
          },
        })
        .returning();

      if (submission) {
        importedScores += 1;
      }
    }
  }

  if (importedScores > 0) {
    await recalculateTournamentStandings(tournamentId);
  }

  await db
    .update(tournaments)
    .set({
      metadataJson: sql`${tournaments.metadataJson} || ${JSON.stringify({
        tourScoresSyncedAt: now.toISOString(),
        tourMatchedPlayers: matchedPlayers,
        tourImportedScores: importedScores,
        tourAvailableScores: availableScores,
      })}::jsonb`,
      updatedAt: now,
    })
    .where(eq(tournaments.id, tournamentId));

  return { matchedPlayers, importedScores, availableScores };
}

function toTourEventRecord(
  selection: TourCalendarSelection,
  scoreboardEvent: EspnScoreboardEvent | null,
  detail: EspnEventDetail | null,
): TourEventRecord {
  const startDate =
    parseDate(detail?.date) ??
    parseDate(scoreboardEvent?.competitions?.[0]?.startDate) ??
    parseDate(scoreboardEvent?.date) ??
    parseDate(selection.event.startDate) ??
    selection.startsAt;
  const endDate =
    parseDate(detail?.endDate) ??
    parseDate(scoreboardEvent?.competitions?.[0]?.endDate) ??
    parseDate(selection.event.endDate) ??
    selection.endsAt;
  const course = detail?.courses?.[0];
  const eventName = detail?.name ?? scoreboardEvent?.name ?? selection.event.label ?? "PGA Tour event";
  const status = scoreboardEvent?.competitions?.[0]?.status ?? scoreboardEvent?.status ?? null;

  return {
    id: selection.event.id ?? detail?.id ?? scoreboardEvent?.id ?? slugify(eventName),
    name: eventName,
    shortName: detail?.shortName ?? scoreboardEvent?.shortName ?? eventName,
    startDate,
    endDate,
    courseName: course?.name ?? eventName,
    country: course?.address?.country ?? null,
    isMajor: isMajorTourEvent(eventName),
    statusDetail: status?.type?.detail ?? status?.type?.shortDetail ?? status?.type?.description ?? null,
  };
}

function tourEventDescription(event: TourEventRecord, kind: "weekly" | "monthly") {
  const scope = kind === "monthly" ? "Monthly major slot" : "Weekly tour event";

  return `${scope} synced from the PGA Tour schedule. Tour player scores update from ESPN leaderboards, and ForeKingHell users can submit their own four daily rounds into the same combined board.`;
}

function formatEspnDate(date: Date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function startOfUtcWeek(date: Date) {
  const day = startOfUtcDay(date);
  const offset = (day.getUTCDay() + 6) % 7;

  return addUtcDays(day, -offset);
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfUtcMonth(date: Date) {
  return endOfUtcDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function slugify(value: string) {
  return normalizeTourPlayerName(value).replace(/\s+/g, "-").slice(0, 150);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
