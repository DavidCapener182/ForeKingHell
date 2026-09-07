"use server";

import { redirect } from "next/navigation";

import {
  addTournamentComment,
  createTournament,
  joinTournament,
  submitTournamentRound,
  tournamentFormats,
  withdrawTournament,
  type TournamentFormat,
} from "@/lib/tournaments";
import {
  TOURNAMENT_ENTRY_TERMS_ACCEPT_FIELD,
  TOURNAMENT_ENTRY_TERMS_VERSION,
  TOURNAMENT_ENTRY_TERMS_VERSION_FIELD,
  hasAcceptedTournamentEntryTerms,
} from "@/lib/tournament-entry-terms";

export async function createTournamentAction(formData: FormData) {
  const title = formString(formData, "title") ?? "Spring Major Week";
  const format = parseFormat(formString(formData, "format"));
  const roundCount = formNumber(formData, "roundCount");
  const courseTee = parseCourseTee(formString(formData, "courseTee"));
  const tournamentId = await createTournament({
    title,
    description: formString(formData, "description"),
    courseId: formString(formData, "courseId") ?? courseTee.courseId,
    teeSetId: formString(formData, "teeSetId") ?? courseTee.teeSetId,
    format,
    visibility: formString(formData, "visibility") ?? "friends",
    startsAt: formDate(formData, "startsAt"),
    endsAt: formDate(formData, "endsAt"),
    roundCount,
    directRapsodoRequired: formData.get("directRapsodoRequired") === "on",
    screenshotRequired: formData.get("screenshotRequired") === "on",
  });

  redirect(`/tournaments/${tournamentId}`);
}

export async function createSpringMajorTournamentAction(formData: FormData) {
  const courseTee = parseCourseTee(formString(formData, "courseTee"));
  const tournamentId = await createTournament({
    title: formString(formData, "title") ?? "Spring Major Week",
    description:
      "Four rounds, one course, one tee set, gross and net standings, optional cut after round two, and sudden-death tiebreaker rules.",
    courseId: formString(formData, "courseId") ?? courseTee.courseId,
    teeSetId: formString(formData, "teeSetId") ?? courseTee.teeSetId,
    format: "four_round_major",
    visibility: formString(formData, "visibility") ?? "friends",
    startsAt: formDate(formData, "startsAt"),
    endsAt: formDate(formData, "endsAt"),
    roundCount: 4,
    directRapsodoRequired: true,
    screenshotRequired: true,
  });

  redirect(`/tournaments/${tournamentId}`);
}

export async function joinTournamentAction(formData: FormData) {
  const tournamentId = formString(formData, "tournamentId");

  if (!tournamentId) {
    return;
  }

  if (
    !hasAcceptedTournamentEntryTerms(
      formData.get(TOURNAMENT_ENTRY_TERMS_ACCEPT_FIELD),
      formData.get(TOURNAMENT_ENTRY_TERMS_VERSION_FIELD),
    )
  ) {
    redirect(`/tournaments/${encodeURIComponent(tournamentId)}?entryError=terms`);
  }

  await joinTournamentFromForm(formData, tournamentId);
  redirect(`/tournaments/${tournamentId}?joined=1`);
}

export async function withdrawTournamentAction(formData: FormData) {
  const tournamentId = formString(formData, "tournamentId");
  if (!tournamentId) return;

  await withdrawTournament(tournamentId);
  redirect("/tournaments?tab=mine");
}

export async function joinTournamentFormAction(
  _previousState: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const tournamentId = formString(formData, "tournamentId");
    if (!tournamentId) throw new Error("Tournament is required.");
    await joinTournamentFromForm(formData, tournamentId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not enter tournament.",
    };
  }
}

async function joinTournamentFromForm(formData: FormData, tournamentId: string) {
  if (
    !hasAcceptedTournamentEntryTerms(
      formData.get(TOURNAMENT_ENTRY_TERMS_ACCEPT_FIELD),
      formData.get(TOURNAMENT_ENTRY_TERMS_VERSION_FIELD),
    )
  )
    throw new Error("Accept the current tournament entry terms before registering.");
  await joinTournament(tournamentId, {
    accepted: true,
    acceptedAt: new Date(),
    version: TOURNAMENT_ENTRY_TERMS_VERSION,
  });
}

export async function withdrawTournamentFormAction(
  _previousState: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const tournamentId = formString(formData, "tournamentId");
    if (!tournamentId) throw new Error("Tournament is required.");
    await withdrawTournament(tournamentId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not withdraw from tournament.",
    };
  }
}

export async function submitTournamentRoundAction(formData: FormData) {
  const tournamentId = formString(formData, "tournamentId");

  if (!tournamentId) {
    return;
  }

  const submissionId = await submitTournamentRound(
    tournamentSubmissionInput(formData, tournamentId),
  );

  redirect(`/tournaments/${tournamentId}?submission=${submissionId}`);
}

export async function submitTournamentRoundFormAction(
  _previousState: { ok: boolean; submissionId?: string; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; submissionId?: string; error?: string }> {
  try {
    const tournamentId = formString(formData, "tournamentId");
    if (!tournamentId) throw new Error("Tournament is required.");
    const submissionId = await submitTournamentRound(
      tournamentSubmissionInput(formData, tournamentId),
    );
    return { ok: true, submissionId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save round." };
  }
}

function tournamentSubmissionInput(formData: FormData, tournamentId: string) {
  return {
    tournamentId,
    roundNumber: formNumber(formData, "roundNumber") ?? 1,
    grossScore: formNumber(formData, "grossScore") ?? 0,
    netScore: formNumber(formData, "netScore"),
    stablefordPoints: formNumber(formData, "stablefordPoints"),
    sessionId: formString(formData, "sessionId"),
    csvHash: formString(formData, "csvHash"),
    scorecardScreenshotPath: formString(formData, "scorecardScreenshotPath"),
    extractedScorecardTotal: formNumber(formData, "extractedScorecardTotal"),
    scorecardProofToken: formString(formData, "scorecardProofToken"),
  };
}

export async function addTournamentCommentAction(formData: FormData) {
  const tournamentId = formString(formData, "tournamentId");
  const body = formString(formData, "body");

  if (!tournamentId || !body) {
    return;
  }

  await addTournamentComment(tournamentId, body);
  redirect(`/tournaments/${tournamentId}?comment=1`);
}

function parseFormat(value: string | null): TournamentFormat {
  return tournamentFormats.includes(value as TournamentFormat)
    ? (value as TournamentFormat)
    : "two_round_open";
}

function parseCourseTee(value: string | null) {
  if (!value) {
    return { courseId: null, teeSetId: null };
  }

  const [courseId, teeSetId] = value.split(":");
  return {
    courseId: courseId || null,
    teeSetId: teeSetId || null,
  };
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formNumber(formData: FormData, key: string) {
  const value = formString(formData, key);
  const parsed = value === null ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formDate(formData: FormData, key: string) {
  const value = formString(formData, key);
  const parsed = value ? new Date(`${value}T12:00:00.000Z`) : null;
  if (!value) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !parsed ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${key} must be a valid date.`);
  }
  return parsed;
}
