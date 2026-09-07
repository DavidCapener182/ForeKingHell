import type { Metadata } from "next";
import { SharedTwinView } from "./shared-twin-view";
import { notFound } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { sessions, shareLinks } from "@/db/schema";
import { getCourseTwinManifest, getCourseTwinReplay } from "@/lib/course-twin-data";
import { hashShareToken } from "@/lib/share-links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shared Course Twin",
  robots: { index: false, follow: false },
};

export default async function SharedCourseTwinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ hole?: string | string[] }>;
}) {
  const { token } = await params;
  const shared = await loadSharedReplay(token);
  if (!shared) notFound();
  const requestedHole = Number((await searchParams).hole);
  const initialHoleNumber = shared.manifest.holes.find(
    (hole) => hole.holeNumber === requestedHole,
  )?.holeNumber;

  return (
    <SharedTwinView
      title={shared.title}
      manifest={shared.manifest}
      replay={shared.replay}
      initialHoleNumber={initialHoleNumber}
    />
  );
}

async function loadSharedReplay(token: string) {
  const now = new Date();
  const [link] = await getDb()
    .select({
      userId: shareLinks.userId,
      sessionId: sessions.id,
      courseId: sessions.courseId,
      title: shareLinks.title,
    })
    .from(shareLinks)
    .innerJoin(
      sessions,
      and(eq(sessions.id, shareLinks.resourceId), eq(sessions.userId, shareLinks.userId)),
    )
    .where(
      and(
        eq(shareLinks.tokenHash, hashShareToken(token)),
        eq(shareLinks.resourceType, "course_twin_replay"),
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, now)),
      ),
    )
    .limit(1);
  if (!link?.courseId) return null;
  const manifest = await getCourseTwinManifest({ userId: link.userId, courseId: link.courseId });
  if (!manifest) return null;
  const replay = await getCourseTwinReplay({
    userId: link.userId,
    courseId: link.courseId,
    sessionId: link.sessionId,
    manifest,
  });
  if (!replay) return null;
  return {
    title: link.title ?? `${manifest.course.name} 3D replay`,
    manifest,
    replay,
  };
}
