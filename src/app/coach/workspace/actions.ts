"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { reportServerFailure } from "@/lib/server-observability";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { accountMemberships, coachPlayerInteractions, practicePlans, sessions } from "@/db/schema";
import { parseCoachInteractionType, visibilityForInteraction } from "@/lib/coach-workspace";
import { requireCurrentUserId } from "@/lib/current-user";

async function persistCoachInteraction(formData: FormData) {
  const coachUserId = await requireCurrentUserId();
  const playerUserId = requiredText(formData, "playerUserId", 80);
  const interactionType = parseCoachInteractionType(formData.get("interactionType"));
  if (!interactionType)
    throw new InteractionInputError(
      "Choose an interaction type.",
      `/coach/workspace?playerId=${playerUserId}&error=type`,
    );

  const db = getDb();
  await requireCoachMembership(coachUserId, playerUserId);
  const sessionId = optionalText(formData.get("sessionId"), 80);
  const practicePlanId = optionalText(formData.get("practicePlanId"), 80);
  if (sessionId) {
    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, playerUserId)))
      .limit(1);
    if (!session)
      throw new InteractionInputError(
        "Choose a session belonging to this player.",
        `/coach/workspace?playerId=${playerUserId}&error=session`,
      );
  }
  if (practicePlanId) {
    const [plan] = await db
      .select({ id: practicePlans.id })
      .from(practicePlans)
      .where(and(eq(practicePlans.id, practicePlanId), eq(practicePlans.userId, playerUserId)))
      .limit(1);
    if (!plan)
      throw new InteractionInputError(
        "Choose a practice plan belonging to this player.",
        `/coach/workspace?playerId=${playerUserId}&error=plan`,
      );
  }

  const now = new Date();
  await db.insert(coachPlayerInteractions).values({
    playerUserId,
    coachUserId,
    interactionType,
    visibility: visibilityForInteraction(interactionType),
    title: requiredText(formData, "title", 180),
    body: requiredText(formData, "body", 8000),
    sessionId,
    practicePlanId,
    goalReference: optionalText(formData.get("goalReference"), 220),
    evidenceType: optionalText(formData.get("evidenceType"), 60),
    evidenceId: optionalText(formData.get("evidenceId"), 220),
    dueAt: parseDate(formData.get("dueAt")),
    status: "open",
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/coach/workspace");
  return playerUserId;
}

async function persistCoachInteractionStatus(formData: FormData) {
  const coachUserId = await requireCurrentUserId();
  const playerUserId = requiredText(formData, "playerUserId", 80);
  const interactionId = requiredText(formData, "interactionId", 80);
  const requestedStatus = formData.get("status");
  const status =
    requestedStatus === "completed" || requestedStatus === "cancelled" ? requestedStatus : "open";
  await requireCoachMembership(coachUserId, playerUserId);
  const now = new Date();

  const [updated] = await getDb()
    .update(coachPlayerInteractions)
    .set({
      status,
      completedAt: status === "completed" ? now : null,
      updatedAt: now,
    })
    .where(
      and(
        eq(coachPlayerInteractions.id, interactionId),
        eq(coachPlayerInteractions.coachUserId, coachUserId),
        eq(coachPlayerInteractions.playerUserId, playerUserId),
      ),
    )
    .returning({ id: coachPlayerInteractions.id });
  if (!updated)
    throw new InteractionInputError(
      "Interaction unavailable or already closed.",
      "/coach/workspace?error=invalid",
    );

  revalidatePath("/coach/workspace");
}

async function persistPlayerInteractionCompletion(formData: FormData) {
  const playerUserId = await requireCurrentUserId();
  const interactionId = requiredText(formData, "interactionId", 80);
  const now = new Date();

  const [updated] = await getDb()
    .update(coachPlayerInteractions)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(
      and(
        eq(coachPlayerInteractions.id, interactionId),
        eq(coachPlayerInteractions.playerUserId, playerUserId),
        eq(coachPlayerInteractions.visibility, "player_visible"),
        eq(coachPlayerInteractions.status, "open"),
      ),
    )
    .returning({ id: coachPlayerInteractions.id });
  if (!updated)
    throw new InteractionInputError(
      "Interaction unavailable or already closed.",
      "/coach/workspace?error=invalid",
    );

  revalidatePath("/coach/workspace");
}

async function requireCoachMembership(coachUserId: string, playerUserId: string) {
  const [membership] = await getDb()
    .select({ id: accountMemberships.id })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.ownerUserId, playerUserId),
        eq(accountMemberships.memberUserId, coachUserId),
        eq(accountMemberships.role, "coach"),
      ),
    )
    .limit(1);
  if (!membership)
    throw new InteractionInputError(
      "Coach access to this player is unavailable.",
      "/coach/workspace?error=access",
    );
}

function requiredText(formData: FormData, name: string, maxLength: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value || value.length > maxLength)
    throw new InteractionInputError(
      `Enter a valid ${name} (up to ${maxLength} characters).`,
      "/coach/workspace?error=invalid",
    );
  return value;
}

function optionalText(value: FormDataEntryValue | null, maxLength: number) {
  const text = typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  return text && text !== "__none__" ? text : null;
}

function parseDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

class InteractionInputError extends Error {
  constructor(
    message: string,
    public readonly redirectUrl: string,
  ) {
    super(message);
  }
}
export type CoachInteractionFormResult = { ok: true } | { ok: false; error: string };
async function legacy<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof InteractionInputError) redirect(error.redirectUrl);
    throw error;
  }
}
async function state(operation: () => Promise<unknown>): Promise<CoachInteractionFormResult> {
  try {
    await operation();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof InteractionInputError) return { ok: false, error: error.message };
    reportServerFailure("coach_interaction_save_failed", error);
    return {
      ok: false,
      error: "The change could not be saved. Your draft is still here; try again.",
    };
  }
}
export async function createCoachInteractionAction(formData: FormData) {
  const playerUserId = await legacy(() => persistCoachInteraction(formData));
  redirect(`/coach/workspace?playerId=${encodeURIComponent(playerUserId)}&saved=1`);
}
export async function updateCoachInteractionStatusAction(formData: FormData) {
  await legacy(() => persistCoachInteractionStatus(formData));
}
export async function completePlayerInteractionAction(formData: FormData) {
  await legacy(() => persistPlayerInteractionCompletion(formData));
}
export async function createCoachInteractionWithStateAction(formData: FormData) {
  return state(() => persistCoachInteraction(formData));
}
export async function updateCoachInteractionStatusWithStateAction(formData: FormData) {
  return state(() => persistCoachInteractionStatus(formData));
}
export async function completePlayerInteractionWithStateAction(formData: FormData) {
  return state(() => persistPlayerInteractionCompletion(formData));
}
