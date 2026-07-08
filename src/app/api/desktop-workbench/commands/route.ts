import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, ne, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { clubs, courses, sessions, userProfiles } from "@/db/schema";
import { formatClubModelName, formatClubType, isTrackedClubType } from "@/lib/club-format";
import { getCurrentUser } from "@/lib/current-user";
import { roundSessionTypes } from "@/lib/round-sessions";
import { getFriendIds } from "@/lib/social";

export const dynamic = "force-dynamic";

type WorkspaceCommandType = "club" | "round" | "course" | "session" | "friend";

type WorkspaceCommandItem = {
  title: string;
  href: string;
  detail: string;
  group: string;
  keywords: string;
  type: WorkspaceCommandType;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ items: [] });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ items: [] });
  }

  try {
    const db = getDb();
    const friendIds = await getFriendIds(user.id);

    const [clubRows, roundRows, sessionRows, courseRows, friendRows] = await Promise.all([
      db
        .select({
          id: clubs.id,
          type: clubs.type,
          brand: clubs.brand,
          model: clubs.model,
          bagPosition: clubs.bagPosition,
        })
        .from(clubs)
        .where(and(eq(clubs.userId, user.id), eq(clubs.active, true)))
        .orderBy(asc(clubs.bagPosition), asc(clubs.type))
        .limit(16),
      db
        .select({
          id: sessions.id,
          type: sessions.type,
          source: sessions.source,
          playContext: sessions.playContext,
          date: sessions.date,
          courseName: sessions.courseName,
          location: sessions.location,
          fileName: sessions.fileName,
        })
        .from(sessions)
        .where(and(eq(sessions.userId, user.id), inArray(sessions.type, [...roundSessionTypes])))
        .orderBy(desc(sessions.date))
        .limit(8),
      db
        .select({
          id: sessions.id,
          type: sessions.type,
          source: sessions.source,
          playContext: sessions.playContext,
          date: sessions.date,
          courseName: sessions.courseName,
          location: sessions.location,
          fileName: sessions.fileName,
        })
        .from(sessions)
        .where(eq(sessions.userId, user.id))
        .orderBy(desc(sessions.date))
        .limit(16),
      db
        .select({
          id: courses.id,
          name: courses.name,
          country: courses.country,
          address: courses.address,
          provider: courses.provider,
          visibility: courses.visibility,
          updatedAt: courses.updatedAt,
        })
        .from(courses)
        .where(or(eq(courses.createdByUserId, user.id), ne(courses.visibility, "private")))
        .orderBy(desc(courses.updatedAt), asc(courses.name))
        .limit(10),
      friendIds.length > 0
        ? db
            .select({
              userId: userProfiles.userId,
              username: userProfiles.username,
              displayName: userProfiles.displayName,
              homeCourse: userProfiles.homeCourse,
              handicapBand: userProfiles.handicapBand,
            })
            .from(userProfiles)
            .where(inArray(userProfiles.userId, friendIds))
            .orderBy(asc(userProfiles.displayName))
            .limit(10)
        : Promise.resolve([]),
    ]);

    const items: WorkspaceCommandItem[] = [
      ...clubRows.filter((club) => isTrackedClubType(club.type)).map(clubCommand),
      ...roundRows.map(roundCommand),
      ...sessionRows
        .filter((session) => !isRoundSessionTypeValue(session.type))
        .slice(0, 6)
        .map(sessionCommand),
      ...courseRows.map(courseCommand),
      ...friendRows.map(friendCommand),
    ].slice(0, 32);

    return NextResponse.json({ items });
  } catch (error) {
    console.warn("Failed to load desktop workbench commands", error);
    return NextResponse.json({ items: [] });
  }
}

function clubCommand(club: {
  id: string;
  type: string;
  brand: string | null;
  model: string | null;
  bagPosition: number;
}): WorkspaceCommandItem {
  const clubType = formatClubType(club.type);
  const modelName = formatClubModelName(club);
  const title = modelName === clubType ? clubType : `${clubType} - ${modelName}`;

  return {
    title,
    href: `/bag/${club.id}/analytics`,
    detail: `${clubType} analytics - current bag position ${club.bagPosition}`,
    group: "Club",
    keywords: joinKeywords([
      clubType,
      club.type,
      club.brand,
      club.model,
      "club bag analytics gapping carry dispersion trust",
    ]),
    type: "club",
  };
}

function roundCommand(round: {
  id: string;
  type: string;
  source: string;
  playContext: string;
  date: Date;
  courseName: string | null;
  location: string | null;
  fileName: string | null;
}): WorkspaceCommandItem {
  const venue = round.courseName || round.location || round.fileName || "Saved round";
  const dateLabel = dateFormatter.format(round.date);

  return {
    title: `Round - ${venue}`,
    href: `/rounds/${round.id}`,
    detail: `${dateLabel} - ${formatSessionType(round.type)} evidence`,
    group: "Round",
    keywords: joinKeywords([
      venue,
      round.type,
      round.source,
      round.playContext,
      round.fileName,
      dateLabel,
      "round scorecard handicap course review",
    ]),
    type: "round",
  };
}

function sessionCommand(session: {
  id: string;
  type: string;
  source: string;
  playContext: string;
  date: Date;
  courseName: string | null;
  location: string | null;
  fileName: string | null;
}): WorkspaceCommandItem {
  const dateLabel = dateFormatter.format(session.date);
  const title = session.courseName || session.location || session.fileName || "Practice session";

  return {
    title: `Session - ${title}`,
    href: `/today?session=${session.id}`,
    detail: `${dateLabel} - ${formatSessionType(session.type)} evidence`,
    group: "Session",
    keywords: joinKeywords([
      title,
      session.type,
      session.source,
      session.playContext,
      session.fileName,
      dateLabel,
      "latest practice session range import review",
    ]),
    type: "session",
  };
}

function courseCommand(course: {
  id: string;
  name: string;
  country: string | null;
  address: string | null;
  provider: string;
  visibility: string;
  updatedAt: Date;
}): WorkspaceCommandItem {
  return {
    title: course.name,
    href: `/courses/${course.id}/records`,
    detail: joinText([course.country, course.address, `${course.visibility} course`], " - "),
    group: "Course",
    keywords: joinKeywords([
      course.name,
      course.country,
      course.address,
      course.provider,
      course.visibility,
      "course records holes map source health",
    ]),
    type: "course",
  };
}

function friendCommand(friend: {
  userId: string;
  username: string;
  displayName: string;
  homeCourse: string | null;
  handicapBand: string | null;
}): WorkspaceCommandItem {
  return {
    title: friend.displayName,
    href: `/profile/${friend.username}`,
    detail: joinText([`@${friend.username}`, friend.homeCourse, friend.handicapBand], " - "),
    group: "Friend",
    keywords: joinKeywords([
      friend.displayName,
      friend.username,
      friend.homeCourse,
      friend.handicapBand,
      friend.userId,
      "friend profile social compare",
    ]),
    type: "friend",
  };
}

function formatSessionType(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function isRoundSessionTypeValue(value: string) {
  return roundSessionTypes.includes(value as (typeof roundSessionTypes)[number]);
}

function joinKeywords(values: Array<string | number | null | undefined>) {
  return values
    .map((value) => (value === null || value === undefined ? "" : String(value).trim()))
    .filter(Boolean)
    .join(" ");
}

function joinText(values: Array<string | null | undefined>, separator: string) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(separator);
}
