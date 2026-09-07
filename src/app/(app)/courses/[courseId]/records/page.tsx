import Link from "next/link";
import { notFound } from "next/navigation";
import { Send } from "lucide-react";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CourseRecordScopes } from "@/app/courses/[courseId]/records/course-record-scopes";
import { CourseCategoryList } from "@/app/courses/[courseId]/records/course-category-list";
import { getCourseRecordCourseData, verificationTierLabel } from "@/lib/course-records";
export const dynamic = "force-dynamic";
export default async function CourseRecordsForCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const [{ courseId }, query] = await Promise.all([params, searchParams]);
  const active = parseTab(query?.tab);
  const data = await getCourseRecordCourseData(courseId, active);
  if (!data) notFound();
  const records = data.recordCards.map(
    ({ record, category, champion, viewerBest, friendToBeat }) => ({
      id: record.id,
      name: category.name,
      description: category.description ?? "",
      scope: record.scope.replaceAll("_", " "),
      period: [
        record.period.replaceAll("_", " "),
        record.periodStart ? `start ${record.periodStart.toISOString().slice(0, 10)}` : null,
        record.periodEnd ? `end ${record.periodEnd.toISOString().slice(0, 10)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      tee: record.teeSetId
        ? (data.teeSets.find((tee) => tee.id === record.teeSetId)?.name ??
          "Recorded tee unavailable")
        : "Any eligible tee",
      format: record.recordType.replaceAll("_", " "),
      proofRequired: record.verificationRequired,
      leader: champion?.profile?.displayName ?? "No verified leader",
      result: champion?.result.scoreLabel ?? "No verified result",
      proof: champion
        ? verificationTierLabel(champion.result.verificationTier)
        : "No verified proof",
      personal: viewerBest?.result.scoreLabel ?? "No verified result",
      friend: friendToBeat?.profile
        ? `${friendToBeat.profile.displayName} · ${friendToBeat.result.scoreLabel}`
        : "No verified friend result",
    }),
  );
  return (
    <PageShell>
      <PageHeader
        title={data.course.name}
        description="Course record boards. Category, tee, format, period and proof requirements stay separate; submissions are checked against the exact board."
        actions={
          <Button asChild variant="outline">
            <Link href="/course-records">All record boards</Link>
          </Button>
        }
      />
      <CourseRecordScopes active={active} counts={data.tabs}>
        <CourseCategoryList key={active} records={records} />
      </CourseRecordScopes>
      <Card className="gap-0 py-0">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Previous rounds you can submit</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Suggestions come from your saved rounds. Each board checks its required source,
                screenshot, course, tee and date before accepting proof.
              </p>
            </div>
            <Badge variant="secondary">{data.previousRounds.length} rounds</Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.previousRounds.map((round) => (
              <article key={round.id} className="rounded-lg border border-border bg-muted/45 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{round.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {round.teeSetName ?? "Any tee"} · {round.holeCount} holes · {round.proofLabel}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold tracking-normal">{round.totalScore}</p>
                </div>
                <div className="mt-3 grid gap-2">
                  {round.suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.recordId}
                      asChild
                      variant="outline"
                      size="sm"
                      className="min-h-11 justify-between whitespace-normal bg-card"
                    >
                      <Link
                        href={`/course-records/${suggestion.recordId}?sessionId=${round.id}#submit-record`}
                        prefetch={false}
                      >
                        <span>{suggestion.label}</span>
                        <span className="inline-flex items-center gap-1">
                          {suggestion.value}
                          <Send className="size-3.5" />
                        </span>
                      </Link>
                    </Button>
                  ))}
                </div>
              </article>
            ))}
            {data.previousRounds.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No saved rounds for this course yet. Import or log a round first, then come back
                here to submit it.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
function parseTab(value?: string): "all_time" | "month" | "friends" | "holes" {
  return value === "month" || value === "friends" || value === "holes" ? value : "all_time";
}
