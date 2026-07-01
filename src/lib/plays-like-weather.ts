import "server-only";

import { and, desc, eq, gt, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { courses, weatherSnapshots } from "@/db/schema";
import type { PlaysLikeConditions } from "@/lib/plays-like";

type FetchLike = typeof fetch;

export type LivePlaysLikeSnapshot = {
  provider: "open_meteo";
  courseId: string | null;
  latitude: number;
  longitude: number;
  elevationM: number | null;
  conditions: PlaysLikeConditions;
  source: "live" | "cache";
  sourceLabel: string;
  fetchedAt: string;
  expiresAt: string;
};

type WeatherSnapshotRow = typeof weatherSnapshots.$inferSelect;

const cacheTtlMs = 30 * 60 * 1000;

export async function getLivePlaysLikeSnapshotForCourse({
  userId,
  courseId,
  now = new Date(),
  fetchImpl = fetch,
}: {
  userId: string;
  courseId: string;
  now?: Date;
  fetchImpl?: FetchLike;
}): Promise<LivePlaysLikeSnapshot | null> {
  const db = getDb();
  const [course] = await db
    .select({
      id: courses.id,
      name: courses.name,
      latitude: courses.latitude,
      longitude: courses.longitude,
    })
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)),
      ),
    )
    .limit(1);

  if (
    !course ||
    typeof course.latitude !== "number" ||
    typeof course.longitude !== "number"
  ) {
    return null;
  }

  const [cached] = await db
    .select()
    .from(weatherSnapshots)
    .where(
      and(
        eq(weatherSnapshots.userId, userId),
        eq(weatherSnapshots.courseId, course.id),
        gt(weatherSnapshots.expiresAt, now),
      ),
    )
    .orderBy(desc(weatherSnapshots.fetchedAt))
    .limit(1);

  if (cached) {
    return snapshotFromRow(cached, "cache");
  }

  const live = await fetchOpenMeteoSnapshot({
    latitude: course.latitude,
    longitude: course.longitude,
    courseId: course.id,
    fetchImpl,
    now,
  });

  const [stored] = await db
    .insert(weatherSnapshots)
    .values({
      userId,
      courseId: course.id,
      provider: live.provider,
      latitude: live.latitude,
      longitude: live.longitude,
      elevationM: live.elevationM,
      conditionsJson: live.conditions,
      sourceJson: {
        courseName: course.name,
        provider: live.provider,
        sourceLabel: live.sourceLabel,
      },
      fetchedAt: new Date(live.fetchedAt),
      expiresAt: new Date(live.expiresAt),
      updatedAt: now,
    })
    .returning();

  return stored ? snapshotFromRow(stored, "live") : live;
}

export async function fetchOpenMeteoSnapshot({
  latitude,
  longitude,
  courseId = null,
  now = new Date(),
  fetchImpl = fetch,
}: {
  latitude: number;
  longitude: number;
  courseId?: string | null;
  now?: Date;
  fetchImpl?: FetchLike;
}): Promise<LivePlaysLikeSnapshot> {
  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(latitude));
  forecastUrl.searchParams.set("longitude", String(longitude));
  forecastUrl.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m",
  );
  forecastUrl.searchParams.set("temperature_unit", "celsius");
  forecastUrl.searchParams.set("wind_speed_unit", "mph");
  forecastUrl.searchParams.set("timezone", "auto");
  forecastUrl.searchParams.set("forecast_days", "1");

  const elevationUrl = new URL("https://api.open-meteo.com/v1/elevation");
  elevationUrl.searchParams.set("latitude", String(latitude));
  elevationUrl.searchParams.set("longitude", String(longitude));

  const [forecastResponse, elevationResponse] = await Promise.all([
    fetchImpl(forecastUrl),
    fetchImpl(elevationUrl),
  ]);

  if (!forecastResponse.ok) {
    throw new Error(`Open-Meteo forecast failed (${forecastResponse.status}).`);
  }

  const forecastJson = (await forecastResponse.json()) as Record<string, unknown>;
  const elevationJson = elevationResponse.ok
    ? ((await elevationResponse.json()) as Record<string, unknown>)
    : null;
  const current = objectFromUnknown(forecastJson.current);
  const windDirectionDeg = numberFromUnknown(current.wind_direction_10m);
  const windSpeedMph = numberFromUnknown(current.wind_speed_10m);
  const elevationM = firstNumberFromArray(elevationJson?.elevation);
  const conditions: PlaysLikeConditions = {
    temperatureC: numberFromUnknown(current.temperature_2m),
    humidityPct: numberFromUnknown(current.relative_humidity_2m),
    windSpeedMph,
    windDirectionDeg,
    windDirectionLabel:
      typeof windDirectionDeg === "number" ? compassLabel(windDirectionDeg) : null,
    windEffect: windSpeedMph && windSpeedMph >= 3 ? "cross" : "calm",
    altitudeM: elevationM,
  };
  const fetchedAt = now.toISOString();

  return {
    provider: "open_meteo",
    courseId,
    latitude,
    longitude,
    elevationM,
    conditions,
    source: "live",
    sourceLabel: "Open-Meteo live course weather",
    fetchedAt,
    expiresAt: new Date(now.getTime() + cacheTtlMs).toISOString(),
  };
}

function snapshotFromRow(row: WeatherSnapshotRow, source: "live" | "cache"): LivePlaysLikeSnapshot {
  const conditions = row.conditionsJson as PlaysLikeConditions;

  return {
    provider: "open_meteo",
    courseId: row.courseId,
    latitude: row.latitude,
    longitude: row.longitude,
    elevationM: row.elevationM,
    conditions,
    source,
    sourceLabel:
      source === "cache" ? "Cached Open-Meteo course weather" : "Open-Meteo live course weather",
    fetchedAt: row.fetchedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

function objectFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstNumberFromArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return numberFromUnknown(value[0]);
}

function numberFromUnknown(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function compassLabel(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % directions.length;
  return directions[index];
}
