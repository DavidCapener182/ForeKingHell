import Link from "next/link";
import { ArrowLeft, Medal, Search, ShieldCheck, Trophy } from "lucide-react";

import {
  MobileAppShell,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
} from "@/components/app/ios-mobile";
import { CourseRecordFeaturePanel } from "@/components/features/feature-panels";
import { DataFirstFlowPanel, ProofChecklistPanel } from "@/components/product-polish";
import { CourseLogoArtwork } from "@/components/visuals/course-logo-artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DesktopInsightRail,
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame, PageShell, StatusPill } from "@/components/premium";
import { getCourseRecordsHubData, verificationTierLabel } from "@/lib/course-records";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { isGoogleImageSearchConfigured } from "@/lib/google-image-search";
import { isGooglePlacesConfigured } from "@/lib/google-places";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const integerFormatter = new Intl.NumberFormat("en-GB");
const courseRecordBoardColumns: DesktopWorkbenchColumn[] = [
  { id: "course", label: "Course", locked: true },
  { id: "champion", label: "Champion" },
  { id: "score", label: "Score" },
  { id: "proof", label: "Proof" },
  { id: "boards", label: "Boards" },
  { id: "tees", label: "Tees" },
  { id: "attempts", label: "Attempts" },
  { id: "action", label: "Action", locked: true },
];
const courseRecordsWorkbenchPrompts = [
  {
    label: "Explain this page",
    prompt:
      "Explain my ForeKingHell Course Records page using only visible boards, verified champions, proof tiers, featured board and attempt evidence. Do not invent missing numbers.",
    icon: Search,
  },
  {
    label: "What changed?",
    prompt:
      "Compare the current course-record board with the previous useful record period. Cite visible boards, champions, proof and live attempt changes.",
    icon: Medal,
  },
  {
    label: "Find records to chase",
    prompt:
      "Use visible course-record boards, featured champion, proof requirements and live attempts to suggest which record is worth chasing next.",
    icon: Trophy,
  },
  {
    label: "Check proof tiers",
    prompt:
      "Review the visible proof checklist and explain what blocks Gold, Silver, Bronze or Manual verification for the next attempt.",
    icon: ShieldCheck,
  },
  {
    label: "Generate records report",
    prompt:
      "Generate a course-record report with boards, verified champions, featured board, proof readiness, live attempts and next action.",
    icon: Medal,
  },
];

export default async function CourseRecordsPage() {
  const [data, featureData] = await Promise.all([getCourseRecordsHubData(), getFeatureIdeasData()]);
  const logoLookupEnabled = isGoogleImageSearchConfigured() || isGooglePlacesConfigured();
  const featured = data.courses.find((course) => course.champion) ?? data.courses[0] ?? null;
  const proofItems = [
    {
      label: "Rapsodo import",
      detail: "Gold tier when the board can trace shots back to the imported session.",
      status: "ready" as const,
      href: "/import",
    },
    {
      label: "Scorecard proof",
      detail: "Silver or bronze tier when a round card backs up the score.",
      status: "needed" as const,
      href: "/rounds",
    },
    {
      label: "Course match",
      detail: "Course and provider alias must point at the same honours board.",
      status: "ready" as const,
      href: "/courses",
    },
    {
      label: "Date and tee",
      detail: "Attempt date, tee set and record scope stay visible before submission.",
      status: "needed" as const,
    },
    {
      label: "Manual review",
      detail: "Manual attempts stay separate until proof is checked.",
      status: "optional" as const,
    },
  ];

  return (
    <PageShell>
      <MobileAppShell>
        <MobileTopBar title="Course Records" />
        <MobileRouteTabs group="play" activeKey="records" />
        <MobileTabBar
          activeKey="all"
          className="-mt-4"
          tabs={[
            { key: "all", label: "All", href: "/course-records" },
            { key: "friends", label: "Friends", href: "/leaderboard?tab=courses" },
            { key: "monthly", label: "Monthly", href: "/leaderboard?tab=monthly" },
            { key: "mine", label: "Mine", href: "/profile?tab=records" },
          ]}
        />
        <MobileStatusAction
          label="Verified course champions"
          value={integerFormatter.format(data.verifiedChampions)}
          detail={`${integerFormatter.format(data.totalRecords)} record boards across visible courses`}
          action={
            featured ? (
              <Button
                asChild
                className="min-h-11 rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
              >
                <Link href={`/courses/${featured.id}/records`} prefetch={false}>
                  Open
                </Link>
              </Button>
            ) : null
          }
        />
        <NativeListSection title="Honours boards">
          <IOSGroupedList label="Course record boards">
            {data.courses.map((course) => (
              <IOSListRow
                key={course.id}
                icon={Trophy}
                label={course.name}
                value={course.champion?.scoreLabel ?? `${course.recordCount} boards`}
                detail={
                  course.champion
                    ? `${course.champion.displayName} · ${course.liveAttemptCount} live attempts`
                    : `No verified champion · ${course.liveAttemptCount} live attempts`
                }
                href={`/courses/${course.id}/records`}
                status={
                  <IOSInlineStatus
                    label={
                      course.champion
                        ? verificationTierLabel(course.champion.verificationTier)
                        : "Open board"
                    }
                    tone={course.champion ? "positive" : "attention"}
                  />
                }
              />
            ))}
          </IOSGroupedList>
          {data.courses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              No courses are available yet. Seed known courses from Courses.
            </p>
          ) : null}
        </NativeListSection>
        <IOSDisclosureGroup
          label="Course record supporting detail"
          items={[
            {
              value: "proof",
              title: "Proof requirements",
              summary: "4 tiers",
              description: "What makes a course record trusted",
              content: (
                <IOSGroupedList label="Course record proof requirements">
                  {proofItems.map((item) => (
                    <IOSListRow
                      key={item.label}
                      label={item.label}
                      detail={item.detail}
                      href={item.href}
                      status={
                        <IOSInlineStatus
                          label={
                            item.status === "ready"
                              ? "Ready"
                              : item.status === "needed"
                                ? "Needed"
                                : "Optional"
                          }
                          tone={
                            item.status === "ready"
                              ? "positive"
                              : item.status === "needed"
                                ? "attention"
                                : "neutral"
                          }
                        />
                      }
                    />
                  ))}
                </IOSGroupedList>
              ),
              contentClassName: "px-0",
            },
            {
              value: "goal",
              title: "Plan a record attempt",
              summary: featured?.champion?.scoreLabel ?? "Open",
              description: "Target, friend benchmark and saved-round proof",
              content: (
                <IOSGroupedList label="Course record goal steps">
                  <IOSListRow
                    label="Goal score"
                    value={featured?.champion?.scoreLabel ?? "First mark"}
                    detail={
                      featured?.champion
                        ? `Beat ${featured.champion.displayName}`
                        : "Set the first verified score"
                    }
                    href={featured ? `/courses/${featured.id}/records` : "/courses"}
                  />
                  <IOSListRow
                    label="Submit saved round"
                    detail="Use scorecard proof before the score counts"
                    href="/rounds"
                  />
                  <IOSListRow
                    label="Friend benchmark"
                    detail="Compare against friends on the leaderboard"
                    href="/leaderboard?tab=courses"
                  />
                </IOSGroupedList>
              ),
              contentClassName: "px-0",
            },
            {
              value: "alerts",
              title: "Record alerts",
              summary: "Optional",
              description: "Follow boards without crowding the honours list",
              content: <CourseRecordFeaturePanel data={featureData} />,
              contentClassName: "px-2",
            },
          ]}
        />
      </MobileAppShell>

      <DesktopWorkbenchLayout
        scope="course-records"
        rail={
          <DesktopInsightRail
            title="AI course records rail"
            description="Record boards, proof tiers and featured champion context stay visible while planning the next attempt."
            metrics={[
              {
                label: "Record boards",
                value: integerFormatter.format(data.totalRecords),
                detail: `${integerFormatter.format(data.courses.length)} courses have visible honours-board context.`,
                tone: data.totalRecords > 0 ? "green" : "amber",
              },
              {
                label: "Verified champions",
                value: integerFormatter.format(data.verifiedChampions),
                detail: "Only proof-backed leaders should be treated as trusted targets.",
                tone: data.verifiedChampions > 0 ? "green" : "amber",
              },
              {
                label: "Featured board",
                value: featured?.name ?? "None",
                detail: featured?.champion
                  ? `${featured.champion.displayName} leads with ${featured.champion.scoreLabel}.`
                  : "No verified champion is visible for the featured board yet.",
                tone: featured?.champion ? "sky" : "slate",
              },
              {
                label: "Live attempts",
                value: integerFormatter.format(
                  data.courses.reduce((total, course) => total + course.liveAttemptCount, 0),
                ),
                detail: "Open attempts still need proof before they count.",
                tone: data.courses.some((course) => course.liveAttemptCount > 0)
                  ? "amber"
                  : "slate",
              },
            ]}
            evidence={[
              `${integerFormatter.format(data.totalRecords)} record boards are visible.`,
              `${integerFormatter.format(data.verifiedChampions)} champions are verified.`,
              featured?.champion
                ? `${featured.name} is featured and led by ${featured.champion.displayName}.`
                : "No featured champion is available; AI should not infer a target score.",
              "Gold, Silver, Bronze and Manual proof tiers are shown before submission.",
            ]}
            prompts={courseRecordsWorkbenchPrompts}
            actions={[
              {
                label: "Open featured board",
                href: featured ? `/courses/${featured.id}/records` : "/courses",
                detail: featured
                  ? "Review the current target board."
                  : "Seed or create a course first.",
                icon: Trophy,
              },
              {
                label: "Review proof",
                href: "/rounds",
                detail: "Find scorecard and round evidence for a submission.",
                icon: ShieldCheck,
              },
              {
                label: "Course directory",
                href: "/courses",
                detail: "Check mapped holes, tee sets and course data quality.",
                icon: Search,
              },
            ]}
          />
        }
      >
        <div className="hidden items-center justify-between gap-3 lg:flex">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/courses" prefetch={false}>
              <ArrowLeft className="size-4" />
              Courses
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tournaments" prefetch={false}>
              <Trophy className="size-4" />
              Tournaments
            </Link>
          </Button>
        </div>

        <div className="hidden lg:contents">
          <header className="premium-hero overflow-hidden">
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
              <div>
                <StatusPill tone="amber">Course records</StatusPill>
                <h1 className="mt-3 text-3xl font-semibold tracking-normal text-balance">
                  Become the Course Champion
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Set the record, defend it, and keep verified boards separate from manual
                  scorecards.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {integerFormatter.format(data.totalRecords)} boards
                  </Badge>
                  <Badge variant="outline">
                    {integerFormatter.format(data.verifiedChampions)} verified champions
                  </Badge>
                  <Badge variant="outline">Gold · Silver · Bronze proof</Badge>
                </div>
              </div>
              <div className="rounded-lg border bg-[#F5F6F4] p-3">
                <p className="text-sm font-semibold">Today’s board</p>
                {featured ? (
                  <Link
                    href={`/courses/${featured.id}/records`}
                    prefetch={false}
                    className="mt-3 block"
                  >
                    <CourseLogoArtwork
                      courseName={featured.name}
                      country={featured.country}
                      alt=""
                      logoLookupEnabled={logoLookupEnabled}
                      className="mb-3 block h-24 min-h-0 rounded-lg"
                      sizes="(min-width: 1024px) 320px, 100vw"
                      priority
                    />
                    <p className="font-semibold tracking-normal">{featured.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {featured.champion
                        ? `${featured.champion.displayName} leads with ${featured.champion.scoreLabel}`
                        : "No champion yet. Set the first verified mark."}
                    </p>
                  </Link>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Add or seed a course to open record boards.
                  </p>
                )}
              </div>
            </div>
          </header>

          <ProofChecklistPanel
            title="Record proof tiers"
            description="Gold, Silver, Bronze and Manual proof stay visible before any course-record attempt."
            items={proofItems}
            actionHref="/rounds"
            actionLabel="Review proof"
          />

          <DataFirstFlowPanel
            title="Set record goal"
            description="Turn the honours board into a target, notification and friend benchmark."
            actionHref={featured ? `/courses/${featured.id}/records` : "/courses"}
            actionLabel="Set goal"
            steps={[
              {
                title: "Goal score",
                detail: featured?.champion
                  ? `Beat ${featured.champion.scoreLabel}.`
                  : "Set the first score.",
                status: "ready",
              },
              {
                title: "Notify me",
                detail: "Alert when the board is beaten.",
                status: "optional",
              },
              {
                title: "Friend target",
                detail: "Pick a friend score to chase.",
                status: "optional",
              },
              {
                title: "Submit attempt",
                detail: "Use proof before the score counts.",
                href: "/rounds",
                status: "ready",
              },
              {
                title: "Review board",
                detail: "Keep manual and verified scores separate.",
                href: featured ? `/courses/${featured.id}/records` : "/course-records",
                status: "ready",
              },
            ]}
          />

          <CourseRecordFeaturePanel data={featureData} />

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.courses.map((course, index) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}/records`}
                prefetch={false}
                className="premium-card p-4 transition hover:border-emerald-300"
              >
                <CourseLogoArtwork
                  courseName={course.name}
                  country={course.country}
                  alt=""
                  logoLookupEnabled={logoLookupEnabled}
                  className="mb-3 block h-24 min-h-0 rounded-lg"
                  sizes="(min-width: 1024px) 33vw, 90vw"
                  priority={index === 0}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-normal">{course.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {course.country ?? "Course board"}
                    </p>
                  </div>
                  <Badge variant="outline">{course.recordCount}</Badge>
                </div>
                <div className="mt-3 rounded-lg bg-[#F5F6F4] p-3 text-sm">
                  {course.champion ? (
                    <>
                      <p className="flex items-center gap-2 font-medium">
                        <Medal className="size-4 text-amber-600" />
                        {course.champion.displayName}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {course.champion.scoreLabel} ·{" "}
                        {verificationTierLabel(course.champion.verificationTier)}
                      </p>
                    </>
                  ) : (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <ShieldCheck className="size-4" />
                      No verified champion yet
                    </p>
                  )}
                </div>
              </Link>
            ))}
            {data.courses.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-white p-6 text-sm text-muted-foreground">
                No courses are available yet. Seed known courses from the Courses page.
              </div>
            ) : null}
          </section>

          <CourseRecordBoardTable courses={data.courses} />
        </div>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

type CourseRecordsHubCourse = Awaited<
  ReturnType<typeof getCourseRecordsHubData>
>["courses"][number];

function CourseRecordBoardTable({ courses }: { courses: CourseRecordsHubCourse[] }) {
  return (
    <section id="record-board-table" className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Record board table</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Sortable desktop reference for course boards, current champion, proof tier and live
            attempt pressure.
          </p>
        </div>
        <StatusPill tone={courses.some((course) => course.champion) ? "green" : "amber"}>
          {integerFormatter.format(courses.length)} courses
        </StatusPill>
      </div>
      <DesktopTableWorkbenchControls
        viewKey="course-records-board"
        scope="course-records"
        currentViewLabel="Course record boards"
        resultLabel={`${integerFormatter.format(courses.length)} courses`}
        columns={courseRecordBoardColumns}
        exportTableId="course-records-board"
        exportFileName="forekinghell-course-records-board.csv"
      />
      <DataTableFrame mainTable mainTableLabel="Course records board table" stickyFirstColumn>
        <Table
          data-workbench-scope="course-records"
          data-workbench-export-table="course-records-board"
          aria-describedby="course-records-board-summary"
        >
          <TableCaption id="course-records-board-summary" className="sr-only">
            Course records board table showing course, champion, score, proof tier, board count, tee
            count, live attempts and action links.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="course"
                className="sticky left-0 z-20 min-w-64 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Course
              </TableHead>
              <TableHead data-column="champion">Champion</TableHead>
              <TableHead data-column="score">Score</TableHead>
              <TableHead data-column="proof">Proof</TableHead>
              <TableHead data-column="boards" className="text-right">
                Boards
              </TableHead>
              <TableHead data-column="tees" className="text-right">
                Tees
              </TableHead>
              <TableHead data-column="attempts" className="text-right">
                Attempts
              </TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.length > 0 ? (
              courses.map((course) => (
                <TableRow key={course.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="course"
                    className="sticky left-0 z-10 min-w-64 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <Link
                      href={`/courses/${course.id}/records`}
                      prefetch={false}
                      className="text-emerald-700 hover:underline"
                    >
                      {course.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {course.country ?? "Course board"}
                    </p>
                  </TableCell>
                  <TableCell data-column="champion">
                    {course.champion?.displayName ?? "No verified champion"}
                  </TableCell>
                  <TableCell data-column="score">
                    {course.champion?.scoreLabel ?? "Set first mark"}
                  </TableCell>
                  <TableCell data-column="proof">
                    <Badge variant={course.champion ? "secondary" : "outline"}>
                      {course.champion
                        ? verificationTierLabel(course.champion.verificationTier)
                        : "No proof"}
                    </Badge>
                  </TableCell>
                  <TableCell data-column="boards" className="text-right tabular-nums">
                    {integerFormatter.format(course.recordCount)}
                  </TableCell>
                  <TableCell data-column="tees" className="text-right tabular-nums">
                    {integerFormatter.format(course.teeSetCount)}
                  </TableCell>
                  <TableCell data-column="attempts" className="text-right tabular-nums">
                    {integerFormatter.format(course.liveAttemptCount)}
                  </TableCell>
                  <TableCell data-column="action" className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/courses/${course.id}/records`} prefetch={false}>
                        Open board
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No courses are available yet. Seed known courses from the Courses page.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}
