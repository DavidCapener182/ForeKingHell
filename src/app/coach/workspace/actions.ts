"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { accountMemberships, coachPlayerInteractions, practicePlans, sessions } from "@/db/schema";
import { parseCoachInteractionType, visibilityForInteraction } from "@/lib/coach-workspace";
import { requireCurrentUserId } from "@/lib/current-user";

export async function createCoachInteractionAction(formData: FormData) {
  const coachUserId = await requireCurrentUserId();
  const playerUserId = requiredText(formData, "playerUserId", 80);
  const interactionType = parseCoachInteractionType(formData.get("interactionType"));
  if (!interactionType) redirect(`/coach/workspace?playerId=${playerUserId}&error=type`);

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
    if (!session) redirect(`/coach/workspace?playerId=${playerUserId}&error=session`);
  }
  if (practicePlanId) {
    const [plan] = await db
      .select({ id: practicePlans.id })
      .from(practicePlans)
      .where(and(eq(practicePlans.id, practicePlanId), eq(practicePlans.userId, playerUserId)))
      .limit(1);
    if (!plan) redirect(`/coach/workspace?playerId=${playerUserId}&error=plan`);
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
  redirect(`/coach/workspace?playerId=${encodeURIComponent(playerUserId)}&saved=1`);
}

export async function updateCoachInteractionStatusAction(formData: FormData) {
  const coachUserId = await requireCurrentUserId();
  const playerUserId = requiredText(formData, "playerUserId", 80);
  const interactionId = requiredText(formData, "interactionId", 80);
  const requestedStatus = formData.get("status");
  const status =
    requestedStatus === "completed" || requestedStatus === "cancelled" ? requestedStatus : "open";
  await requireCoachMembership(coachUserId, playerUserId);
  const now = new Date();

  await getDb()
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
    );

  revalidatePath("/coach/workspace");
}

export async function completePlayerInteractionAction(formData: FormData) {
  const playerUserId = await requireCurrentUserId();
  const interactionId = requiredText(formData, "interactionId", 80);
  const now = new Date();

  await getDb()
    .update(coachPlayerInteractions)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(
      and(
        eq(coachPlayerInteractions.id, interactionId),
        eq(coachPlayerInteractions.playerUserId, playerUserId),
        eq(coachPlayerInteractions.visibility, "player_visible"),
        eq(coachPlayerInteractions.status, "open"),
      ),
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
  if (!membership) redirect("/coach/workspace?error=access");
}

function requiredText(formData: FormData, name: string, maxLength: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value || value.length > maxLength) redirect("/coach/workspace?error=invalid");
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
