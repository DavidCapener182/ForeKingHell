import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CourseTwinRuntime } from "@/app/play/[courseId]/course-twin-runtime";
import { Button } from "@/components/ui/button";
import { requireCurrentUserId } from "@/lib/current-user";
import { getCourseTwinManifest, getCourseTwinReplay } from "@/lib/course-twin-data";

export const dynamic = "force-dynamic";

export default async function CourseTwinPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ sessionId?: string; tournamentId?: string; roundNumber?: string }>;
}) {
  const [{ courseId }, query, userId] = await Promise.all([
    params,
    searchParams,
    requireCurrentUserId(),
  ]);
  const manifest = await getCourseTwinManifest({ userId, courseId });
  if (!manifest) notFound();
  const replay = await getCourseTwinReplay({
    userId,
    courseId,
    sessionId: query.sessionId,
    manifest,
  });

  return (
    <main id="main-content" className="relative min-h-screen w-full bg-[#07150e]">
      <div className="absolute left-4 top-4 z-20 hidden sm:block">
        <Button asChild variant="secondary" className="shadow-lg">
          <Link href={`/courses/${courseId}/holes`} prefetch={false}>
            <ArrowLeft className="size-4" />
            Course
          </Link>
        </Button>
      </div>
      <CourseTwinRuntime
        manifest={manifest}
        replay={replay}
        tournamentId={query.tournamentId}
        tournamentRoundNumber={parseRoundNumber(query.roundNumber)}
      />
    </main>
  );
}

function parseRoundNumber(value: string | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 20 ? number : 1;
}
