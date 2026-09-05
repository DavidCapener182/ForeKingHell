import { MobileStartRound } from "@/app/rounds/new/mobile-start-round";
import Link from "next/link";
import { ArrowLeft, MapPinned } from "lucide-react";
import { asc, eq, inArray, or } from "drizzle-orm";

import { createManualRoundAction } from "@/app/rounds/actions";
import { DataPanel, PageHeader, PageShell, SectionHeader, StatusPill } from "@/components/premium";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { courses, holes, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { NewRoundForm, type RoundCourseOption } from "@/app/rounds/new/new-round-form";
import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

const roundWorkflowSteps = [
  {
    title: "Pick course and tee",
    value: "Current",
    detail: "Use a saved course/tee set so rating, slope and hole pars stay consistent.",
    status: "current" as const,
  },
  {
    title: "Enter hole scores",
    detail: "Score, putts, fairway and green fields are keyboard-friendly on desktop.",
  },
  {
    title: "Add conditions",
    detail: "Weather, wind and equipment notes explain why the number changed.",
  },
  {
    title: "Save and review",
    detail: "The saved round opens the review workspace for edits, proof and records.",
  },
];

const roundWorkflowHelpItems = [
  {
    title: "Handicap confidence",
    detail:
      "Rounds with rating and slope feed the WHS-style estimate; missing tee data stays visible.",
  },
  {
    title: "Course map",
    detail: "Scorecard-only rounds use estimated map markers until shot data is attached.",
  },
  {
    title: "Next action",
    detail: "After saving, review the scorecard before using it for records, challenges or proof.",
  },
];

export default async function NewRoundPage({
  searchParams,
}: {
  searchParams?: Promise<{ courseId?: string; teeSetId?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const [courseOptions, surface] = await Promise.all([
    getRoundCourseOptions(),
    getRequestAppSurface(),
  ]);
  const workbench =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopWorkflowLayout = workbench?.DesktopWorkflowLayout;

  return (
    <PageShell>
      {surface === "companion" && params?.mode !== "history" ? (
        <MobileStartRound
          courses={courseOptions}
          courseId={params?.courseId}
          teeSetId={params?.teeSetId}
          action={createManualRoundAction}
        />
      ) : surface === "companion" ? (
        <MobileAppShell className="gap-3">
          <MobileTopBar title="Add Round" />
          <p className="px-1 text-sm leading-5 text-muted-foreground">
            Pick a course, enter the scorecard, then review it before saving.
          </p>
          <NewRoundForm
            instanceId="mobile-round"
            courses={courseOptions}
            createRoundAction={createManualRoundAction}
          />
        </MobileAppShell>
      ) : DesktopWorkflowLayout ? (
        <div className="grid gap-4" data-new-round-desktop-workflow>
          <div className="flex items-center justify-between gap-4">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/rounds" prefetch={false}>
                <ArrowLeft className="size-4" />
                Rounds
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/courses" prefetch={false}>
                <MapPinned className="size-4" />
                Courses
              </Link>
            </Button>
          </div>

          <PageHeader
            eyebrow={<StatusPill tone="green">Real round</StatusPill>}
            title="Add Round"
            description="Create a scorecard-only real round from an existing course and tee set. It feeds the round history, handicap estimate, and estimated course map."
            visual={
              <PageArtwork
                variant="fairway"
                alt=""
                crop="tee"
                className="h-full min-h-44"
                priority
              />
            }
            metrics={[
              {
                label: "Course source",
                value: "LMWT courses",
                detail: "Pick from saved course and tee-set records.",
              },
              {
                label: "Round type",
                value: "Real",
                detail: "No launch-monitor shots are created.",
              },
              {
                label: "Map",
                value: "Estimated",
                detail: "Non-putt strokes are shown only as estimated markers.",
              },
              {
                label: "Handicap",
                value: "WHS-style",
                detail: "Uses tee rating and slope when available.",
              },
            ]}
          />

          <DesktopWorkflowLayout
            steps={roundWorkflowSteps}
            helpTitle="Round entry help"
            helpDescription="Keep the scorecard reliable"
            helpItems={roundWorkflowHelpItems}
          >
            <DataPanel>
              <SectionHeader
                title="Scorecard"
                description="Enter the score and putting data you have now. You can edit every hole after saving."
              />
              <CardContent>
                <NewRoundForm
                  instanceId="desktop-round"
                  courses={courseOptions}
                  createRoundAction={createManualRoundAction}
                />
              </CardContent>
            </DataPanel>
          </DesktopWorkflowLayout>
        </div>
      ) : null}
    </PageShell>
  );
}

async function getRoundCourseOptions(): Promise<RoundCourseOption[]> {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const courseRows = await db
    .select({
      id: courses.id,
      name: courses.name,
      country: courses.country,
    })
    .from(courses)
    .where(or(eq(courses.visibility, "shared"), eq(courses.createdByUserId, userId)))
    .orderBy(asc(courses.name))
    .limit(200);

  if (courseRows.length === 0) {
    return [];
  }

  const teeSetRows = await db
    .select({
      id: teeSets.id,
      courseId: teeSets.courseId,
      name: teeSets.name,
      par: teeSets.par,
      courseRating: teeSets.courseRating,
      slopeRating: teeSets.slopeRating,
      yards: teeSets.yards,
    })
    .from(teeSets)
    .where(
      inArray(
        teeSets.courseId,
        courseRows.map((course) => course.id),
      ),
    )
    .orderBy(asc(teeSets.name));

  if (teeSetRows.length === 0) {
    return [];
  }

  const holeRows = await db
    .select({
      teeSetId: holes.teeSetId,
      holeNumber: holes.holeNumber,
      par: holes.par,
      yards: holes.yards,
      strokeIndex: holes.strokeIndex,
    })
    .from(holes)
    .where(
      inArray(
        holes.teeSetId,
        teeSetRows.map((teeSet) => teeSet.id),
      ),
    )
    .orderBy(asc(holes.holeNumber));
  const teeSetsByCourse = new Map<string, typeof teeSetRows>();
  const holesByTeeSet = new Map<string, typeof holeRows>();

  for (const teeSet of teeSetRows) {
    const group = teeSetsByCourse.get(teeSet.courseId) ?? [];
    group.push(teeSet);
    teeSetsByCourse.set(teeSet.courseId, group);
  }

  for (const hole of holeRows) {
    const group = holesByTeeSet.get(hole.teeSetId) ?? [];
    group.push(hole);
    holesByTeeSet.set(hole.teeSetId, group);
  }

  return courseRows
    .map((course) => ({
      id: course.id,
      name: course.name,
      country: course.country,
      teeSets: (teeSetsByCourse.get(course.id) ?? []).map((teeSet) => ({
        id: teeSet.id,
        name: teeSet.name,
        par: teeSet.par,
        courseRating: teeSet.courseRating,
        slopeRating: teeSet.slopeRating,
        yards: teeSet.yards,
        holes: (holesByTeeSet.get(teeSet.id) ?? []).map((hole) => ({
          holeNumber: hole.holeNumber,
          par: hole.par,
          yards: hole.yards,
          strokeIndex: hole.strokeIndex,
        })),
      })),
    }))
    .filter((course) => course.teeSets.length > 0);
}
