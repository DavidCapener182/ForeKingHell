import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { sessions, shareLinks, teeSets, users } from "@/db/schema";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import type { AppSurface } from "@/lib/app-surface";
import { calculateRoundDifferential } from "@/lib/round-handicap";
import { hashShareToken } from "@/lib/share-links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared scorecard",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export type SharedScorecardHole = NonNullable<
  (typeof sessions.$inferSelect)["scorecardJson"]
>[number];
export type SharedRoundData = NonNullable<Awaited<ReturnType<typeof getSharedRound>>>;

export default async function SharedRoundPage({ params }: PageProps) {
  const [{ token }, surface] = await Promise.all([params, getRequestAppSurface()]);
  const round = await getSharedRound(token);

  if (!round) {
    notFound();
  }

  return renderSharedRound(surface, round, token);
}

async function renderSharedRound(surface: AppSurface, round: SharedRoundData, token: string) {
  if (surface === "companion") {
    const { SharedRoundCompanion } = await import("./shared-round-companion");
    return <SharedRoundCompanion round={round} />;
  }

  const { SharedRoundWorkbench } = await import("./shared-round-workbench");
  return <SharedRoundWorkbench round={round} token={token} />;
}

async function getSharedRound(token: string) {
  const db = getDb();
  const now = new Date();
  const tokenHash = hashShareToken(token);
  const [link] = await db
    .select({
      id: shareLinks.id,
      userId: shareLinks.userId,
      resourceId: shareLinks.resourceId,
      title: shareLinks.title,
      expiresAt: shareLinks.expiresAt,
    })
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.tokenHash, tokenHash),
        eq(shareLinks.resourceType, "round"),
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!link) {
    return null;
  }

  const [session] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      type: sessions.type,
      date: sessions.date,
      courseName: sessions.courseName,
      roundStatus: sessions.roundStatus,
      weatherJson: sessions.weatherJson,
      equipmentNotes: sessions.equipmentNotes,
      scorecardJson: sessions.scorecardJson,
      teeName: teeSets.name,
      courseRating: teeSets.courseRating,
      slopeRating: teeSets.slopeRating,
      ownerName: users.name,
    })
    .from(sessions)
    .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, link.resourceId), eq(sessions.userId, link.userId)))
    .limit(1);

  if (!session) {
    return null;
  }

  const holes = session.scorecardJson ?? [];
  const totalScore = sumNullable(holes.map((hole) => hole.score ?? null));
  const totalPar = holes.length > 0 ? holes.reduce((total, hole) => total + hole.par, 0) : null;
  const totalPutts = sumNullable(holes.map((hole) => hole.putts ?? null));
  const handicapDifferential = calculateRoundDifferential({
    totalScore,
    totalPar,
    courseRating: session.courseRating,
    slopeRating: session.slopeRating,
    holesPlayed: holes.length,
  });

  return {
    link,
    session,
    ownerName: session.ownerName,
    weather: normalizeWeather(session.weatherJson),
    holes,
    totalScore,
    totalPar,
    totalPutts,
    handicapDifferential,
  };
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function normalizeWeather(value: unknown) {
  if (!value || typeof value !== "object") {
    return { conditions: null, wind: null, temperature: null };
  }

  const weather = value as {
    conditions?: unknown;
    wind?: unknown;
    temperature?: unknown;
  };

  return {
    conditions: typeof weather.conditions === "string" ? weather.conditions : null,
    wind: typeof weather.wind === "string" ? weather.wind : null,
    temperature: typeof weather.temperature === "string" ? weather.temperature : null,
  };
}
