import Link from "next/link";
import { MapPinned } from "lucide-react";

import { MobileHoleStrategy } from "@/app/courses/strategy/mobile-hole-strategy";
import { PlaySetupDrawer } from "@/app/play/play-setup-drawer";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { getCourseStrategyData } from "@/lib/course-strategy-data";
import { requireCurrentUserId } from "@/lib/current-user";

export default async function CourseStrategyCompanionPage({
  searchParams,
}: {
  searchParams?: Promise<{ courseId?: string; teeSetId?: string }>;
}) {
  const params = await searchParams;
  const userId = await requireCurrentUserId();
  const [data, availableTwins] = await Promise.all([
    getCourseStrategyData(params?.courseId, params?.teeSetId),
    listAvailableCourseTwins(userId),
  ]);
  const courseTwinAvailable = availableTwins.some(
    (twin) => twin.courseId === data.selectedCourse?.id,
  );

  return (
    <PageShell>
      <MobileAppShell className="gap-4" data-course-strategy-companion>
        <MobileTopBar title="Caddie Book" />
        <div className="-mt-2 px-0.5">
          <p className="text-sm font-semibold">
            {data.selectedCourse?.name ?? "Choose a mapped course"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.selectedTee?.name ?? "Tee not selected"}
            {data.selectedTee?.yards
              ? ` · ${data.selectedTee.yards.toLocaleString("en-GB")} yd`
              : ""}
          </p>
        </div>

        <PlaySetupDrawer label="Change course or tee">
          <form action="/play/select" className="grid gap-3">
            <input type="hidden" name="destination" value="strategy" />
            <Select name="courseId" defaultValue={data.selectedCourse?.id ?? ""}>
              <SelectTrigger className="min-h-11 w-full" aria-label="Course">
                <SelectValue placeholder="Choose a course" />
              </SelectTrigger>
              <SelectContent>
                {data.courseOptions.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.teeOptions.length > 0 ? (
              <Select name="teeSetId" defaultValue={data.selectedTee?.id ?? ""}>
                <SelectTrigger className="min-h-11 w-full" aria-label="Tee">
                  <SelectValue placeholder="Choose a tee" />
                </SelectTrigger>
                <SelectContent>
                  {data.teeOptions.map((tee) => (
                    <SelectItem key={tee.id} value={tee.id}>
                      {tee.name}
                      {tee.yards ? ` · ${tee.yards.toLocaleString("en-GB")} yd` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button type="submit" className="min-h-11 rounded-xl">
              Load strategy
            </Button>
          </form>
        </PlaySetupDrawer>

        {data.selectedCourse && data.strategies.length > 0 ? (
          <MobileHoleStrategy
            strategies={data.strategies}
            course={data.selectedCourse}
            accountId={userId}
            trustedBag={data.trustedBag}
            tee={data.selectedTee}
            courseTwinAvailable={courseTwinAvailable}
          />
        ) : (
          <Alert>
            <MapPinned aria-hidden />
            <AlertTitle>Strategy not ready</AlertTitle>
            <AlertDescription>
              A mapped tee set and trusted measured bag values are required.{" "}
              <Link href="/play">Complete play setup.</Link>
            </AlertDescription>
          </Alert>
        )}
      </MobileAppShell>
    </PageShell>
  );
}
