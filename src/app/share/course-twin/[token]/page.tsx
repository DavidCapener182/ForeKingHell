import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { Cuboid, LockKeyhole } from "lucide-react";

import { CourseTwinRuntime } from "@/app/play/[courseId]/course-twin-runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db/client";
import { sessions, shareLinks } from "@/db/schema";
import { BRAND_NAME } from "@/lib/brand";
import { getCourseTwinManifest, getCourseTwinReplay } from "@/lib/course-twin-data";
import { hashShareToken } from "@/lib/share-links";

export const dynamic = "force-dynamic";

export default async function SharedCourseTwinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await loadSharedReplay(token);
  if (!shared) notFound();

  return (
    <main className="min-h-screen bg-[#07150e] text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-emerald-200">
            <Cuboid className="size-4" />
            {BRAND_NAME} Course Twin
          </div>
          <h1 className="mt-1 text-lg font-semibold">{shared.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="gap-1.5 border-white/15 bg-white/10 text-white">
            <LockKeyhole className="size-3.5" />
            Read-only replay
          </Badge>
          <Button asChild variant="secondary" size="sm">
            <Link href="/login">Open {BRAND_NAME}</Link>
          </Button>
        </div>
      </header>
      <section aria-label="Shared 3D round replay">
        <CourseTwinRuntime manifest={shared.manifest} replay={shared.replay} readOnly />
      </section>
      <footer className="border-t border-white/10 px-4 py-3 text-xs text-emerald-100/70 sm:px-6">
        This private link exposes the reconstructed shot path and course package only. It does not
        expose account details or the source upload.
      </footer>
    </main>
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
