import Link from "next/link";
import { ArrowLeft, MapPinned } from "lucide-react";
import { asc } from "drizzle-orm";

import { createManualRoundAction } from "@/app/rounds/actions";
import {
  DataPanel,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { courses, holes, teeSets } from "@/db/schema";
import { getDb } from "@/db/client";
import { NewRoundForm, type RoundCourseOption } from "./new-round-form";

export const dynamic = "force-dynamic";

export default async function NewRoundPage() {
  const courseOptions = await getRoundCourseOptions();

  return (
    <PageShell size="full">
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
        metrics={[
          {
            label: "Course source",
            value: "FKH courses",
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

      <DataPanel>
        <SectionHeader
          title="Scorecard"
          description="Enter the score and putting data you have now. You can edit every hole after saving."
        />
        <CardContent>
          <NewRoundForm courses={courseOptions} createRoundAction={createManualRoundAction} />
        </CardContent>
      </DataPanel>
    </PageShell>
  );
}

async function getRoundCourseOptions(): Promise<RoundCourseOption[]> {
  const db = getDb();
  const [courseRows, teeSetRows, holeRows] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.name)),
    db.select().from(teeSets).orderBy(asc(teeSets.name)),
    db.select().from(holes).orderBy(asc(holes.holeNumber)),
  ]);
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

  return courseRows.map((course) => ({
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
  })).filter((course) => course.teeSets.length > 0);
}
