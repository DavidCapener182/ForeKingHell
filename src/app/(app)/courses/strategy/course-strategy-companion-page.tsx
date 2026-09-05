import Link from "next/link";
import { cookies } from "next/headers";
import { SELECTED_COURSE_COOKIE, SELECTED_TEE_COOKIE } from "@/lib/selected-course";
import { PlaySelectionControls } from "@/app/play/play-selection-controls";
import { MapPinned } from "lucide-react";

import { MobileHoleStrategy } from "@/app/courses/strategy/mobile-hole-strategy";
import { PlaySetupDrawer } from "@/app/play/play-setup-drawer";
import { PageShell } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { courseStrategyMapFromManifest } from "@/lib/course-strategy-map";
import { getCourseTwinManifest } from "@/lib/course-twin-data";
import { getCourseStrategyData } from "@/lib/course-strategy-data";
import { requireCurrentUserId } from "@/lib/current-user";

export default async function CourseStrategyCompanionPage({
  searchParams,
}: {
  searchParams?: Promise<{ courseId?: string; teeSetId?: string }>;
}) {
  const params = await searchParams;
  const userId = await requireCurrentUserId();
  const cookieStore = await cookies();
  const rememberedCourse = cookieStore.get(SELECTED_COURSE_COOKIE)?.value;
  const courseId = params?.courseId ?? rememberedCourse;
  const teeSetId =
    params?.teeSetId ??
    (courseId === rememberedCourse ? cookieStore.get(SELECTED_TEE_COOKIE)?.value : undefined);
  const data = await getCourseStrategyData(courseId, teeSetId, "latest-reliable");
  const courseTwinManifest = data.selectedCourse
    ? await getCourseTwinManifest({ userId, courseId: data.selectedCourse.id })
    : null;
  const courseMap = courseStrategyMapFromManifest(courseTwinManifest);

  return (
    <PageShell>
      <div className="grid min-w-0 gap-3" data-course-strategy-companion>
        <PlaySetupDrawer
          compact
          label={data.selectedCourse?.name ?? "Choose a mapped course"}
          description={data.selectedTee?.name ?? "Tee not selected"}
        >
          <PlaySelectionControls
            key={`${data.selectedCourse?.id}:${data.selectedTee?.id}`}
            destination="/courses/strategy"
            courses={data.courseOptions}
            tees={data.teeOptions.map((tee) => ({
              id: tee.id,
              name: tee.name,
              detail: tee.yards ? `${tee.yards.toLocaleString("en-GB")} yd` : undefined,
            }))}
            selectedCourseId={data.selectedCourse?.id ?? null}
            selectedTeeId={data.selectedTee?.id ?? null}
          />
        </PlaySetupDrawer>

        {data.selectedCourse && data.strategies.length > 0 ? (
          <MobileHoleStrategy
            key={`${data.selectedCourse.id}:${data.selectedTee?.id ?? "none"}`}
            strategies={data.strategies}
            course={data.selectedCourse}
            accountId={userId}
            trustedBag={data.trustedBag}
            tee={data.selectedTee}
            courseTwinAvailable={Boolean(courseTwinManifest)}
            courseMap={courseMap}
          />
        ) : (
          <Alert>
            <MapPinned aria-hidden />
            <AlertTitle>
              <h1>Strategy not ready</h1>
            </AlertTitle>
            <AlertDescription>
              A mapped tee set and trusted measured bag values are required.{" "}
              <Link href="/play">Complete play setup.</Link>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </PageShell>
  );
}
