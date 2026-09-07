import Link from "next/link";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { CourseRecordBoard } from "@/app/course-records/course-record-board";
import { getCourseRecordsHubData, verificationTierLabel } from "@/lib/course-records";
export const dynamic = "force-dynamic";
export default async function CourseRecordsPage() {
  const data = await getCourseRecordsHubData();
  return (
    <PageShell>
      <PageHeader
        title="Course records"
        description="Browse public active boards. Each result belongs to its own course, category and period; verified leaders stay separate from pending or manual attempts."
        actions={
          <Button asChild variant="outline">
            <Link href="/courses">All courses</Link>
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">
        {data.totalRecords} visible boards · {data.verifiedChampions} courses with a verified
        leader. This view loads up to 80 accessible courses before matching duplicate course names.
      </p>
      <CourseRecordBoard
        courses={data.courses.map((course) => ({
          id: course.id,
          name: course.name,
          country: course.country,
          recordCount: course.recordCount,
          teeSetCount: course.teeSetCount,
          attemptCount: course.attemptCount,
          champion: course.champion
            ? {
                ...course.champion,
                verificationLabel: verificationTierLabel(course.champion.verificationTier),
                periodLabel: [
                  course.champion.period.replaceAll("_", " "),
                  course.champion.periodStart
                    ? `start ${course.champion.periodStart.toISOString().slice(0, 10)}`
                    : null,
                  course.champion.periodEnd
                    ? `end ${course.champion.periodEnd.toISOString().slice(0, 10)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              }
            : null,
        }))}
      />
      <section className="grid gap-3 rounded-xl border bg-card p-4" aria-labelledby="record-proof">
        <h2 id="record-proof" className="text-lg font-semibold">
          Before you submit
        </h2>
        <p className="text-sm text-muted-foreground">
          Open the exact board to check its course, tee, category, period and required evidence.
          These are requirements, not completed checks for your account.
        </p>
        <ul className="grid gap-3 text-sm">
          <li>
            <strong>Gold:</strong> matched direct Rapsodo import and scorecard screenshot.
          </li>
          <li>
            <strong>Silver:</strong> matched CSV import and scorecard screenshot.
          </li>
          <li>
            <strong>Review required:</strong> screenshots alone, manual edits, duplicate imports or
            course, date, tee and score mismatches must follow the board’s verification result.
          </li>
          <li>
            <strong>Submission:</strong> select a saved eligible round on the exact record page. A
            pending attempt is not a verified record.
          </li>
        </ul>
        <Button asChild variant="outline" className="min-h-11 w-fit">
          <Link href="/rounds">Review saved round evidence</Link>
        </Button>
      </section>
    </PageShell>
  );
}
