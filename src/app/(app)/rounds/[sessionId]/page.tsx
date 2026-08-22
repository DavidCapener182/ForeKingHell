import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  ChevronDown,
  ClipboardCheck,
  Cuboid,
  Database,
  FileText,
  Flag,
  MapPinned,
  Save,
  ShieldCheck,
  Share2,
  Upload,
} from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";

import {
  createCourseTwinReplayShareLinkAction,
  updateClubAction,
  updateRoundContextAction,
  updateRoundCourseLinkAction,
  updateRoundHoleAction,
  updateShotClubAction,
} from "@/app/rounds/actions";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobilePageTabs } from "@/components/app/mobile-controls";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { LazyOfflineRoundEditForm as OfflineRoundEditForm } from "@/app/rounds/[sessionId]/lazy-offline-round-edit-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DataPair,
  DataTableFrame,
  MobileDataCard,
  MobileDataList,
  PageShell,
  StatusPill,
} from "@/components/premium";
import { Input } from "@/components/ui/input";
import { LazyRoundEditSelect } from "@/app/rounds/[sessionId]/lazy-round-edit-select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  clubs,
  courseRecordAttempts,
  courseRecordCategories,
  courseRecords,
  courses,
  holes as courseHoles,
  sessions,
  shots,
  teeSets,
  tournaments,
  tournamentSubmissions,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import type { CourseAutoImportResult } from "@/lib/course-auto-enrichment";
import { calculateRoundDifferential, formatHandicapValue } from "@/lib/round-handicap";
import { formatClubType } from "@/lib/rapsodo/parser";
import { isShotPatternFeatureEnabled } from "@/lib/shot-pattern-feature";
import type { RoundMapHole, RoundMapShot } from "@/app/rounds/[sessionId]/round-shot-map";
import { LazyRoundShotMap } from "@/app/rounds/[sessionId]/lazy-round-shot-map";
import { LazyCourseScorecard } from "@/app/rounds/[sessionId]/lazy-course-scorecard";
import { MobileCollapsible } from "@/app/rounds/[sessionId]/mobile-collapsible";
import { LazyRoundReviewTabs } from "@/app/rounds/[sessionId]/lazy-round-review-tabs";
import type { RoundReviewView } from "@/app/rounds/[sessionId]/round-review-tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    view?: string | string[];
  }>;
};
type CenterlineGeojson = {
  type?: unknown;
  coordinates?: unknown;
};

type RoundProofItem = {
  label: string;
  detail: string;
  status: "ready" | "needed" | "optional";
  href?: string;
};

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});
const integerFormatter = new Intl.NumberFormat("en-GB");

const CLUB_TYPE_OPTIONS = [
  "driver",
  "3w",
  "5w",
  "7w",
  "3h",
  "4h",
  "5h",
  "4i",
  "5i",
  "6i",
  "7i",
  "8i",
  "9i",
  "pw",
  "gw",
  "sw",
  "lw",
];

const ROUND_STATUS_OPTIONS = [
  { value: "complete", label: "Complete" },
  { value: "in_progress", label: "In progress" },
] as const;

const roundDetailPrompts = [
  {
    label: "Explain this round",
    prompt:
      "Explain this round review using only the visible score, par, putts, handicap differential, scorecard, map, proof and shot-link evidence.",
    icon: Brain,
  },
  {
    label: "What cost shots?",
    prompt:
      "Identify the visible scoring leaks from this round. Use scorecard, shot-link and proof status only; call out missing evidence.",
    icon: ShieldCheck,
  },
  {
    label: "Build cleanup plan",
    prompt:
      "Build a round cleanup plan from the visible context: scorecard gaps, course link, tee link, unmapped shots, proof and shot corrections.",
    icon: ClipboardCheck,
  },
  {
    label: "Generate round report",
    prompt:
      "Generate a round performance report with score, par, putts, differential, proof readiness, data confidence and one next practice action.",
    icon: FileText,
  },
];

const roundShotCorrectionColumns: DesktopWorkbenchColumn[] = [
  { id: "hole", label: "Hole", locked: true },
  { id: "shot", label: "Shot" },
  { id: "club", label: "Current club", locked: true },
  { id: "carry", label: "Carry" },
  { id: "total", label: "Total" },
  { id: "side", label: "Side" },
  { id: "change-club", label: "Change club" },
  { id: "delete", label: "Delete" },
];

const roundShotCorrectionViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Club corrections",
    href: "?view=corrections#shots",
    detail: "Review every linked launch-monitor row and fix one-shot club labels.",
  },
  {
    title: "Distance audit",
    href: "?view=corrections#shots",
    detail: "Keep carry, total and side distance visible while checking round evidence.",
  },
];

export default async function RoundDetailPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const surface = await getRequestAppSurface();
  const view = parseRoundReviewView((await searchParams)?.view);
  const round = await getRoundDetail(sessionId);

  if (!round) {
    notFound();
  }

  const isRealRound = round.session.type === "real_round";
  const hasClubData = round.shots.length > 0;
  const hasMap = round.mapHoles.length > 0;
  const shotPatternEnabled = isShotPatternFeatureEnabled();
  const nextIncompleteHole = round.holes.find((hole) => hole.score === null) ?? null;
  const currentHole = nextIncompleteHole ?? round.holes[0] ?? null;
  const proofItems: RoundProofItem[] = [
    {
      label: "Rapsodo import",
      detail: hasClubData ? "Launch-monitor shots are attached." : "Scorecard-only round.",
      status: hasClubData ? ("ready" as const) : ("optional" as const),
      href: "/import",
    },
    {
      label: "Scorecard",
      detail: round.totalScore !== null ? "Hole scores are saved." : "Add scores before proof.",
      status: round.totalScore !== null ? ("ready" as const) : ("needed" as const),
      href: "#scorecard",
    },
    {
      label: "Course match",
      detail: round.session.courseId ? "Round is linked to a course." : "Link the course.",
      status: round.session.courseId ? ("ready" as const) : ("needed" as const),
      href: "#context",
    },
    {
      label: "Date match",
      detail: "Round date is used for event windows.",
      status: "ready" as const,
    },
    {
      label: "Tee match",
      detail: round.session.teeSetId ? "Tee set is linked." : "Select a tee set.",
      status: round.session.teeSetId ? ("ready" as const) : ("needed" as const),
      href: "#context",
    },
  ];
  const workbench =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopInsightRail = workbench?.DesktopInsightRail;
  const DesktopTableWorkbenchControls = workbench?.DesktopTableWorkbenchControls;
  const DesktopWorkbenchLayout = workbench?.DesktopWorkbenchLayout;
  const correctionsModule =
    surface === "workbench" && view === "corrections" && hasClubData
      ? await import("@/app/rounds/[sessionId]/round-corrections-panel")
      : null;
  const RoundCorrectionsPanel = correctionsModule?.RoundCorrectionsPanel;
  const RoundShotDeleteButton = correctionsModule?.RoundShotDeleteButton;

  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileRoundDetail
          round={round}
          view={view}
          focusHole={currentHole}
          nextIncompleteHole={nextIncompleteHole}
          hasClubData={hasClubData}
          hasMap={hasMap}
          isRealRound={isRealRound}
          proofItems={proofItems}
          shotPatternEnabled={shotPatternEnabled}
        />
      ) : DesktopInsightRail && DesktopTableWorkbenchControls && DesktopWorkbenchLayout ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/rounds">
                <ArrowLeft className="size-4" />
                Rounds
              </Link>
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              {round.session.courseId ? (
                <>
                  <form action={createCourseTwinReplayShareLinkAction}>
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <Button type="submit" variant="outline">
                      <Share2 className="size-4" />
                      Share 3D replay
                    </Button>
                  </form>
                  <Button asChild variant="outline">
                    <Link
                      href={`/play/${round.session.courseId}?sessionId=${sessionId}`}
                      prefetch={false}
                    >
                      <Cuboid className="size-4" />
                      Open 3D replay
                    </Link>
                  </Button>
                </>
              ) : null}
              <Button asChild variant="outline">
                <Link href="/shots">
                  <Database className="size-4" />
                  Shots
                </Link>
              </Button>
              <Button asChild>
                <Link href="/import">
                  <Upload className="size-4" />
                  Import data
                </Link>
              </Button>
            </div>
          </div>

          <DesktopWorkbenchLayout
            scope="round-detail"
            rail={
              <DesktopInsightRail
                title="AI round rail"
                description="Scorecard, map, proof and shot-link context stay visible while reviewing or correcting this round."
                metrics={[
                  {
                    label: "Score",
                    value: formatNullableInteger(round.totalScore),
                    detail: `Par ${formatNullableInteger(round.totalPar)} · putts ${formatNullableInteger(round.totalPutts)} · diff ${formatHandicapValue(round.handicapDifferential)}.`,
                    tone: round.totalScore !== null ? "green" : "amber",
                  },
                  {
                    label: "Shot evidence",
                    value: hasClubData ? integerFormatter.format(round.shots.length) : "Scorecard",
                    detail: hasClubData
                      ? `${integerFormatter.format(round.roundClubs.length)} clubs and ${integerFormatter.format(round.unmappedShots.length)} unmapped shots.`
                      : "No launch-monitor rows are linked to this round.",
                    tone: hasClubData ? "green" : "amber",
                  },
                  {
                    label: "Proof",
                    value: `${proofItems.filter((item) => item.status === "ready").length}/${proofItems.length}`,
                    detail: proofItems.some((item) => item.status === "needed")
                      ? (proofItems.find((item) => item.status === "needed")?.detail ??
                        "Proof needs review.")
                      : "Record and tournament proof checks are ready.",
                    tone: proofItems.some((item) => item.status === "needed") ? "amber" : "green",
                  },
                  {
                    label: "Map",
                    value: hasMap
                      ? `${integerFormatter.format(round.mapHoles.length)} holes`
                      : "Pending",
                    detail: hasMap
                      ? `${hasClubData ? "Actual" : "Estimated"} shot map available for review.`
                      : round.mapAutoImport
                        ? roundMapImportCopy(round.mapAutoImport)
                        : "No mapped course geometry is linked yet.",
                    tone: hasMap ? "green" : "amber",
                  },
                ]}
                evidence={[
                  `Score ${formatNullableInteger(round.totalScore)} on par ${formatNullableInteger(round.totalPar)} with ${formatNullableInteger(round.totalPutts)} putts.`,
                  `${integerFormatter.format(round.holes.length)} scorecard holes and ${integerFormatter.format(round.shots.length)} launch-monitor shot rows are visible.`,
                  round.session.courseId
                    ? "Round is linked to a course."
                    : "Round still needs a course link before proof is strong.",
                  `${integerFormatter.format(round.recordOpportunities.length)} record opportunities and ${integerFormatter.format(round.tournamentOpportunities.length)} tournament opportunities are visible.`,
                ]}
                prompts={roundDetailPrompts}
                actions={[
                  {
                    label: "Scorecard",
                    href: `?view=scorecard#scorecard`,
                    detail: "Review and correct hole-by-hole scoring.",
                    icon: ClipboardCheck,
                  },
                  {
                    label: hasClubData ? "Shot corrections" : "Import shots",
                    href: hasClubData ? `?view=corrections#shots` : "/import",
                    detail: hasClubData
                      ? "Fix one-shot club labels from the desktop table."
                      : "Attach launch-monitor evidence to this scorecard.",
                    icon: Database,
                  },
                  {
                    label: "Course link",
                    href: `?view=evidence#course-link`,
                    detail: "Check course, tee, rating and slope.",
                    icon: MapPinned,
                  },
                ]}
              />
            }
          >
            <RoundReviewHeader round={round} />

            <LazyRoundReviewTabs value={view} sessionId={sessionId} />

            {view === "summary" ? (
              <RoundLearningSummary round={round} hasClubData={hasClubData} />
            ) : null}

            {view === "map" ? (
              hasMap ? (
                <MobileCollapsible
                  title={hasClubData ? "Actual hole map" : "Estimated hole map"}
                  description="Shot map detail."
                >
                  <Card id="map" className="premium-card scroll-mt-28">
                    <CardHeader>
                      <CardTitle>
                        {hasClubData ? "Actual hole map" : "Estimated hole map"}
                      </CardTitle>
                      <CardDescription>
                        {hasClubData
                          ? "Select a hole to see the saved shot data projected over the mapped course."
                          : "Select a hole to see estimated non-putt strokes placed along the mapped course geometry."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {round.session.courseId && shotPatternEnabled ? (
                        <div className="mb-3 flex justify-end">
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/courses/${round.session.courseId}/shot-pattern`}
                              prefetch={false}
                            >
                              <MapPinned className="size-4" />
                              Open shot pattern
                            </Link>
                          </Button>
                        </div>
                      ) : null}
                      <LazyRoundShotMap
                        holes={round.mapHoles}
                        shots={round.mapShots}
                        courseName={round.session.courseName ?? "Course map"}
                        shotMode={hasClubData ? "actual" : "estimated"}
                      />
                    </CardContent>
                  </Card>
                </MobileCollapsible>
              ) : round.mapAutoImport ? (
                <MobileCollapsible
                  title="Course map"
                  description="Automatic course geometry status."
                >
                  <Card id="map" className="premium-card scroll-mt-28">
                    <CardHeader>
                      <CardTitle>Course map</CardTitle>
                      <CardDescription>{roundMapImportCopy(round.mapAutoImport)}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm leading-6 text-muted-foreground">
                        The review map appears here as soon as the course has tee-to-green geometry.
                      </p>
                      <Button asChild variant="outline" className="sm:w-fit">
                        <Link
                          href={
                            round.session.courseId
                              ? `/courses/${round.session.courseId}/holes`
                              : "/courses"
                          }
                          prefetch={false}
                        >
                          <MapPinned className="size-4" />
                          Open course
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </MobileCollapsible>
              ) : null
            ) : null}

            {view === "evidence" ? (
              <RoundEvidenceSummary
                round={round}
                hasClubData={hasClubData}
                hasMap={hasMap}
                proofItems={proofItems}
              />
            ) : null}

            {view === "corrections" ? (
              <>
                <MobileCollapsible
                  title="Round context"
                  description="Status, weather, wind and notes."
                >
                  <Card id="context" className="premium-card scroll-mt-28">
                    <CardHeader>
                      <CardTitle>Round context</CardTitle>
                      <CardDescription>
                        Save partial-round state, weather, wind and equipment notes so comparisons
                        explain the conditions behind the score.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <OfflineRoundEditForm
                        action={updateRoundContextAction}
                        editKind="round-context"
                        recordVersion={round.session.updatedAt.toISOString()}
                        className="grid gap-3 lg:grid-cols-[180px_1fr_1fr_1fr]"
                      >
                        <input type="hidden" name="sessionId" value={round.session.id} />
                        <label className="grid gap-2 text-sm font-medium">
                          <span>Status</span>
                          <LazyRoundEditSelect
                            name="roundStatus"
                            defaultValue={round.session.roundStatus}
                            options={ROUND_STATUS_OPTIONS}
                            triggerClassName="h-10 w-full bg-card"
                          />
                        </label>
                        <RoundContextInput
                          label="Conditions"
                          name="weatherConditions"
                          value={round.weather.conditions}
                        />
                        <RoundContextInput label="Wind" name="wind" value={round.weather.wind} />
                        <RoundContextInput
                          label="Temperature"
                          name="temperature"
                          value={round.weather.temperature}
                        />
                        <label className="grid gap-2 text-sm font-medium lg:col-span-2">
                          <span>Round notes</span>
                          <Input
                            name="notes"
                            defaultValue={round.session.notes ?? ""}
                            className="h-10 rounded-xl bg-card"
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-medium lg:col-span-2">
                          <span>Equipment notes</span>
                          <Input
                            name="equipmentNotes"
                            defaultValue={round.session.equipmentNotes ?? ""}
                            className="h-10 rounded-xl bg-card"
                          />
                        </label>
                        <Button
                          type="submit"
                          className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 lg:w-fit"
                        >
                          <Save className="size-4" />
                          Save context
                        </Button>
                      </OfflineRoundEditForm>
                    </CardContent>
                  </Card>
                </MobileCollapsible>

                <MobileCollapsible
                  title="Course link"
                  description="Course and tee data used by the scorecard."
                >
                  <Card id="course-link" className="premium-card scroll-mt-28">
                    <CardHeader>
                      <CardTitle>Course link</CardTitle>
                      <CardDescription>
                        Change the course or tee set used by the scorecard, handicap calculation,
                        and hole map.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <OfflineRoundEditForm
                        action={updateRoundCourseLinkAction}
                        editKind="round-course-link"
                        recordVersion={round.session.updatedAt.toISOString()}
                        className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end"
                      >
                        <input type="hidden" name="sessionId" value={round.session.id} />
                        <label className="grid gap-2 text-sm font-medium">
                          <span>Course / tee set</span>
                          <LazyRoundEditSelect
                            name="teeSetId"
                            defaultValue={round.session.teeSetId ?? undefined}
                            placeholder="Select course"
                            options={round.courseOptions.map((option) => ({
                              value: option.teeSetId,
                              label: `${option.courseName} - ${option.teeSetName}${
                                option.courseRating && option.slopeRating
                                  ? ` (${numberFormatter.format(option.courseRating)}/${option.slopeRating})`
                                  : ""
                              }`,
                            }))}
                            triggerClassName="h-11 w-full bg-card"
                          />
                        </label>
                        <Button
                          type="submit"
                          className="h-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Save className="size-4" />
                          Update link
                        </Button>
                        <Button asChild variant="outline" className="h-11 rounded-xl">
                          <Link
                            href={
                              round.session.courseId
                                ? `/courses/${round.session.courseId}/holes`
                                : "/courses"
                            }
                            prefetch={false}
                          >
                            <MapPinned className="size-4" />
                            Edit course
                          </Link>
                        </Button>
                      </OfflineRoundEditForm>
                    </CardContent>
                  </Card>
                </MobileCollapsible>

                {!hasClubData ? (
                  <MobileCollapsible
                    title="Real round data"
                    description="Scorecard-only stats and estimates."
                  >
                    <Card className="premium-card">
                      <CardHeader>
                        <CardTitle>Real round data</CardTitle>
                        <CardDescription>
                          This scorecard is saved without launch-monitor shots, so it contributes to
                          real and combined handicap but not bag or simulator stats.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                        <MiniMetric
                          label="Net"
                          value={formatNullableInteger(round.totalNetScore)}
                        />
                        <MiniMetric
                          label="FIR / GIR"
                          value={`${round.fairwaysHit} / ${round.gir}`}
                        />
                        <MiniMetric
                          label="Chips"
                          value={formatNullableInteger(round.totalChipShots)}
                        />
                        <MiniMetric
                          label="Sand"
                          value={formatNullableInteger(round.totalSandShots)}
                        />
                        <MiniMetric
                          label="Penalties"
                          value={formatNullableInteger(round.totalPenalties)}
                        />
                        <MiniMetric
                          label="Map estimates"
                          value={integerFormatter.format(round.mapShots.length)}
                        />
                      </CardContent>
                    </Card>
                  </MobileCollapsible>
                ) : null}
              </>
            ) : null}

            {view === "scorecard" ? <DigitalRoundScorecard round={round} /> : null}

            {view === "corrections" ? (
              <section id="scorecard" className="grid scroll-mt-28 gap-3">
                <ReviewAccordion
                  title="Hole-by-hole scorecard"
                  description={
                    isRealRound
                      ? "Edit score, putts, short-game stats, fairway hit and GIR for this real round."
                      : "Edit score, putts, missing strokes, fairway hit and GIR after the import."
                  }
                  count={`${round.holes.length} holes`}
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {round.holes.map((hole) => (
                      <OfflineRoundEditForm
                        id={`hole-${hole.holeNumber}`}
                        key={hole.holeNumber}
                        action={updateRoundHoleAction}
                        editKind="round-hole"
                        recordVersion={round.session.updatedAt.toISOString()}
                        className="apple-panel-strong p-3"
                      >
                        <input type="hidden" name="sessionId" value={round.session.id} />
                        <input type="hidden" name="holeNumber" value={hole.holeNumber} />
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">Hole {hole.holeNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatHoleSummary(hole)}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {hasClubData ? `${hole.shots.length} CSV shots` : "Real scorecard"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <RoundNumberInput label="Score" name="score" value={hole.score} />
                          <RoundNumberInput label="Putts" name="putts" value={hole.putts} />
                          <RoundNumberInput
                            label="Missing"
                            name="penalties"
                            value={hole.penalties}
                          />
                        </div>
                        {isRealRound ? (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <RoundNumberInput
                              label="Chips"
                              name="chipShots"
                              value={hole.chipShots}
                            />
                            <RoundNumberInput
                              label="Sand"
                              name="greensideSandShots"
                              value={hole.greensideSandShots}
                            />
                          </div>
                        ) : null}
                        <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-card p-2 ring-1 ring-border">
                          {isRealRound ? (
                            <>
                              <MiniMetric
                                label="Net"
                                value={formatNullableInteger(hole.netScore)}
                              />
                              <MiniMetric
                                label="Chips"
                                value={formatNullableInteger(hole.chipShots)}
                              />
                              <MiniMetric
                                label="Sand"
                                value={formatNullableInteger(hole.greensideSandShots)}
                              />
                            </>
                          ) : (
                            <>
                              <MiniMetric label="Launch" value={hole.shots.length.toString()} />
                              <MiniMetric label="Putts" value={formatNullableInteger(hole.putts)} />
                              <MiniMetric
                                label="Missing"
                                value={formatNullableInteger(hole.penalties)}
                              />
                            </>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {strokeAccountingLabel(hole)}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <RoundSelect label="Fairway" name="fairwayHit" value={hole.fairwayHit} />
                          <RoundSelect label="GIR" name="gir" value={hole.gir} />
                        </div>
                        <Button type="submit" variant="outline" size="sm" className="mt-3 w-full">
                          <Save className="size-4" />
                          Save hole
                        </Button>
                      </OfflineRoundEditForm>
                    ))}
                  </div>
                </ReviewAccordion>

                {hasClubData ? (
                  <ReviewAccordion
                    title="Clubs in this round"
                    description="Fix a club name, brand, or model once and all shots linked to that club update."
                    count={`${round.roundClubs.length} clubs`}
                  >
                    <div className="space-y-3">
                      {round.roundClubs.map((club) => (
                        <OfflineRoundEditForm
                          key={club.id}
                          action={updateClubAction}
                          editKind="club"
                          recordVersion={round.session.updatedAt.toISOString()}
                          className="apple-panel-strong p-3"
                        >
                          <input type="hidden" name="sessionId" value={round.session.id} />
                          <input type="hidden" name="clubId" value={club.id} />
                          <div className="grid gap-2 sm:grid-cols-[0.8fr_1fr_1fr_auto]">
                            <label className="space-y-1">
                              <span className="text-xs text-muted-foreground">Type</span>
                              <ClubTypeSelect name="clubType" value={club.type} />
                            </label>
                            <label className="space-y-1">
                              <span className="text-xs text-muted-foreground">Brand</span>
                              <Input name="brand" defaultValue={club.brand ?? ""} className="h-9" />
                            </label>
                            <label className="space-y-1">
                              <span className="text-xs text-muted-foreground">Model</span>
                              <Input name="model" defaultValue={club.model ?? ""} className="h-9" />
                            </label>
                            <div className="flex items-end">
                              <Button type="submit" size="sm" className="w-full">
                                Save
                              </Button>
                            </div>
                          </div>
                        </OfflineRoundEditForm>
                      ))}
                      {round.roundClubs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No clubs are linked to this round.
                        </p>
                      ) : null}
                    </div>
                  </ReviewAccordion>
                ) : (
                  <MobileCollapsible
                    title="Handicap input"
                    description="Rating, slope and differential."
                  >
                    <Card className="premium-card">
                      <CardHeader>
                        <CardTitle>Handicap input</CardTitle>
                        <CardDescription>
                          Real rounds use the saved tee rating and slope for the rounds handicap
                          estimate.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-2">
                        <MiniMetric label="Tee" value={round.session.teeName ?? "--"} />
                        <MiniMetric
                          label="Rating / slope"
                          value={formatRatingSlope(
                            round.session.courseRating,
                            round.session.slopeRating,
                          )}
                        />
                        <MiniMetric
                          label="Gross / net"
                          value={`${formatNullableInteger(round.totalScore)} / ${formatNullableInteger(round.totalNetScore)}`}
                        />
                        <MiniMetric
                          label="Differential"
                          value={formatHandicapValue(round.handicapDifferential)}
                        />
                      </CardContent>
                    </Card>
                  </MobileCollapsible>
                )}
              </section>
            ) : null}

            {view === "corrections" && RoundCorrectionsPanel && RoundShotDeleteButton ? (
              <>
                {hasClubData ? (
                  <RoundCorrectionsPanel shotCount={round.shots.length}>
                    <ReviewAccordion
                      id="shots"
                      title="Shot corrections"
                      description="Correct a single-shot club label, or permanently remove a shot that should not count on this scorecard. Delete can change the mapped hole score; exclusion elsewhere remains stats-only."
                      count={`${round.shots.length} shots`}
                    >
                      <div data-workbench-scope="round-shots">
                        <DesktopTableWorkbenchControls
                          viewKey={`round-shots-${round.session.id}`}
                          scope="round-shots"
                          currentViewLabel="Round shot corrections"
                          resultLabel={`${integerFormatter.format(round.shots.length)} shots`}
                          columns={roundShotCorrectionColumns}
                          suggestedViews={roundShotCorrectionViews}
                          exportTableId="round-shots"
                          exportFileName="forekinghell-round-shot-corrections.csv"
                          className="mb-3"
                        />
                        <DataTableFrame
                          mainTable
                          mainTableLabel="Round shot club corrections table"
                          stickyFirstColumn
                          mobile={
                            <MobileDataList>
                              {round.shots.length > 0 ? (
                                round.shots.map((shot) => (
                                  <MobileDataCard
                                    key={shot.id}
                                    title={clubLabel(shot)}
                                    subtitle={`Hole ${formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber)}`}
                                    action={
                                      <Badge variant="outline">
                                        Shot {shot.shotNumber ?? "--"}
                                      </Badge>
                                    }
                                  >
                                    <DataPair
                                      label="Carry"
                                      value={`${formatMetric(shot.carryYd)} yd`}
                                    />
                                    <DataPair
                                      label="Total"
                                      value={`${formatMetric(shot.totalYd)} yd`}
                                    />
                                    <DataPair
                                      label="Side"
                                      value={`${formatMetric(shot.sideCarryYd)} yd`}
                                    />
                                    <OfflineRoundEditForm
                                      action={updateShotClubAction}
                                      editKind="shot-club"
                                      recordVersion={round.session.updatedAt.toISOString()}
                                      className="grid gap-2"
                                    >
                                      <input
                                        type="hidden"
                                        name="sessionId"
                                        value={round.session.id}
                                      />
                                      <input type="hidden" name="shotId" value={shot.id} />
                                      <LazyRoundEditSelect
                                        name="clubId"
                                        defaultValue={shot.clubId}
                                        options={round.allClubs.map((club) => ({
                                          value: club.id,
                                          label: clubLabel(club),
                                        }))}
                                        triggerClassName="h-9 w-full bg-card"
                                      />
                                      <Button type="submit" size="sm" variant="outline">
                                        Save club
                                      </Button>
                                    </OfflineRoundEditForm>
                                    <RoundShotDeleteButton
                                      sessionId={round.session.id}
                                      shotId={shot.id}
                                      shotLabel={`${clubLabel(shot)} shot ${shot.shotNumber ?? "--"}`}
                                      courseHoleNumber={shot.courseHoleNumber}
                                    />
                                  </MobileDataCard>
                                ))
                              ) : (
                                <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                                  No shots are linked to this round.
                                </div>
                              )}
                            </MobileDataList>
                          }
                        >
                          <Table
                            className="min-w-[1200px]"
                            data-workbench-export-table="round-shots"
                            aria-describedby="round-shots-table-summary"
                          >
                            <TableCaption id="round-shots-table-summary" className="sr-only">
                              Round shot club corrections with hole, shot number, current club,
                              distance metrics, club update controls and permanent deletion.
                            </TableCaption>
                            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                              <TableRow>
                                <TableHead
                                  data-column="hole"
                                  className="sticky left-0 z-20 bg-muted shadow-[1px_0_0_var(--border)]"
                                >
                                  Hole
                                </TableHead>
                                <TableHead data-column="shot" className="text-right">
                                  Shot
                                </TableHead>
                                <TableHead data-column="club">Current club</TableHead>
                                <TableHead data-column="carry" className="text-right">
                                  Carry
                                </TableHead>
                                <TableHead data-column="total" className="text-right">
                                  Total
                                </TableHead>
                                <TableHead data-column="side" className="text-right">
                                  Side
                                </TableHead>
                                <TableHead data-column="change-club">Change club</TableHead>
                                <TableHead data-column="delete">Delete</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {round.shots.map((shot) => (
                                <TableRow
                                  key={shot.id}
                                  tabIndex={0}
                                  className="focus-aaa outline-none"
                                >
                                  <TableCell
                                    data-column="hole"
                                    className="sticky left-0 z-10 bg-card shadow-[1px_0_0_var(--border)]"
                                  >
                                    {formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber)}
                                  </TableCell>
                                  <TableCell data-column="shot" className="text-right">
                                    {shot.shotNumber ?? "--"}
                                  </TableCell>
                                  <TableCell data-column="club" className="font-medium">
                                    {clubLabel(shot)}
                                  </TableCell>
                                  <TableCell data-column="carry" className="text-right">
                                    {formatMetric(shot.carryYd)} yd
                                  </TableCell>
                                  <TableCell data-column="total" className="text-right">
                                    {formatMetric(shot.totalYd)} yd
                                  </TableCell>
                                  <TableCell data-column="side" className="text-right">
                                    {formatMetric(shot.sideCarryYd)} yd
                                  </TableCell>
                                  <TableCell data-column="change-club">
                                    <OfflineRoundEditForm
                                      action={updateShotClubAction}
                                      editKind="shot-club"
                                      recordVersion={round.session.updatedAt.toISOString()}
                                      className="flex gap-2"
                                    >
                                      <input
                                        type="hidden"
                                        name="sessionId"
                                        value={round.session.id}
                                      />
                                      <input type="hidden" name="shotId" value={shot.id} />
                                      <LazyRoundEditSelect
                                        name="clubId"
                                        defaultValue={shot.clubId}
                                        options={round.allClubs.map((club) => ({
                                          value: club.id,
                                          label: clubLabel(club),
                                        }))}
                                        triggerClassName="h-9 min-w-48"
                                      />
                                      <Button type="submit" size="sm" variant="outline">
                                        Save
                                      </Button>
                                    </OfflineRoundEditForm>
                                  </TableCell>
                                  <TableCell data-column="delete">
                                    <RoundShotDeleteButton
                                      sessionId={round.session.id}
                                      shotId={shot.id}
                                      shotLabel={`${clubLabel(shot)} shot ${shot.shotNumber ?? "--"}`}
                                      courseHoleNumber={shot.courseHoleNumber}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                              {round.shots.length === 0 ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={8}
                                    className="h-24 text-center text-muted-foreground"
                                  >
                                    No shots are linked to this round.
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </TableBody>
                          </Table>
                        </DataTableFrame>
                      </div>
                    </ReviewAccordion>
                  </RoundCorrectionsPanel>
                ) : null}

                {round.unmappedShots.length > 0 ? (
                  <Alert>
                    <AlertTitle>
                      {integerFormatter.format(round.unmappedShots.length)} unmapped shots
                    </AlertTitle>
                    <AlertDescription>
                      These shots have no hole assignment. Re-import with adjusted hole shot counts
                      if the split needs to change.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </>
            ) : null}
          </DesktopWorkbenchLayout>
        </>
      ) : null}
    </PageShell>
  );
}

function parseRoundReviewView(value: string | string[] | undefined): RoundReviewView {
  const selected = Array.isArray(value) ? value[0] : value;

  switch (selected) {
    case "scorecard":
    case "map":
    case "evidence":
    case "corrections":
      return selected;
    default:
      return "summary";
  }
}

type RoundDetail = NonNullable<Awaited<ReturnType<typeof getRoundDetail>>>;
type RoundDetailHole = RoundDetail["holes"][number];

function RoundReviewHeader({ round }: { round: RoundDetail }) {
  return (
    <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="sky">{formatSessionType(round.session.type)}</StatusPill>
          <span className="text-xs font-medium text-muted-foreground">
            {round.session.roundStatus === "in_progress" ? "In progress" : "Complete"}
          </span>
        </div>
        <h1 className="mt-3 truncate text-3xl font-semibold tracking-tight">
          {round.session.courseName ?? round.session.fileName ?? "Round review"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatDate(round.session.date)} · {round.session.teeName ?? "Tee not set"}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {round.holes.length} holes ·{" "}
        {formatRatingSlope(round.session.courseRating, round.session.slopeRating)} rating / slope
      </p>
    </header>
  );
}

function RoundLearningSummary({
  round,
  hasClubData,
}: {
  round: RoundDetail;
  hasClubData: boolean;
}) {
  const review = getCompanionRoundReview(round);

  return (
    <section className="grid gap-4" data-round-review-summary>
      <section className="grid gap-5 rounded-xl border bg-card p-5 shadow-sm xl:grid-cols-[minmax(0,0.8fr)_minmax(420px,1.2fr)] xl:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Final score
          </p>
          <div className="mt-3 flex items-end gap-4">
            <p className="text-6xl font-semibold leading-none tracking-[-0.055em] tabular-nums sm:text-7xl">
              {formatNullableInteger(round.totalScore)}
            </p>
            <p className="pb-1 text-2xl font-semibold text-primary tabular-nums">
              {formatScoreToPar(round.totalScore, round.totalPar)}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x rounded-xl bg-muted/45 py-3 text-center">
            <MiniSummaryStat label="Putts" value={formatNullableInteger(round.totalPutts)} />
            <MiniSummaryStat
              label="Differential"
              value={formatHandicapValue(round.handicapDifferential)}
            />
            <MiniSummaryStat
              label="Evidence"
              value={hasClubData ? `${round.shots.length} shots` : "Scorecard"}
            />
          </div>
        </div>
        <ScoringBreakdown holes={round.holes} />
      </section>

      <section
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
        aria-label="Round learning review"
      >
        <LearningRow label="Best part" value={review.strongestArea} />
        <LearningRow label="Costliest part" value={review.costliestArea} />
        <LearningRow label="Turning point" value={review.turningPoint} />
        <LearningRow label="Strategy result" value={review.strategyResult} />
        <LearningRow
          label="Next practice action"
          value={review.nextPractice}
          action={
            <Button asChild size="sm">
              <Link
                href={`/practice?intent=round_preparation&source=round_review&roundId=${round.session.id}`}
              >
                Build practice
              </Link>
            </Button>
          }
        />
      </section>
    </section>
  );
}

function LearningRow({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b px-4 py-4 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="font-semibold">{value}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function ScoringBreakdown({
  holes,
  compact = false,
}: {
  holes: RoundDetail["holes"];
  compact?: boolean;
}) {
  const scored = holes.filter(
    (hole): hole is typeof hole & { score: number } => typeof hole.score === "number",
  );
  const segments = [
    {
      label: "Birdie or better",
      count: scored.filter((hole) => hole.score < hole.par).length,
      className: "bg-[var(--status-success-foreground)]",
    },
    {
      label: "Par",
      count: scored.filter((hole) => hole.score === hole.par).length,
      className: "bg-primary",
    },
    {
      label: "Bogey",
      count: scored.filter((hole) => hole.score - hole.par === 1).length,
      className: "bg-[var(--status-warning-foreground)]",
    },
    {
      label: "Double+",
      count: scored.filter((hole) => hole.score - hole.par >= 2).length,
      className: "bg-destructive",
    },
  ];

  return (
    <section
      className={compact ? "mt-4" : "rounded-xl bg-muted/30 p-4"}
      aria-label="Scoring breakdown"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Scoring breakdown
          </p>
          {!compact ? (
            <p className="mt-1 text-sm text-muted-foreground">Where the card was won and lost.</p>
          ) : null}
        </div>
        <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
      </div>
      {scored.length > 0 ? (
        <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
            {segments.map((segment) =>
              segment.count > 0 ? (
                <span
                  key={segment.label}
                  className={segment.className}
                  style={{ width: `${(segment.count / scored.length) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {segments.map((segment) => (
              <div key={segment.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{segment.label}</span>
                <span className="font-semibold tabular-nums">{segment.count}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Complete the scorecard to see the scoring shape.
        </p>
      )}
    </section>
  );
}

function DigitalRoundScorecard({
  round,
  compact = false,
}: {
  round: RoundDetail;
  compact?: boolean;
}) {
  if (round.holes.length === 0) {
    return (
      <section className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        No scorecard holes are saved.
      </section>
    );
  }

  return (
    <section
      id="scorecard"
      className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm"
      data-digital-scorecard
    >
      <div className="flex items-end justify-between gap-4 border-b bg-muted/35 px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Scorecard
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {round.session.courseName ?? round.session.fileName ?? "Saved round"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {round.session.teeName ?? "Tee not set"} · {formatDate(round.session.date)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold leading-none tabular-nums">
            {formatNullableInteger(round.totalScore)}
          </p>
          <p className="mt-1 text-sm font-semibold text-primary">
            {formatScoreToPar(round.totalScore, round.totalPar)}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table
          className={compact ? "w-full min-w-[34rem] text-sm" : "w-full min-w-[46rem] text-sm"}
        >
          <caption className="sr-only">Digital hole-by-hole scorecard.</caption>
          <thead className="bg-muted/30 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Hole</th>
              <th className="px-3 py-3 text-center">Par</th>
              <th className="px-3 py-3 text-center">Score</th>
              <th className="px-3 py-3 text-center">Putts</th>
              <th className="px-3 py-3 text-center">GIR</th>
              <th className="px-3 py-3 text-center">Penalty</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {round.holes.map((hole) => (
              <tr key={hole.holeNumber} className="hover:bg-muted/25">
                <td className="px-4 py-3 font-semibold tabular-nums">{hole.holeNumber}</td>
                <td className="px-3 py-3 text-center text-muted-foreground tabular-nums">
                  {hole.par}
                </td>
                <td className="px-3 py-3 text-center">
                  <ScoreMark score={hole.score} par={hole.par} />
                </td>
                <td className="px-3 py-3 text-center tabular-nums">
                  {formatNullableInteger(hole.putts)}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={
                      hole.gir === true
                        ? "font-semibold text-[var(--status-success-foreground)]"
                        : "text-muted-foreground"
                    }
                  >
                    {hole.gir === null ? "--" : hole.gir ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-3 py-3 text-center tabular-nums">
                  {formatNullableInteger(hole.penalties)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/35 font-semibold">
            <tr>
              <td className="px-4 py-3">Total</td>
              <td className="px-3 py-3 text-center tabular-nums">
                {formatNullableInteger(round.totalPar)}
              </td>
              <td className="px-3 py-3 text-center tabular-nums">
                {formatNullableInteger(round.totalScore)}
              </td>
              <td className="px-3 py-3 text-center tabular-nums">
                {formatNullableInteger(round.totalPutts)}
              </td>
              <td className="px-3 py-3 text-center tabular-nums">{round.gir}</td>
              <td className="px-3 py-3 text-center tabular-nums">
                {formatNullableInteger(round.totalPenalties)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function ScoreMark({ score, par }: { score: number | null | undefined; par: number }) {
  if (typeof score !== "number") return <span className="text-muted-foreground">--</span>;
  const difference = score - par;
  return (
    <span
      className={`inline-grid size-8 place-items-center font-semibold tabular-nums ${
        difference < 0
          ? "rounded-full border-2 border-[var(--status-success-foreground)]"
          : difference >= 2
            ? "rounded-md border-2 border-destructive"
            : difference === 1
              ? "rounded-full border border-muted-foreground/60"
              : ""
      }`}
      aria-label={`${score}, ${formatHoleToPar(score, par)}`}
    >
      {score}
    </span>
  );
}

function RoundEvidenceSummary({
  round,
  hasClubData,
  hasMap,
  proofItems,
  compact = false,
}: {
  round: RoundDetail;
  hasClubData: boolean;
  hasMap: boolean;
  proofItems: RoundProofItem[];
  compact?: boolean;
}) {
  const ready = proofItems.filter((item) => item.status === "ready").length;
  const scored = round.holes.filter((hole) => hole.score !== null).length;
  const rows = [
    {
      label: "Scorecard",
      value: `${scored}/${round.holes.length} holes`,
      status: scored === round.holes.length ? "Ready" : "Needed",
    },
    {
      label: "Course & tee",
      value: `${round.session.courseName ?? "Not linked"} · ${round.session.teeName ?? "Tee not set"}`,
      status: round.session.courseId && round.session.teeSetId ? "Ready" : "Needed",
    },
    {
      label: "Shot evidence",
      value: hasClubData ? `${round.shots.length} linked shots` : "Scorecard only",
      status: hasClubData ? "Linked" : "Optional",
    },
    {
      label: "Map",
      value: hasMap ? `${round.mapHoles.length} mapped holes` : "No course geometry",
      status: hasMap ? "Ready" : "Pending",
    },
    {
      label: "Proof status",
      value: `${ready}/${proofItems.length} checks ready`,
      status: ready === proofItems.length ? "Ready" : "Review",
    },
  ];

  return (
    <section
      className={`overflow-hidden rounded-xl border bg-card shadow-sm ${compact ? "" : ""}`}
      data-round-evidence-summary
    >
      <div className="border-b px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Evidence</p>
        <h2 className="mt-1 text-xl font-semibold">What supports this review</h2>
      </div>
      <div className="divide-y">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {row.label}
            </p>
            <p className="text-sm font-medium">{row.value}</p>
            <span className="text-xs font-semibold text-muted-foreground">{row.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniSummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-2">
      <p className="truncate text-base font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function MobileRoundDetail({
  round,
  view,
  focusHole,
  nextIncompleteHole,
  hasClubData,
  hasMap,
  isRealRound,
  proofItems,
  shotPatternEnabled,
}: {
  round: RoundDetail;
  view: RoundReviewView;
  focusHole: RoundDetailHole | null;
  nextIncompleteHole: RoundDetailHole | null;
  hasClubData: boolean;
  hasMap: boolean;
  isRealRound: boolean;
  proofItems: RoundProofItem[];
  shotPatternEnabled: boolean;
}) {
  const completedHoleCount = round.holes.filter((hole) => hole.score !== null).length;
  const roundIsComplete =
    round.holes.length > 0 && nextIncompleteHole === null && round.totalScore !== null;
  const proofReadyCount = proofItems.filter((item) => item.status === "ready").length;
  const courseName = round.session.courseName ?? round.session.fileName ?? "Round review";
  const evidenceSummary = hasClubData
    ? `${integerFormatter.format(round.shots.length)} shots`
    : "Scorecard only";
  const companionReview = getCompanionRoundReview(round);

  return (
    <MobileAppShell className="gap-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <MobileTopBar title={courseName} />

      <div className="px-1">
        <p className="text-[13px] font-medium text-muted-foreground">
          {formatDate(round.session.date)} · {formatSessionType(round.session.type)}
        </p>
      </div>

      <MobileRoundReviewSections
        round={round}
        view={view}
        focusHole={focusHole}
        completedHoleCount={completedHoleCount}
        roundIsComplete={roundIsComplete}
        evidenceSummary={evidenceSummary}
        proofReadyCount={proofReadyCount}
        proofItems={proofItems}
        companionReview={companionReview}
        hasClubData={hasClubData}
        hasMap={hasMap}
        isRealRound={isRealRound}
        shotPatternEnabled={shotPatternEnabled}
      />
    </MobileAppShell>
  );
}

function MobileRoundReviewSections({
  round,
  view,
  focusHole,
  completedHoleCount,
  roundIsComplete,
  evidenceSummary,
  proofReadyCount,
  proofItems,
  companionReview,
  hasClubData,
  hasMap,
  isRealRound,
  shotPatternEnabled,
}: {
  round: RoundDetail;
  view: RoundReviewView;
  focusHole: RoundDetailHole | null;
  completedHoleCount: number;
  roundIsComplete: boolean;
  evidenceSummary: string;
  proofReadyCount: number;
  proofItems: RoundProofItem[];
  companionReview: ReturnType<typeof getCompanionRoundReview>;
  hasClubData: boolean;
  hasMap: boolean;
  isRealRound: boolean;
  shotPatternEnabled: boolean;
}) {
  const baseHref = `/rounds/${round.session.id}`;
  const summary = roundIsComplete ? (
    <MobileRoundResultCard
      totalScore={round.totalScore}
      totalPar={round.totalPar}
      totalPutts={round.totalPutts}
      handicapDifferential={round.handicapDifferential}
      evidenceSummary={evidenceSummary}
      proofReadyCount={proofReadyCount}
      proofItemCount={proofItems.length}
      holes={round.holes}
      review={companionReview}
      sessionId={round.session.id}
      courseId={round.session.courseId}
    />
  ) : focusHole ? (
    <MobileRoundFirstCard
      hole={focusHole}
      completedHoleCount={completedHoleCount}
      holeCount={round.holes.length}
      hasClubData={hasClubData}
    />
  ) : (
    <section className="rounded-[var(--mobile-radius-lg)] bg-card p-4 ring-1 ring-border/70">
      <IOSInlineStatus label="Scorecard needed" tone="attention" />
      <h2 className="mt-2 text-[28px] font-semibold leading-8 tracking-[-0.025em]">
        No holes saved
      </h2>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">
        Add or import round data before reviewing performance.
      </p>
      <Button asChild className="mt-4 min-h-11 w-full rounded-xl">
        <Link href="/import" prefetch={false}>
          <Upload className="size-4" aria-hidden />
          Import round data
        </Link>
      </Button>
    </section>
  );

  const corrections = (
    <div className="grid gap-5">
      {round.unmappedShots.length > 0 ? (
        <div
          className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] px-4 py-3 text-sm text-[var(--status-warning-foreground)]"
          role="status"
        >
          <p className="font-semibold">Shot mapping needs attention</p>
          <p className="mt-1 leading-5 opacity-85">
            {integerFormatter.format(round.unmappedShots.length)} shots are not assigned to a hole.
          </p>
        </div>
      ) : null}
      {!roundIsComplete && focusHole ? (
        <MobileCurrentHoleEditor
          sessionId={round.session.id}
          recordVersion={round.session.updatedAt.toISOString()}
          hole={focusHole}
          hasClubData={hasClubData}
          isRealRound={isRealRound}
        />
      ) : null}
      <MobileRoundPerformance round={round} hasClubData={hasClubData} isRealRound={isRealRound} />
      <MobileRoundScorecard round={round} hasClubData={hasClubData} isRealRound={isRealRound} />
      {hasClubData ? (
        <Button asChild variant="outline" className="min-h-11 w-full rounded-xl">
          <Link
            href={`/surface/workbench?next=${encodeURIComponent(`${baseHref}?view=corrections`)}`}
          >
            Open shot correction table
          </Link>
        </Button>
      ) : null}
    </div>
  );

  return (
    <MobilePageTabs
      initialValue={view}
      ariaLabel="Round review sections"
      tabs={[
        { value: "summary", label: "Summary", href: baseHref, content: summary },
        {
          value: "scorecard",
          label: "Scorecard",
          href: `${baseHref}?view=scorecard`,
          content: <DigitalRoundScorecard round={round} compact />,
        },
        {
          value: "map",
          label: "Map",
          href: `${baseHref}?view=map`,
          content: (
            <MobileRoundMap
              round={round}
              hasClubData={hasClubData}
              hasMap={hasMap}
              shotPatternEnabled={shotPatternEnabled}
              completedReview={roundIsComplete}
            />
          ),
        },
        {
          value: "evidence",
          label: "Evidence",
          href: `${baseHref}?view=evidence`,
          content: (
            <RoundEvidenceSummary
              round={round}
              hasClubData={hasClubData}
              hasMap={hasMap}
              proofItems={proofItems}
              compact
            />
          ),
        },
        {
          value: "corrections",
          label: "Corrections",
          href: `${baseHref}?view=corrections`,
          content: corrections,
        },
      ]}
    />
  );
}

function MobileRoundResultCard({
  totalScore,
  totalPar,
  totalPutts,
  handicapDifferential,
  evidenceSummary,
  proofReadyCount,
  proofItemCount,
  holes,
  review,
  sessionId,
  courseId,
}: {
  totalScore: number | null;
  totalPar: number | null;
  totalPutts: number | null;
  handicapDifferential: number | null;
  evidenceSummary: string;
  proofReadyCount: number;
  proofItemCount: number;
  holes: RoundDetail["holes"];
  review: ReturnType<typeof getCompanionRoundReview>;
  sessionId: string;
  courseId: string | null;
}) {
  return (
    <section className="rounded-[1.2rem] bg-card p-4 ring-1 ring-border/70">
      <IOSInlineStatus
        label={proofReadyCount === proofItemCount ? "Round complete" : "Round saved"}
        tone={proofReadyCount === proofItemCount ? "positive" : "info"}
      />
      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">Final score</p>
          <p className="text-[42px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
            {formatNullableInteger(totalScore)}
          </p>
        </div>
        <p className="pb-1 text-right text-lg font-semibold tabular-nums text-primary">
          {formatScoreToPar(totalScore, totalPar)}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x rounded-xl bg-muted/45 py-3 text-center">
        <MiniSummaryStat label="Putts" value={formatNullableInteger(totalPutts)} />
        <MiniSummaryStat label="Differential" value={formatHandicapValue(handicapDifferential)} />
        <MiniSummaryStat label="Evidence" value={evidenceSummary} />
      </div>
      <ScoringBreakdown holes={holes} compact />
      <IOSGroupedList className="mt-4">
        <IOSListRow label="Best part" value={review.strongestArea} />
        <IOSListRow label="Costliest part" value={review.costliestArea} />
        <IOSListRow label="Turning point" value={review.turningPoint} />
        <IOSListRow label="Strategy result" value={review.strategyResult} />
        <IOSListRow label="Next practice action" value={review.nextPractice} />
      </IOSGroupedList>
      <div className="mt-4 grid gap-2">
        {courseId ? (
          <Button asChild className="min-h-11 w-full rounded-xl">
            <Link href={`/play/${courseId}?sessionId=${sessionId}`}>
              <Cuboid className="size-4" aria-hidden />
              Replay this round
            </Link>
          </Button>
        ) : null}
        <Button
          asChild
          variant={courseId ? "outline" : "default"}
          className="min-h-11 w-full rounded-xl"
        >
          <Link
            href={`/practice?intent=round_preparation&source=round_review&roundId=${sessionId}`}
          >
            Build next practice
          </Link>
        </Button>
      </div>
    </section>
  );
}

function MobileRoundFirstCard({
  hole,
  completedHoleCount,
  holeCount,
  hasClubData,
}: {
  hole: RoundDetailHole;
  completedHoleCount: number;
  holeCount: number;
  hasClubData: boolean;
}) {
  return (
    <section className="grid gap-4 rounded-[1.2rem] bg-card p-4 ring-1 ring-border/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <IOSInlineStatus label="Next action" tone="info" />
          <h2 className="mt-2 text-[30px] font-semibold leading-8 tracking-[-0.025em]">
            Hole {hole.holeNumber}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{formatHoleSummary(hole)}</p>
        </div>
        <span className="text-right text-[13px] font-medium text-muted-foreground tabular-nums">
          {completedHoleCount}/{holeCount} saved
        </span>
      </div>
      <IOSGroupedList>
        <IOSMetricRow label="Hole score" value={formatNullableInteger(hole.score)} />
        <IOSMetricRow label="Hole putts" value={formatNullableInteger(hole.putts)} />
        <IOSListRow
          label="Fairway"
          value={hole.fairwayHit === null ? "--" : hole.fairwayHit ? "Hit" : "Miss"}
        />
        <IOSListRow
          label="Green in regulation"
          value={hole.gir === null ? "--" : hole.gir ? "Hit" : "Miss"}
          detail={hasClubData ? `${hole.shots.length} linked launch-monitor shots` : undefined}
        />
      </IOSGroupedList>
      <Button asChild className="min-h-11 w-full rounded-xl">
        <a href="#mobile-current-hole">
          <Flag className="size-4" aria-hidden />
          Enter hole {hole.holeNumber}
        </a>
      </Button>
    </section>
  );
}

function MobileCurrentHoleEditor({
  sessionId,
  recordVersion,
  hole,
  hasClubData,
  isRealRound,
}: {
  sessionId: string;
  recordVersion: string;
  hole: RoundDetailHole;
  hasClubData: boolean;
  isRealRound: boolean;
}) {
  return (
    <section id="mobile-current-hole" className="grid scroll-mt-28 gap-2">
      <IOSSectionHeader
        title="Current hole"
        description={`${formatHoleSummary(hole)} · ${hasClubData ? `${hole.shots.length} linked shots` : "manual scorecard"}`}
      />
      <OfflineRoundEditForm
        action={updateRoundHoleAction}
        editKind="round-hole"
        recordVersion={recordVersion}
        className="ios-grouped-list grid gap-4 p-4"
      >
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="holeNumber" value={hole.holeNumber} />
        <div className="grid grid-cols-3 gap-2">
          <RoundNumberInput label="Score" name="score" value={hole.score} />
          <RoundNumberInput label="Putts" name="putts" value={hole.putts} />
          <RoundNumberInput label="Missing" name="penalties" value={hole.penalties} />
        </div>
        {isRealRound ? (
          <div className="grid grid-cols-2 gap-2">
            <RoundNumberInput label="Chips" name="chipShots" value={hole.chipShots} />
            <RoundNumberInput
              label="Sand"
              name="greensideSandShots"
              value={hole.greensideSandShots}
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <RoundSelect label="Fairway" name="fairwayHit" value={hole.fairwayHit} />
          <RoundSelect label="GIR" name="gir" value={hole.gir} />
        </div>
        <Button type="submit" className="min-h-11 w-full rounded-xl">
          <Save className="size-4" aria-hidden />
          Save hole {hole.holeNumber}
        </Button>
      </OfflineRoundEditForm>
    </section>
  );
}

function MobileRoundPerformance({
  round,
  hasClubData,
  isRealRound,
  showResult = false,
}: {
  round: RoundDetail;
  hasClubData: boolean;
  isRealRound: boolean;
  showResult?: boolean;
}) {
  return (
    <div className="grid gap-5">
      {showResult ? (
        <section className="grid gap-2">
          <IOSSectionHeader title="Key result" />
          <IOSGroupedList>
            <IOSMetricRow
              label="Gross score"
              value={formatNullableInteger(round.totalScore)}
              detail={
                round.totalPar !== null
                  ? `${formatScoreToPar(round.totalScore, round.totalPar)} against par ${round.totalPar}`
                  : undefined
              }
            />
            {isRealRound ? (
              <IOSMetricRow label="Net score" value={formatNullableInteger(round.totalNetScore)} />
            ) : null}
            <IOSMetricRow label="Putts" value={formatNullableInteger(round.totalPutts)} />
            <IOSMetricRow label="Fairways / GIR" value={`${round.fairwaysHit} / ${round.gir}`} />
            <IOSMetricRow
              label="Handicap differential"
              value={formatHandicapValue(round.handicapDifferential)}
              detail={formatRatingSlope(round.session.courseRating, round.session.slopeRating)}
            />
            {isRealRound ? (
              <>
                <IOSMetricRow label="Chips" value={formatNullableInteger(round.totalChipShots)} />
                <IOSMetricRow label="Sand" value={formatNullableInteger(round.totalSandShots)} />
                <IOSMetricRow
                  label="Penalty / missing strokes"
                  value={formatNullableInteger(round.totalPenalties)}
                />
              </>
            ) : (
              <IOSMetricRow
                label="Launch-monitor evidence"
                value={`${integerFormatter.format(round.shots.length)} shots`}
                detail={`${integerFormatter.format(round.roundClubs.length)} clubs linked`}
              />
            )}
          </IOSGroupedList>
        </section>
      ) : null}

      <section className="grid gap-2">
        <IOSSectionHeader
          title="Round context"
          description="Keep conditions and equipment notes with this result."
        />
        <OfflineRoundEditForm
          action={updateRoundContextAction}
          editKind="round-context"
          recordVersion={round.session.updatedAt.toISOString()}
          className="ios-grouped-list grid gap-3 p-4"
        >
          <input type="hidden" name="sessionId" value={round.session.id} />
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Status</span>
            <LazyRoundEditSelect
              name="roundStatus"
              defaultValue={round.session.roundStatus}
              options={ROUND_STATUS_OPTIONS}
              triggerClassName="h-11 w-full text-base"
            />
          </label>
          <RoundContextInput
            label="Conditions"
            name="weatherConditions"
            value={round.weather.conditions}
          />
          <RoundContextInput label="Wind" name="wind" value={round.weather.wind} />
          <RoundContextInput
            label="Temperature"
            name="temperature"
            value={round.weather.temperature}
          />
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Round notes</span>
            <Input
              name="notes"
              defaultValue={round.session.notes ?? ""}
              className="h-11 rounded-xl bg-background text-base"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Equipment notes</span>
            <Input
              name="equipmentNotes"
              defaultValue={round.session.equipmentNotes ?? ""}
              className="h-11 rounded-xl bg-background text-base"
            />
          </label>
          <Button type="submit" className="min-h-11 w-full rounded-xl">
            <Save className="size-4" aria-hidden />
            Save round context
          </Button>
        </OfflineRoundEditForm>
      </section>

      {!hasClubData ? (
        <p className="text-[13px] leading-5 text-muted-foreground">
          This scorecard contributes to real-round and combined handicap views, but not bag or
          simulator statistics until shot evidence is attached.
        </p>
      ) : null}
    </div>
  );
}

function MobileRoundScorecard({
  round,
  hasClubData,
  isRealRound,
  showOverview = false,
}: {
  round: RoundDetail;
  hasClubData: boolean;
  isRealRound: boolean;
  showOverview?: boolean;
}) {
  return (
    <div id="mobile-round-scorecard" className="grid scroll-mt-28 gap-5">
      {showOverview && round.holes.length > 0 ? (
        <section className="grid gap-2">
          <IOSSectionHeader
            title="Score overview"
            description="Swipe the scorecard itself if the full width is needed."
          />
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border/70 [&_a]:min-h-11 [&_summary]:min-h-11">
            <div className="min-w-[40rem] p-2">
              <LazyCourseScorecard
                courseName={round.session.courseName ?? round.session.fileName ?? "Round scorecard"}
                holes={round.holes.map((hole) => ({
                  holeNumber: hole.holeNumber,
                  par: hole.par,
                  yards: hole.yards,
                  score: hole.score,
                  putts: hole.putts,
                  penalties: hole.penalties,
                  shotCount: hole.shots.length > 0 ? hole.shots.length : null,
                }))}
                playerName="ForeKingHell"
                showPenalties={round.holes.some(
                  (hole) => typeof hole.penalties === "number" && hole.penalties > 0,
                )}
                showShotCounts={hasClubData}
                subtitle={`${formatDate(round.session.date)} · ${formatSessionType(round.session.type)}`}
              />
            </div>
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No scorecard holes are saved.</p>
      )}

      {round.holes.length > 0 ? (
        <section className="grid gap-2">
          <IOSSectionHeader
            title="Hole corrections"
            description="Save only the hole you changed."
          />
          <nav aria-label="Jump to hole" className="flex gap-1 overflow-x-auto pb-1">
            {round.holes.map((hole) => (
              <a
                key={hole.holeNumber}
                href={`#mobile-hole-${hole.holeNumber}`}
                className="focus-aaa grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl bg-card text-sm font-semibold ring-1 ring-border/70 outline-none"
                aria-label={`Go to hole ${hole.holeNumber}`}
              >
                {hole.holeNumber}
              </a>
            ))}
          </nav>
          <div className="ios-grouped-list divide-y divide-border/70 overflow-hidden">
            {round.holes.map((hole) => (
              <OfflineRoundEditForm
                id={`mobile-hole-${hole.holeNumber}`}
                key={hole.holeNumber}
                action={updateRoundHoleAction}
                editKind="round-hole"
                recordVersion={round.session.updatedAt.toISOString()}
                className="grid scroll-mt-32 gap-3 p-4"
              >
                <input type="hidden" name="sessionId" value={round.session.id} />
                <input type="hidden" name="holeNumber" value={hole.holeNumber} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[17px] font-semibold">Hole {hole.holeNumber}</h3>
                    <p className="text-[13px] text-muted-foreground">{formatHoleSummary(hole)}</p>
                  </div>
                  <span className="text-[13px] font-medium text-muted-foreground">
                    {hasClubData ? `${hole.shots.length} shots` : "Scorecard"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <RoundNumberInput label="Score" name="score" value={hole.score} />
                  <RoundNumberInput label="Putts" name="putts" value={hole.putts} />
                  <RoundNumberInput label="Missing" name="penalties" value={hole.penalties} />
                </div>
                {isRealRound ? (
                  <div className="grid grid-cols-2 gap-2">
                    <RoundNumberInput label="Chips" name="chipShots" value={hole.chipShots} />
                    <RoundNumberInput
                      label="Sand"
                      name="greensideSandShots"
                      value={hole.greensideSandShots}
                    />
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <RoundSelect label="Fairway" name="fairwayHit" value={hole.fairwayHit} />
                  <RoundSelect label="GIR" name="gir" value={hole.gir} />
                </div>
                <p className="text-[13px] leading-5 text-muted-foreground">
                  {strokeAccountingLabel(hole)}
                </p>
                <Button type="submit" variant="outline" className="min-h-11 w-full rounded-xl">
                  <Save className="size-4" aria-hidden />
                  Save hole {hole.holeNumber}
                </Button>
              </OfflineRoundEditForm>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MobileRoundMap({
  round,
  hasClubData,
  hasMap,
  shotPatternEnabled,
  completedReview = false,
}: {
  round: RoundDetail;
  hasClubData: boolean;
  hasMap: boolean;
  shotPatternEnabled: boolean;
  completedReview?: boolean;
}) {
  return (
    <div className="grid gap-4">
      {hasMap ? (
        <section className="grid gap-2">
          <IOSSectionHeader
            title={hasClubData ? "Actual hole map" : "Estimated hole map"}
            description={
              hasClubData
                ? "Saved shots projected over course geometry."
                : "Estimated non-putt strokes placed along mapped geometry."
            }
          />
          <div className="overflow-hidden rounded-xl bg-slate-950 ring-1 ring-white/10 [&_[data-chart-summary]+div_a]:min-h-11 [&_summary]:min-h-11">
            <LazyRoundShotMap
              holes={round.mapHoles}
              shots={round.mapShots}
              courseName={round.session.courseName ?? "Course map"}
              shotMode={hasClubData ? "actual" : "estimated"}
            />
          </div>
        </section>
      ) : (
        <div className="rounded-xl bg-card p-4 ring-1 ring-border/70">
          <IOSInlineStatus label="Map not ready" tone="attention" />
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            {round.mapAutoImport
              ? roundMapImportCopy(round.mapAutoImport)
              : "No mapped course geometry is linked to this round yet."}
          </p>
        </div>
      )}

      <IOSGroupedList label="Map actions">
        {round.session.courseId && shotPatternEnabled ? (
          <IOSListRow
            label="Open shot pattern"
            detail="Explore the course-wide specialist canvas."
            href={`/courses/${round.session.courseId}/shot-pattern`}
            icon={MapPinned}
          />
        ) : null}
        {round.session.courseId ? (
          <IOSListRow
            label="Open 3D replay"
            detail="Replay this round on the linked course."
            href={`/play/${round.session.courseId}?sessionId=${round.session.id}`}
            icon={Cuboid}
          />
        ) : null}
        {!completedReview ? (
          <IOSListRow
            label="Course setup"
            detail="Review or add hole geometry."
            href={round.session.courseId ? `/courses/${round.session.courseId}/holes` : "/courses"}
            icon={MapPinned}
          />
        ) : null}
      </IOSGroupedList>

      {round.session.courseId && !completedReview ? (
        <form action={createCourseTwinReplayShareLinkAction}>
          <input type="hidden" name="sessionId" value={round.session.id} />
          <Button type="submit" variant="outline" className="min-h-11 w-full rounded-xl">
            <Share2 className="size-4" aria-hidden />
            Create replay share link
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function ReviewAccordion({
  id,
  title,
  description,
  count,
  children,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  count?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-28 gap-0 py-0">
      <Collapsible className="group">
        <CollapsibleTrigger
          type="button"
          className={buttonVariants({
            variant: "ghost",
            size: "lg",
            className:
              "h-auto min-h-14 w-full cursor-pointer items-center justify-between gap-3 whitespace-normal px-4 py-3 text-left text-sm",
          })}
        >
          <span className="min-w-0">
            <span className="block font-semibold tracking-normal">{title}</span>
            {description ? (
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {description}
              </span>
            ) : null}
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
            {count ? <span>{count}</span> : null}
            <ChevronDown
              className="size-4 transition-transform group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border px-4 pb-4 pt-4">
          {children}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

async function getRoundDetail(sessionId: string) {
  const db = getDb();
  const userId = await requireCurrentUserId();
  const [session] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      fileName: sessions.fileName,
      type: sessions.type,
      courseName: sessions.courseName,
      date: sessions.date,
      courseId: sessions.courseId,
      teeSetId: sessions.teeSetId,
      roundStatus: sessions.roundStatus,
      weatherJson: sessions.weatherJson,
      equipmentNotes: sessions.equipmentNotes,
      notes: sessions.notes,
      scorecardJson: sessions.scorecardJson,
      updatedAt: sessions.updatedAt,
      teeName: teeSets.name,
      courseRating: teeSets.courseRating,
      slopeRating: teeSets.slopeRating,
    })
    .from(sessions)
    .leftJoin(teeSets, eq(sessions.teeSetId, teeSets.id))
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session) {
    return null;
  }

  const roundMapGeometry = await resolveRoundMapGeometry(db, session);

  const shotRows = await db
    .select({
      id: shots.id,
      clubId: shots.clubId,
      shotNumber: shots.shotNumber,
      courseHoleNumber: shots.courseHoleNumber,
      courseHoleShotNumber: shots.courseHoleShotNumber,
      clubType: shots.clubType,
      brand: clubs.brand,
      model: clubs.model,
      carryYd: shots.carryYd,
      totalYd: shots.totalYd,
      sideCarryYd: shots.sideCarryYd,
      distanceRemainingYd: shots.distanceRemainingYd,
      courseHoleYards: shots.courseHoleYards,
    })
    .from(shots)
    .innerJoin(clubs, eq(shots.clubId, clubs.id))
    .where(and(eq(shots.sessionId, sessionId), eq(shots.userId, userId)))
    .orderBy(asc(shots.courseHoleNumber), asc(shots.courseHoleShotNumber), asc(shots.shotNumber));
  const clubRows = await db
    .select({
      id: clubs.id,
      type: clubs.type,
      brand: clubs.brand,
      model: clubs.model,
      active: clubs.active,
    })
    .from(clubs)
    .where(eq(clubs.userId, userId))
    .orderBy(asc(clubs.type), asc(clubs.brand), asc(clubs.model));
  const courseHoleRows = roundMapGeometry.teeSetId
    ? await db
        .select({
          holeNumber: courseHoles.holeNumber,
          par: courseHoles.par,
          yards: courseHoles.yards,
          strokeIndex: courseHoles.strokeIndex,
          centerlineGeojson: courseHoles.centerlineGeojson,
        })
        .from(courseHoles)
        .where(eq(courseHoles.teeSetId, roundMapGeometry.teeSetId))
        .orderBy(asc(courseHoles.holeNumber))
    : [];
  const teeSetOptionRows = await db
    .select({
      teeSetId: teeSets.id,
      teeSetName: teeSets.name,
      courseId: teeSets.courseId,
      courseName: courses.name,
      courseRating: teeSets.courseRating,
      slopeRating: teeSets.slopeRating,
    })
    .from(teeSets)
    .innerJoin(courses, eq(teeSets.courseId, courses.id))
    .orderBy(asc(courses.name), asc(teeSets.name));
  const recordOpportunityRows = session.courseId
    ? await db
        .select({
          record: {
            id: courseRecords.id,
            recordType: courseRecords.recordType,
            scope: courseRecords.scope,
            period: courseRecords.period,
          },
          category: {
            name: courseRecordCategories.name,
            sortOrder: courseRecordCategories.sortOrder,
          },
        })
        .from(courseRecords)
        .innerJoin(courseRecordCategories, eq(courseRecords.categoryId, courseRecordCategories.id))
        .where(
          and(eq(courseRecords.courseId, session.courseId), eq(courseRecords.status, "active")),
        )
        .orderBy(asc(courseRecordCategories.sortOrder))
        .limit(8)
    : [];
  const tournamentOpportunityRows = session.courseId
    ? await db
        .select()
        .from(tournaments)
        .where(and(eq(tournaments.courseId, session.courseId), eq(tournaments.status, "open")))
        .orderBy(asc(tournaments.endsAt))
        .limit(8)
    : [];
  const recordAttemptRows = session.courseId
    ? await db
        .select({
          id: courseRecordAttempts.id,
          recordId: courseRecordAttempts.recordId,
          verificationStatus: courseRecordAttempts.verificationStatus,
          verificationTier: courseRecordAttempts.verificationTier,
          submittedAt: courseRecordAttempts.submittedAt,
        })
        .from(courseRecordAttempts)
        .where(
          and(
            eq(courseRecordAttempts.userId, userId),
            eq(courseRecordAttempts.sessionId, sessionId),
          ),
        )
        .orderBy(desc(courseRecordAttempts.submittedAt))
        .limit(20)
    : [];
  const tournamentSubmissionRows = session.courseId
    ? await db
        .select({
          id: tournamentSubmissions.id,
          tournamentId: tournamentSubmissions.tournamentId,
          verificationStatus: tournamentSubmissions.verificationStatus,
          verificationTier: tournamentSubmissions.verificationTier,
          submittedAt: tournamentSubmissions.submittedAt,
        })
        .from(tournamentSubmissions)
        .where(
          and(
            eq(tournamentSubmissions.userId, userId),
            eq(tournamentSubmissions.sessionId, sessionId),
          ),
        )
        .orderBy(desc(tournamentSubmissions.submittedAt))
        .limit(20)
    : [];
  const scorecard = session.scorecardJson ?? [];
  const shotByHole = new Map<number, typeof shotRows>();

  for (const shot of shotRows) {
    if (!shot.courseHoleNumber) {
      continue;
    }

    const existing = shotByHole.get(shot.courseHoleNumber) ?? [];
    existing.push(shot);
    shotByHole.set(shot.courseHoleNumber, existing);
  }

  const holes = scorecard.map((hole) => ({
    ...hole,
    shots: shotByHole.get(hole.holeNumber) ?? [],
  }));
  const roundClubIds = new Set(shotRows.map((shot) => shot.clubId));
  const roundClubs = clubRows.filter((club) => roundClubIds.has(club.id));
  const totalScore = sumNullable(holes.map((hole) => hole.score ?? null));
  const totalNetScore = sumNullable(holes.map((hole) => hole.netScore ?? null));
  const totalPutts = sumNullable(holes.map((hole) => hole.putts ?? null));
  const totalChipShots = sumNullable(holes.map((hole) => hole.chipShots ?? null));
  const totalSandShots = sumNullable(holes.map((hole) => hole.greensideSandShots ?? null));
  const totalPenalties = sumNullable(holes.map((hole) => hole.penalties ?? null));
  const totalPar = holes.length > 0 ? holes.reduce((total, hole) => total + hole.par, 0) : null;
  const handicapDifferential = calculateRoundDifferential({
    totalScore,
    totalPar,
    courseRating: session.courseRating,
    slopeRating: session.slopeRating,
    holesPlayed: holes.length,
  });
  const mapHoles = buildMapHoles(courseHoleRows, holes);
  const actualMapShots: RoundMapShot[] = shotRows.map((shot) => ({
    id: shot.id,
    holeNumber: shot.courseHoleNumber,
    holeShotNumber: shot.courseHoleShotNumber,
    shotNumber: shot.shotNumber,
    clubType: shot.clubType,
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    sideCarryYd: shot.sideCarryYd,
    distanceRemainingYd: shot.distanceRemainingYd,
    courseHoleYards: shot.courseHoleYards,
  }));
  const mapShots =
    session.type === "real_round" && shotRows.length === 0
      ? buildEstimatedMapShots(mapHoles, holes)
      : actualMapShots;
  const recordAttemptByRecordId = new Map<string, (typeof recordAttemptRows)[number]>();
  const tournamentSubmissionByTournamentId = new Map<
    string,
    (typeof tournamentSubmissionRows)[number]
  >();

  for (const attempt of recordAttemptRows) {
    if (!recordAttemptByRecordId.has(attempt.recordId)) {
      recordAttemptByRecordId.set(attempt.recordId, attempt);
    }
  }

  for (const submission of tournamentSubmissionRows) {
    if (!tournamentSubmissionByTournamentId.has(submission.tournamentId)) {
      tournamentSubmissionByTournamentId.set(submission.tournamentId, submission);
    }
  }

  return {
    session,
    weather: normalizeWeather(session.weatherJson),
    holes,
    shots: shotRows,
    allClubs: clubRows.filter((club) => club.active || roundClubIds.has(club.id)),
    roundClubs,
    unmappedShots: shotRows.filter((shot) => !shot.courseHoleNumber),
    totalScore,
    totalNetScore,
    totalPutts,
    totalChipShots,
    totalSandShots,
    totalPenalties,
    totalPar,
    handicapDifferential,
    mapHoles,
    mapShots,
    mapAutoImport: roundMapGeometry.autoImport,
    courseOptions: teeSetOptionRows,
    recordOpportunities: dedupeRecordOpportunities(
      recordOpportunityRows.map((item) => ({
        ...item,
        attempt: recordAttemptByRecordId.get(item.record.id) ?? null,
      })),
    ),
    tournamentOpportunities: tournamentOpportunityRows.map((event) => ({
      ...event,
      submission: tournamentSubmissionByTournamentId.get(event.id) ?? null,
    })),
    fairwaysHit: holes.filter((hole) => hole.fairwayHit === true).length,
    gir: holes.filter((hole) => hole.gir === true).length,
  };
}

function dedupeRecordOpportunities<
  T extends {
    record: {
      id: string;
      recordType: string;
      scope: string;
      period: string;
    };
    category: {
      sortOrder: number;
    };
    attempt: unknown;
  },
>(items: T[]) {
  const byRecordType = new Map<string, T>();

  for (const item of items) {
    const current = byRecordType.get(item.record.recordType);

    if (!current || recordOpportunityPreference(item) > recordOpportunityPreference(current)) {
      byRecordType.set(item.record.recordType, item);
    }
  }

  return [...byRecordType.values()].sort(
    (left, right) =>
      left.category.sortOrder - right.category.sortOrder ||
      recordOpportunityPreference(right) - recordOpportunityPreference(left),
  );
}

function recordOpportunityPreference(item: {
  record: {
    scope: string;
    period: string;
  };
  attempt: unknown;
}) {
  const scopeScore =
    item.record.scope === "public" ? 30 : item.record.scope === "friends" ? 20 : 10;
  const periodScore =
    item.record.period === "all_time" ? 3 : item.record.period === "month" ? 2 : 1;
  const attemptScore = item.attempt ? 1 : 0;

  return scopeScore + periodScore + attemptScore;
}

async function resolveRoundMapGeometry(
  db: ReturnType<typeof getDb>,
  session: { courseId: string | null; teeSetId: string | null },
) {
  if (!session.courseId) {
    return {
      autoImport: null,
      teeSetId: session.teeSetId,
    };
  }

  const existingTeeSetId = await preferredGeometryTeeSetId(db, session.courseId, session.teeSetId);

  if (existingTeeSetId) {
    return {
      autoImport: { changed: false, status: "ready" } satisfies CourseAutoImportResult,
      teeSetId: existingTeeSetId,
    };
  }

  return {
    autoImport: { changed: false, status: "no_geometry_found" } satisfies CourseAutoImportResult,
    teeSetId: session.teeSetId,
  };
}

async function preferredGeometryTeeSetId(
  db: ReturnType<typeof getDb>,
  courseId: string,
  preferredTeeSetId: string | null,
) {
  const holeRows = await db
    .select({
      holeNumber: courseHoles.holeNumber,
      teeSetId: courseHoles.teeSetId,
    })
    .from(courseHoles)
    .where(eq(courseHoles.courseId, courseId))
    .orderBy(asc(courseHoles.holeNumber));

  if (holeRows.length === 0) {
    return null;
  }

  const countByTeeSetId = new Map<string, number>();

  for (const hole of holeRows) {
    countByTeeSetId.set(hole.teeSetId, (countByTeeSetId.get(hole.teeSetId) ?? 0) + 1);
  }

  if (preferredTeeSetId && countByTeeSetId.has(preferredTeeSetId)) {
    return preferredTeeSetId;
  }

  return (
    Array.from(countByTeeSetId.entries()).sort(
      ([leftId, leftCount], [rightId, rightCount]) =>
        rightCount - leftCount || leftId.localeCompare(rightId),
    )[0]?.[0] ?? null
  );
}

function roundMapImportCopy(autoImport: CourseAutoImportResult) {
  if (autoImport.status === "imported") {
    return "Course geometry was imported automatically. Refresh the round if the map is not visible yet.";
  }

  if (autoImport.status === "no_coordinates") {
    return "The course is linked, but Google has not returned usable coordinates for automatic geometry import.";
  }

  if (autoImport.status === "recently_attempted") {
    return "Automatic geometry import has already checked this course recently.";
  }

  if (autoImport.status === "ready") {
    return "The course has saved geometry, but this round is not linked to a mapped tee set yet.";
  }

  return "No automatic tee-to-green geometry was found for this course yet.";
}

function buildMapHoles(
  courseHoleRows: Array<{
    holeNumber: number;
    par: number;
    yards: number;
    strokeIndex: number | null;
    centerlineGeojson: unknown;
  }>,
  holes: Array<{
    holeNumber: number;
    par: number;
    yards: number;
    score?: number | null;
    putts?: number | null;
  }>,
): RoundMapHole[] {
  const courseHoleByNumber = new Map(courseHoleRows.map((hole) => [hole.holeNumber, hole]));

  return holes
    .map((hole) => {
      const courseHole = courseHoleByNumber.get(hole.holeNumber);
      const geometry = centerlineGeometry(courseHole?.centerlineGeojson);

      return {
        holeNumber: hole.holeNumber,
        par: courseHole?.par ?? hole.par,
        yards: hole.yards > 0 ? hole.yards : (courseHole?.yards ?? 0),
        score: hole.score ?? null,
        putts: hole.putts ?? null,
        geometry,
      };
    })
    .filter((hole) => hole.geometry.length > 0);
}

function centerlineGeometry(value: unknown) {
  const geojson = parseCenterlineGeojson(value);

  if (
    !geojson ||
    typeof geojson !== "object" ||
    Array.isArray(geojson) ||
    geojson.type !== "LineString" ||
    !Array.isArray(geojson.coordinates)
  ) {
    return [];
  }

  const coordinates = geojson.coordinates as unknown[];

  return coordinates
    .filter(
      (coordinate): coordinate is [number, number] =>
        Array.isArray(coordinate) &&
        coordinate.length >= 2 &&
        typeof coordinate[0] === "number" &&
        typeof coordinate[1] === "number",
    )
    .map(([lng, lat]) => [lat, lng] as [number, number]);
}

function parseCenterlineGeojson(value: unknown): CenterlineGeojson | null {
  if (typeof value !== "string") {
    return value as CenterlineGeojson;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "string"
      ? parseCenterlineGeojson(parsed)
      : (parsed as CenterlineGeojson);
  } catch {
    return null;
  }
}

function buildEstimatedMapShots(
  mapHoles: RoundMapHole[],
  holes: Array<{
    holeNumber: number;
    score?: number | null;
    putts?: number | null;
  }>,
): RoundMapShot[] {
  const scorecardHoleByNumber = new Map(holes.map((hole) => [hole.holeNumber, hole]));

  return mapHoles.flatMap((hole) => {
    const scorecardHole = scorecardHoleByNumber.get(hole.holeNumber);

    if (!scorecardHole || typeof scorecardHole.score !== "number") {
      return [];
    }

    const putts = scorecardHole.putts ?? 0;
    const estimatedShotCount = Math.max(1, scorecardHole.score - putts);
    const segmentYards = hole.yards > 0 ? hole.yards / estimatedShotCount : null;

    return Array.from({ length: estimatedShotCount }, (_, index) => {
      const progress = (index + 1) / estimatedShotCount;
      const distanceRemainingYd =
        hole.yards > 0 ? roundOne(Math.max(0, hole.yards * (1 - progress))) : null;

      return {
        id: `estimated-${hole.holeNumber}-${index + 1}`,
        holeNumber: hole.holeNumber,
        holeShotNumber: index + 1,
        shotNumber: index + 1,
        clubType: "estimated-shot",
        carryYd: segmentYards === null ? null : roundOne(segmentYards),
        totalYd: segmentYards === null ? null : roundOne(segmentYards),
        sideCarryYd: 0,
        distanceRemainingYd,
        courseHoleYards: hole.yards > 0 ? hole.yards : null,
      };
    });
  });
}

function formatHoleSummary(hole: { par: number; yards: number; strokeIndex?: number | null }) {
  const parts = [`Par ${hole.par}`];

  if (hole.yards > 0) {
    parts.push(`${hole.yards.toLocaleString("en-GB")} yd`);
  }

  if (hole.strokeIndex) {
    parts.push(`SI ${hole.strokeIndex}`);
  }

  return parts.join(" - ");
}

function RoundNumberInput({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: number | null | undefined;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        defaultValue={value ?? ""}
        className="h-11 bg-background text-base lg:h-9 lg:text-sm"
      />
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function RoundContextInput({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string | null;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <Input
        name={name}
        defaultValue={value ?? ""}
        className="h-11 rounded-xl bg-background text-base lg:h-10 lg:text-sm"
      />
    </label>
  );
}

function RoundSelect({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: boolean | null | undefined;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <LazyRoundEditSelect
        name={name}
        defaultValue={value === null || value === undefined ? "null" : String(value)}
        options={[
          { value: "null", label: "-" },
          { value: "true", label: "Hit" },
          { value: "false", label: "Miss" },
        ]}
        triggerClassName="h-11 w-full text-base lg:h-9 lg:text-sm"
      />
    </label>
  );
}

function ClubTypeSelect({ name, value }: { name: string; value: string }) {
  const options = CLUB_TYPE_OPTIONS.includes(value)
    ? CLUB_TYPE_OPTIONS
    : [value, ...CLUB_TYPE_OPTIONS];

  return (
    <LazyRoundEditSelect
      name={name}
      defaultValue={value}
      options={options.map((option) => ({ value: option, label: formatClubType(option) }))}
      triggerClassName="h-11 w-full text-base lg:h-9 lg:text-sm"
    />
  );
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function normalizeWeather(value: unknown) {
  if (!value || typeof value !== "object") {
    return { conditions: null, wind: null, temperature: null };
  }

  const weather = value as {
    conditions?: unknown;
    wind?: unknown;
    temperature?: unknown;
  };

  return {
    conditions: typeof weather.conditions === "string" ? weather.conditions : null,
    wind: typeof weather.wind === "string" ? weather.wind : null,
    temperature: typeof weather.temperature === "string" ? weather.temperature : null,
  };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatSessionType(value: string) {
  if (value === "real_round") {
    return "Real round";
  }

  if (value === "simulated_course") {
    return "Sim course";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatHole(holeNumber: number | null, holeShotNumber: number | null) {
  if (!holeNumber) {
    return "--";
  }

  return holeShotNumber ? `${holeNumber}.${holeShotNumber}` : holeNumber.toString();
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function formatNullableInteger(value: number | null | undefined) {
  return typeof value === "number" ? integerFormatter.format(value) : "--";
}

function formatScoreToPar(totalScore: number | null, totalPar: number | null) {
  if (totalScore === null || totalPar === null) {
    return "--";
  }

  const difference = totalScore - totalPar;

  if (difference === 0) {
    return "E";
  }

  return difference > 0 ? `+${difference}` : difference.toString();
}

function formatHoleToPar(score: number | null | undefined, par: number) {
  if (typeof score !== "number") return "Not scored";
  const difference = score - par;
  if (difference === 0) return "Par";
  if (difference === -1) return "Birdie";
  if (difference <= -2) return "Under par";
  if (difference === 1) return "Bogey";
  return `+${difference}`;
}

function getCompanionRoundReview(round: RoundDetail) {
  const scored = round.holes
    .filter((hole): hole is typeof hole & { score: number } => typeof hole.score === "number")
    .map((hole) => ({ ...hole, difference: hole.score - hole.par }));
  const strongest = [...scored].sort(
    (left, right) => left.difference - right.difference || left.holeNumber - right.holeNumber,
  )[0];
  const costliest = [...scored].sort(
    (left, right) => right.difference - left.difference || left.holeNumber - right.holeNumber,
  )[0];
  const fairwayAttempts = round.holes.filter((hole) => hole.fairwayHit !== null).length;
  const girAttempts = round.holes.filter((hole) => hole.gir !== null).length;
  const nextPractice =
    (round.totalPenalties ?? 0) >= 2
      ? "Penalty avoidance"
      : round.totalPutts !== null &&
          round.holes.length > 0 &&
          round.totalPutts / round.holes.length >= 2
        ? "Putting pace"
        : girAttempts > 0 && round.gir / girAttempts < 0.4
          ? "Approach control"
          : "Replay the costliest hole";

  return {
    turningPoint: costliest
      ? `Hole ${costliest.holeNumber} · ${formatHoleToPar(costliest.score, costliest.par)}`
      : "Not enough scoring evidence",
    strongestArea: strongest
      ? `Hole ${strongest.holeNumber} · ${formatHoleToPar(strongest.score, strongest.par)}`
      : "Not enough scoring evidence",
    costliestArea: costliest
      ? `Hole ${costliest.holeNumber} · ${costliest.difference > 0 ? `+${costliest.difference}` : "No shots lost"}`
      : "Not enough scoring evidence",
    strategyResult:
      fairwayAttempts > 0 || girAttempts > 0
        ? `${round.fairwaysHit}/${fairwayAttempts || "–"} fairways · ${round.gir}/${girAttempts || "–"} greens`
        : "Course outcome only; strategy evidence was not captured",
    nextPractice,
  };
}

function formatRatingSlope(rating: number | null, slope: number | null) {
  if (typeof rating !== "number" || typeof slope !== "number") {
    return "--";
  }

  return `${numberFormatter.format(rating)} / ${integerFormatter.format(slope)}`;
}

function strokeAccountingLabel(hole: {
  shots: unknown[];
  putts?: number | null;
  penalties?: number | null;
  score?: number | null;
  chipShots?: number | null;
  greensideSandShots?: number | null;
}) {
  const launchShots = hole.shots.length;
  const putts = hole.putts ?? 0;
  const missing = hole.penalties ?? 0;
  const chips = hole.chipShots ?? 0;
  const sand = hole.greensideSandShots ?? 0;
  const accounted = launchShots + putts + missing;

  if (launchShots === 0) {
    return `${putts} putts, ${chips} chips, ${sand} sand shots, ${missing} penalties.`;
  }

  if (typeof hole.score !== "number") {
    return `${launchShots} launch shots + ${putts} putts + ${missing} missing strokes.`;
  }

  return `${launchShots} launch shots + ${putts} putts + ${missing} missing strokes = ${accounted}/${hole.score}.`;
}

function clubLabel(club: {
  type?: string;
  clubType?: string;
  brand: string | null;
  model: string | null;
}) {
  const type = club.type ?? club.clubType ?? "unknown";
  const details = [club.brand, club.model].filter(Boolean).join(" ");
  return details ? `${formatClubType(type)} - ${details}` : formatClubType(type);
}
