import Link from "next/link";
import { Flag, MapPinned, ShieldCheck } from "lucide-react";

import { MobileHoleStrategy } from "@/app/courses/strategy/mobile-hole-strategy";
import { PlaySetupDrawer } from "@/app/play/play-setup-drawer";
import { IOSGroupedList, IOSListRow, IOSSectionHeader } from "@/components/app/ios-mobile";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
  const usedClubs = new Set(data.strategies.map((strategy) => strategy.recommendedClub));
  const pressureClub =
    data.trustedBag
      .filter(
        (club) => usedClubs.has(club.label) && club.sampleSize >= 8 && club.confidence >= 0.55,
      )
      .sort(
        (left, right) => right.confidence - left.confidence || right.sampleSize - left.sampleSize,
      )[0] ?? null;
  const warningClub =
    data.trustedBag
      .filter((club) => usedClubs.has(club.label) && club.sampleSize > 0 && club.confidence < 0.55)
      .sort((left, right) => left.confidence - right.confidence)[0] ?? null;
  const firstHole = data.strategies[0] ?? null;

  return (
    <PageShell>
      <MobileAppShell className="gap-5" data-course-strategy-companion>
        <MobileTopBar title="Course Strategy" />

        <Card>
          <CardHeader>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Overall game plan
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                {data.selectedCourse?.name ?? "Choose a mapped course"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.selectedTee?.name ?? "Tee not selected"}
                {data.selectedTee?.yards
                  ? ` · ${data.selectedTee.yards.toLocaleString("en-GB")} yd`
                  : ""}
              </p>
            </div>
            <CardAction>
              <Badge variant={data.strategies.length > 0 ? "default" : "outline"}>
                {data.strategies.length > 0 ? "Plan ready" : "Setup needed"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <IOSGroupedList label="Round strategy summary" className="bg-card">
              <IOSListRow
                icon={ShieldCheck}
                label="Club to trust"
                value={pressureClub?.label ?? "Building"}
                detail={
                  pressureClub
                    ? `${Math.round(pressureClub.minCarryYd)}–${Math.round(pressureClub.maxCarryYd)} yd measured range`
                    : "Build a measured bag baseline."
                }
              />
              <IOSListRow
                label="Low-confidence warning"
                value={warningClub?.label ?? "No clear warning"}
                detail={
                  warningClub
                    ? `${Math.round(warningClub.confidence * 100)}% confidence from ${warningClub.sampleSize} shots · choose a conservative alternative when this club is required`
                    : "No low-confidence club is separated."
                }
              />
              <IOSListRow
                label="First-hole plan"
                value={firstHole?.recommendedClub ?? "Not ready"}
                detail={
                  firstHole
                    ? `${firstHole.safeTarget} · ${firstHole.expectedCarryRange}`
                    : "Map a tee set and trusted bag values."
                }
              />
            </IOSGroupedList>
          </CardContent>
          <CardFooter className="bg-background/70 p-3">
            <Button asChild className="min-h-12 w-full rounded-xl">
              <Link href="/rounds/new">
                <Flag className="size-4" />
                Start round
              </Link>
            </Button>
          </CardFooter>
        </Card>

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

        <section className="grid gap-2.5">
          <IOSSectionHeader title="Hole plan" description="One decision at a time." />
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
        </section>
      </MobileAppShell>
    </PageShell>
  );
}
