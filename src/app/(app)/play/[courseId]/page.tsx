import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import mobileStyles from "@/app/play/[courseId]/course-twin-mobile.module.css";
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
  searchParams: Promise<{
    sessionId?: string;
    tournamentId?: string;
    roundNumber?: string;
    mode?: string;
    hole?: string;
  }>;
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
    <main
      id="main-content"
      data-course-twin-viewport
      className={`${mobileStyles.viewport} relative min-h-[calc(100dvh-3.5rem)] w-full overflow-x-hidden bg-[#07150e] xl:h-[calc(100dvh-3.5rem)] xl:min-h-0 xl:overflow-hidden`}
    >
      <Link
        href="/course-twins"
        prefetch={false}
        data-course-twin-exit
        className={mobileStyles.exitButton}
        aria-label="Exit Course Twin"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
        <span className="sr-only">Exit Course Twin</span>
      </Link>
      <div className="absolute left-4 top-4 z-30 hidden lg:block xl:bottom-3 xl:left-[200px] xl:top-auto 2xl:left-[216px]">
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
        initialMode={
          query.mode === "strategy"
            ? "strategy"
            : query.mode === "replay" || query.sessionId
              ? replay
                ? "replay"
                : "strategy"
              : undefined
        }
        initialHoleNumber={parseHoleNumber(query.hole)}
      />
    </main>
  );
}

function parseRoundNumber(value: string | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 20 ? number : 1;
}

function parseHoleNumber(value: string | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 18 ? number : undefined;
}
