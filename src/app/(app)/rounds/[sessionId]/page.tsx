import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  ChevronDown,
  CheckCircle2,
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
import {
  DesktopInsightRail,
  DesktopTableWorkbenchControls,
  DesktopWorkbenchLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { CourseScorecardSvg } from "@/components/course-scorecard-svg";
import { MobileAppShell, MobileTopBar } from "@/components/mobile-sports";
import { OfflineRoundEditForm } from "@/components/offline-round-edit-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataPair,
  DataTableFrame,
  MobileDataCard,
  MobileDataList,
  MobileSectionChips,
  PageHeader,
  PageShell,
  StatusPill,
} from "@/components/premium";
import { ProofChecklistPanel } from "@/components/product-polish";
import { Input } from "@/components/ui/input";
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
import { PageArtwork } from "@/components/visuals/page-artwork";
import {
  RoundShotMap,
  type RoundMapHole,
  type RoundMapShot,
} from "@/app/rounds/[sessionId]/round-shot-map";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    sessionId: string;
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
];

const roundShotCorrectionViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Club corrections",
    href: "#shots",
    detail: "Review every linked launch-monitor row and fix one-shot club labels.",
  },
  {
    title: "Distance audit",
    href: "#shots",
    detail: "Keep carry, total and side distance visible while checking round evidence.",
  },
];

export default async function RoundDetailPage({ params }: PageProps) {
  const { sessionId } = await params;
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

  return (
    <PageShell>
      <MobileRoundDetail
        round={round}
        focusHole={currentHole}
        nextIncompleteHole={nextIncompleteHole}
        hasClubData={hasClubData}
        hasMap={hasMap}
        isRealRound={isRealRound}
        proofItems={proofItems}
        shotPatternEnabled={shotPatternEnabled}
      />

      <div className="hidden items-center justify-between gap-4 lg:flex">
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
        className="hidden lg:grid"
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
                href: "#scorecard",
                detail: "Review and correct hole-by-hole scoring.",
                icon: ClipboardCheck,
              },
              {
                label: hasClubData ? "Shot corrections" : "Import shots",
                href: hasClubData ? "#shots" : "/import",
                detail: hasClubData
                  ? "Fix one-shot club labels from the desktop table."
                  : "Attach launch-monitor evidence to this scorecard.",
                icon: Database,
              },
              {
                label: "Course link",
                href: "#course-link",
                detail: "Check course, tee, rating and slope.",
                icon: MapPinned,
              },
            ]}
          />
        }
      >
        <PageHeader
          eyebrow={<StatusPill tone="sky">{formatSessionType(round.session.type)}</StatusPill>}
          title={round.session.courseName ?? round.session.fileName ?? "Round review"}
          description={`${formatDate(round.session.date)} - ${
            isRealRound
              ? "Scorecard-only real round with no club data."
              : `${round.session.fileName ?? "CSV import"} - ${integerFormatter.format(round.shots.length)} launch monitor shots.`
          }`}
          metrics={[
            { label: "Score", value: formatNullableInteger(round.totalScore) },
            { label: "Par", value: formatNullableInteger(round.totalPar) },
            { label: "Putts", value: formatNullableInteger(round.totalPutts) },
            { label: "Diff", value: formatHandicapValue(round.handicapDifferential) },
          ]}
          visual={
            <PageArtwork
              variant="fairway"
              alt=""
              crop="random"
              cropKey={sessionId}
              className="h-full min-h-44"
              priority
            />
          }
        />

        {hasMap ? (
          <MobileCollapsible
            title={hasClubData ? "Actual hole map" : "Estimated hole map"}
            description="Shot map detail."
          >
            <Card id="map" className="premium-card scroll-mt-28">
              <CardHeader>
                <CardTitle>{hasClubData ? "Actual hole map" : "Estimated hole map"}</CardTitle>
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
                <RoundShotMap
                  holes={round.mapHoles}
                  shots={round.mapShots}
                  courseName={round.session.courseName ?? "Course map"}
                  shotMode={hasClubData ? "actual" : "estimated"}
                />
              </CardContent>
            </Card>
          </MobileCollapsible>
        ) : round.mapAutoImport ? (
          <MobileCollapsible title="Course map" description="Automatic course geometry status.">
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
        ) : null}

        <MobileSectionChips
          items={[
            { label: "Map", href: "#map" },
            { label: "Hole", href: "#current-hole" },
            { label: "Scorecard", href: "#scorecard" },
            { label: "Shots", href: "#shots" },
          ]}
        />

        {currentHole ? (
          <>
            <RoundHoleSelector holes={round.holes} />
            <CurrentHoleCard
              sessionId={round.session.id}
              recordVersion={round.session.updatedAt.toISOString()}
              hole={currentHole}
              hasClubData={hasClubData}
              isRealRound={isRealRound}
            />
          </>
        ) : null}

        <MobileCollapsible title="Round context" description="Status, weather, wind and notes.">
          <Card id="context" className="premium-card scroll-mt-28">
            <CardHeader>
              <CardTitle>Round context</CardTitle>
              <CardDescription>
                Save partial-round state, weather, wind and equipment notes so comparisons explain
                the conditions behind the score.
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
                  <select
                    name="roundStatus"
                    defaultValue={round.session.roundStatus}
                    className="h-10 rounded-xl border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="complete">Complete</option>
                    <option value="in_progress">In progress</option>
                  </select>
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
                    className="h-10 rounded-xl bg-white"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium lg:col-span-2">
                  <span>Equipment notes</span>
                  <Input
                    name="equipmentNotes"
                    defaultValue={round.session.equipmentNotes ?? ""}
                    className="h-10 rounded-xl bg-white"
                  />
                </label>
                <Button
                  type="submit"
                  className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B] lg:w-fit"
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
                Change the course or tee set used by the scorecard, handicap calculation, and hole
                map.
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
                  <select
                    name="teeSetId"
                    defaultValue={round.session.teeSetId ?? ""}
                    className="h-11 rounded-xl border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="" disabled>
                      Select course
                    </option>
                    {round.courseOptions.map((option) => (
                      <option key={option.teeSetId} value={option.teeSetId}>
                        {option.courseName} - {option.teeSetName}
                        {option.courseRating && option.slopeRating
                          ? ` (${numberFormatter.format(option.courseRating)}/${option.slopeRating})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="submit"
                  className="h-11 rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
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

        <RecordOpportunitiesCard round={round} />

        <ProofChecklistPanel
          title="Round proof checklist"
          description="Before this round can support a record or tournament result, confirm the data behind the score."
          items={proofItems}
          actionHref="#scorecard"
          actionLabel="Review scorecard"
        />

        {!hasClubData ? (
          <MobileCollapsible
            title="Real round data"
            description="Scorecard-only stats and estimates."
          >
            <Card className="premium-card">
              <CardHeader>
                <CardTitle>Real round data</CardTitle>
                <CardDescription>
                  This scorecard is saved without launch-monitor shots, so it contributes to real
                  and combined handicap but not bag or simulator stats.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <MiniMetric label="Net" value={formatNullableInteger(round.totalNetScore)} />
                <MiniMetric label="FIR / GIR" value={`${round.fairwaysHit} / ${round.gir}`} />
                <MiniMetric label="Chips" value={formatNullableInteger(round.totalChipShots)} />
                <MiniMetric label="Sand" value={formatNullableInteger(round.totalSandShots)} />
                <MiniMetric label="Penalties" value={formatNullableInteger(round.totalPenalties)} />
                <MiniMetric
                  label="Map estimates"
                  value={integerFormatter.format(round.mapShots.length)}
                />
              </CardContent>
            </Card>
          </MobileCollapsible>
        ) : null}

        <section id="scorecard" className="grid scroll-mt-28 gap-3">
          {round.holes.length > 0 ? (
            <CourseScorecardSvg
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
          ) : null}

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
                      <p className="text-xs text-muted-foreground">{formatHoleSummary(hole)}</p>
                    </div>
                    <Badge variant="secondary">
                      {hasClubData ? `${hole.shots.length} CSV shots` : "Real scorecard"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <RoundNumberInput label="Score" name="score" value={hole.score} />
                    <RoundNumberInput label="Putts" name="putts" value={hole.putts} />
                    <RoundNumberInput label="Missing" name="penalties" value={hole.penalties} />
                  </div>
                  {isRealRound ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <RoundNumberInput label="Chips" name="chipShots" value={hole.chipShots} />
                      <RoundNumberInput
                        label="Sand"
                        name="greensideSandShots"
                        value={hole.greensideSandShots}
                      />
                    </div>
                  ) : null}
                  <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-white/85 p-2 ring-1 ring-slate-200/80">
                    {isRealRound ? (
                      <>
                        <MiniMetric label="Net" value={formatNullableInteger(hole.netScore)} />
                        <MiniMetric label="Chips" value={formatNullableInteger(hole.chipShots)} />
                        <MiniMetric
                          label="Sand"
                          value={formatNullableInteger(hole.greensideSandShots)}
                        />
                      </>
                    ) : (
                      <>
                        <MiniMetric label="Launch" value={hole.shots.length.toString()} />
                        <MiniMetric label="Putts" value={formatNullableInteger(hole.putts)} />
                        <MiniMetric label="Missing" value={formatNullableInteger(hole.penalties)} />
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
            <MobileCollapsible title="Handicap input" description="Rating, slope and differential.">
              <Card className="premium-card">
                <CardHeader>
                  <CardTitle>Handicap input</CardTitle>
                  <CardDescription>
                    Real rounds use the saved tee rating and slope for the rounds handicap estimate.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <MiniMetric label="Tee" value={round.session.teeName ?? "--"} />
                  <MiniMetric
                    label="Rating / slope"
                    value={formatRatingSlope(round.session.courseRating, round.session.slopeRating)}
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

        {hasClubData ? (
          <ReviewAccordion
            id="shots"
            title="Shot club corrections"
            description="Use this when the CSV club is wrong for a single shot. Hole assignment is derived from the round split and is not editable from the review page."
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
                          action={<Badge variant="outline">Shot {shot.shotNumber ?? "--"}</Badge>}
                        >
                          <DataPair label="Carry" value={`${formatMetric(shot.carryYd)} yd`} />
                          <DataPair label="Total" value={`${formatMetric(shot.totalYd)} yd`} />
                          <DataPair label="Side" value={`${formatMetric(shot.sideCarryYd)} yd`} />
                          <OfflineRoundEditForm
                            action={updateShotClubAction}
                            editKind="shot-club"
                            recordVersion={round.session.updatedAt.toISOString()}
                            className="grid gap-2"
                          >
                            <input type="hidden" name="sessionId" value={round.session.id} />
                            <input type="hidden" name="shotId" value={shot.id} />
                            <select
                              name="clubId"
                              defaultValue={shot.clubId}
                              className="h-9 rounded-lg border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              {round.allClubs.map((club) => (
                                <option key={club.id} value={club.id}>
                                  {clubLabel(club)}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" size="sm" variant="outline">
                              Save club
                            </Button>
                          </OfflineRoundEditForm>
                        </MobileDataCard>
                      ))
                    ) : (
                      <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                        No shots are linked to this round.
                      </div>
                    )}
                  </MobileDataList>
                }
              >
                <Table
                  className="min-w-[1120px]"
                  data-workbench-export-table="round-shots"
                  aria-describedby="round-shots-table-summary"
                >
                  <TableCaption id="round-shots-table-summary" className="sr-only">
                    Round shot club corrections with hole, shot number, current club, distance
                    metrics and club update controls.
                  </TableCaption>
                  <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                    <TableRow>
                      <TableHead
                        data-column="hole"
                        className="sticky left-0 z-20 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {round.shots.map((shot) => (
                      <TableRow key={shot.id} tabIndex={0} className="focus-aaa outline-none">
                        <TableCell
                          data-column="hole"
                          className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                            <input type="hidden" name="sessionId" value={round.session.id} />
                            <input type="hidden" name="shotId" value={shot.id} />
                            <select
                              name="clubId"
                              defaultValue={shot.clubId}
                              className="h-9 min-w-48 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              {round.allClubs.map((club) => (
                                <option key={club.id} value={club.id}>
                                  {clubLabel(club)}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" size="sm" variant="outline">
                              Save
                            </Button>
                          </OfflineRoundEditForm>
                        </TableCell>
                      </TableRow>
                    ))}
                    {round.shots.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No shots are linked to this round.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </DataTableFrame>
            </div>
          </ReviewAccordion>
        ) : null}

        {round.unmappedShots.length > 0 ? (
          <Card className="premium-card border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle>Unmapped shots</CardTitle>
              <CardDescription>
                These shots have no hole assignment. Re-import with adjusted hole shot counts if the
                split needs to change.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {integerFormatter.format(round.unmappedShots.length)} shots are unmapped.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

type RoundDetail = NonNullable<Awaited<ReturnType<typeof getRoundDetail>>>;
type RoundDetailHole = RoundDetail["holes"][number];

function MobileRoundDetail({
  round,
  focusHole,
  nextIncompleteHole,
  hasClubData,
  hasMap,
  isRealRound,
  proofItems,
  shotPatternEnabled,
}: {
  round: RoundDetail;
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
  const opportunityCount = round.recordOpportunities.length + round.tournamentOpportunities.length;
  const courseName = round.session.courseName ?? round.session.fileName ?? "Round review";
  const evidenceSummary = hasClubData
    ? `${integerFormatter.format(round.shots.length)} shots`
    : "Scorecard only";

  return (
    <MobileAppShell className="gap-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <MobileTopBar title={courseName} />

      <div className="px-1">
        <p className="text-[13px] font-medium text-muted-foreground">
          {formatDate(round.session.date)} · {formatSessionType(round.session.type)}
        </p>
      </div>

      {roundIsComplete ? (
        <MobileRoundResultCard
          totalScore={round.totalScore}
          totalPar={round.totalPar}
          totalPutts={round.totalPutts}
          handicapDifferential={round.handicapDifferential}
          evidenceSummary={evidenceSummary}
          proofReadyCount={proofReadyCount}
          proofItemCount={proofItems.length}
        />
      ) : focusHole ? (
        <MobileRoundFirstCard
          hole={focusHole}
          completedHoleCount={completedHoleCount}
          holeCount={round.holes.length}
          hasClubData={hasClubData}
        />
      ) : (
        <section className="rounded-[1.2rem] bg-card p-4 ring-1 ring-border/70">
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
      )}

      {round.unmappedShots.length > 0 ? (
        <div
          className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-100"
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

      <section
        id="mobile-round-review"
        className="grid scroll-mt-28 gap-2"
        aria-labelledby="mobile-round-depth-title"
      >
        <IOSSectionHeader
          title="Round review"
          description="Open one section at a time for the supporting detail."
        />
        <h2 id="mobile-round-depth-title" className="sr-only">
          Round review sections
        </h2>
        <IOSDisclosureGroup
          label="Round review details"
          items={[
            {
              value: "performance",
              title: "Performance & context",
              summary: roundIsComplete
                ? formatScoreToPar(round.totalScore, round.totalPar)
                : `${completedHoleCount}/${round.holes.length}`,
              description: "Scoring, conditions, notes and handicap inputs.",
              content: (
                <MobileRoundPerformance
                  round={round}
                  hasClubData={hasClubData}
                  isRealRound={isRealRound}
                />
              ),
            },
            {
              value: "scorecard",
              title: "Scorecard",
              summary: `${round.holes.length} holes`,
              description: "Hole results and corrections.",
              content: (
                <MobileRoundScorecard
                  round={round}
                  hasClubData={hasClubData}
                  isRealRound={isRealRound}
                />
              ),
            },
            {
              value: "map",
              title: "Map & replay",
              summary: hasMap ? `${round.mapHoles.length} holes` : "Not ready",
              description: "Specialist shot canvas and replay actions.",
              content: (
                <MobileRoundMap
                  round={round}
                  hasClubData={hasClubData}
                  hasMap={hasMap}
                  shotPatternEnabled={shotPatternEnabled}
                />
              ),
            },
            {
              value: "proof",
              title: "Proof & opportunities",
              summary: `${proofReadyCount}/${proofItems.length}`,
              description:
                opportunityCount > 0
                  ? `${opportunityCount} eligible boards or events.`
                  : "Evidence readiness for records and events.",
              content: <MobileRoundProof round={round} proofItems={proofItems} />,
            },
            {
              value: "corrections",
              title: "Data corrections",
              summary: hasClubData ? evidenceSummary : "Course link",
              description: "Course, club and individual shot labels.",
              content: <MobileRoundCorrections round={round} hasClubData={hasClubData} />,
            },
          ]}
        />
      </section>
    </MobileAppShell>
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
}: {
  totalScore: number | null;
  totalPar: number | null;
  totalPutts: number | null;
  handicapDifferential: number | null;
  evidenceSummary: string;
  proofReadyCount: number;
  proofItemCount: number;
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
      <IOSGroupedList className="mt-4">
        <IOSMetricRow label="Putts" value={formatNullableInteger(totalPutts)} />
        <IOSMetricRow
          label="Handicap differential"
          value={formatHandicapValue(handicapDifferential)}
        />
        <IOSMetricRow label="Evidence" value={evidenceSummary} />
      </IOSGroupedList>
      <Button asChild className="mt-4 min-h-11 w-full rounded-xl">
        <a href="#mobile-round-review">Explore round details</a>
      </Button>
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
}: {
  round: RoundDetail;
  hasClubData: boolean;
  isRealRound: boolean;
}) {
  return (
    <div className="grid gap-5">
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
            <select
              name="roundStatus"
              defaultValue={round.session.roundStatus}
              className="focus-aaa h-11 rounded-xl border border-input bg-background px-3 text-base outline-none"
            >
              <option value="complete">Complete</option>
              <option value="in_progress">In progress</option>
            </select>
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
}: {
  round: RoundDetail;
  hasClubData: boolean;
  isRealRound: boolean;
}) {
  return (
    <div id="mobile-round-scorecard" className="grid scroll-mt-28 gap-5">
      {round.holes.length > 0 ? (
        <section className="grid gap-2">
          <IOSSectionHeader
            title="Score overview"
            description="Swipe the scorecard itself if the full width is needed."
          />
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border/70 [&_a]:min-h-11 [&_summary]:min-h-11">
            <div className="min-w-[40rem] p-2">
              <CourseScorecardSvg
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
}: {
  round: RoundDetail;
  hasClubData: boolean;
  hasMap: boolean;
  shotPatternEnabled: boolean;
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
            <RoundShotMap
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
        <IOSListRow
          label="Course setup"
          detail="Review or add hole geometry."
          href={round.session.courseId ? `/courses/${round.session.courseId}/holes` : "/courses"}
          icon={MapPinned}
        />
      </IOSGroupedList>

      {round.session.courseId ? (
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

function MobileRoundProof({
  round,
  proofItems,
}: {
  round: RoundDetail;
  proofItems: RoundProofItem[];
}) {
  const opportunities = [
    ...round.recordOpportunities.map((item) => ({
      id: `record-${item.record.id}`,
      label: item.category.name,
      detail: item.record.period === "month" ? "Monthly course board" : "Course record",
      status: item.attempt
        ? `Submitted · ${item.attempt.verificationStatus.replace(/_/g, " ")}`
        : "Ready to review",
      href: item.attempt
        ? `/course-records/${item.record.id}?attempt=${encodeURIComponent(item.attempt.id)}`
        : `/course-records/${item.record.id}?sessionId=${encodeURIComponent(round.session.id)}#submit-record`,
    })),
    ...round.tournamentOpportunities.map((event) => ({
      id: `event-${event.id}`,
      label: event.title,
      detail: "Tournament round submission",
      status: event.submission
        ? `Submitted · ${event.submission.verificationStatus.replace(/_/g, " ")}`
        : "Ready to review",
      href: event.submission ? `/tournaments/${event.id}` : `/tournaments/${event.id}/submit`,
    })),
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-2">
        <IOSSectionHeader title="Evidence checklist" />
        <IOSGroupedList>
          {proofItems.map((item) => (
            <IOSListRow
              key={item.label}
              label={item.label}
              detail={item.detail}
              href={item.href}
              leading={
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-[0.55rem] ${
                    item.status === "ready"
                      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                      : item.status === "needed"
                        ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {item.status === "ready" ? (
                    <CheckCircle2 className="size-[1.125rem]" aria-hidden />
                  ) : (
                    <ShieldCheck className="size-[1.125rem]" aria-hidden />
                  )}
                </span>
              }
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
      </section>

      <section className="grid gap-2">
        <IOSSectionHeader
          title="Eligible submissions"
          description={
            opportunities.length > 0
              ? "Open a board or event to review before submitting."
              : "No matching open records or tournaments were found."
          }
        />
        {opportunities.length > 0 ? (
          <IOSGroupedList>
            {opportunities.map((item) => (
              <IOSListRow
                key={item.id}
                label={item.label}
                detail={item.detail}
                status={<IOSInlineStatus label={item.status} tone="info" />}
                href={item.href}
              />
            ))}
          </IOSGroupedList>
        ) : (
          <div className="rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-border/70">
            This round is not currently eligible for a visible board or open event.
          </div>
        )}
      </section>
    </div>
  );
}

function MobileRoundCorrections({
  round,
  hasClubData,
}: {
  round: RoundDetail;
  hasClubData: boolean;
}) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-2">
        <IOSSectionHeader
          title="Course link"
          description="Used by the scorecard, handicap estimate and map."
        />
        <OfflineRoundEditForm
          action={updateRoundCourseLinkAction}
          editKind="round-course-link"
          recordVersion={round.session.updatedAt.toISOString()}
          className="ios-grouped-list grid gap-3 p-4"
        >
          <input type="hidden" name="sessionId" value={round.session.id} />
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Course / tee set</span>
            <select
              name="teeSetId"
              defaultValue={round.session.teeSetId ?? ""}
              className="focus-aaa h-11 min-w-0 rounded-xl border border-input bg-background px-3 text-base outline-none"
            >
              <option value="" disabled>
                Select course
              </option>
              {round.courseOptions.map((option) => (
                <option key={option.teeSetId} value={option.teeSetId}>
                  {option.courseName} · {option.teeSetName}
                  {option.courseRating && option.slopeRating
                    ? ` (${numberFormatter.format(option.courseRating)}/${option.slopeRating})`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="min-h-11 w-full rounded-xl">
            <Save className="size-4" aria-hidden />
            Update course link
          </Button>
        </OfflineRoundEditForm>
      </section>

      {hasClubData ? (
        <>
          <section className="grid gap-2">
            <IOSSectionHeader
              title="Clubs used"
              description="Changing a club updates every linked shot."
            />
            <div className="ios-grouped-list divide-y divide-border/70 overflow-hidden">
              {round.roundClubs.map((club) => (
                <OfflineRoundEditForm
                  key={club.id}
                  action={updateClubAction}
                  editKind="club"
                  recordVersion={round.session.updatedAt.toISOString()}
                  className="grid gap-3 p-4"
                >
                  <input type="hidden" name="sessionId" value={round.session.id} />
                  <input type="hidden" name="clubId" value={club.id} />
                  <h3 className="text-[15px] font-semibold">{clubLabel(club)}</h3>
                  <label className="grid gap-1.5 text-sm font-medium">
                    <span>Type</span>
                    <ClubTypeSelect name="clubType" value={club.type} />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1.5 text-sm font-medium">
                      <span>Brand</span>
                      <Input
                        name="brand"
                        defaultValue={club.brand ?? ""}
                        className="h-11 bg-background text-base"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                      <span>Model</span>
                      <Input
                        name="model"
                        defaultValue={club.model ?? ""}
                        className="h-11 bg-background text-base"
                      />
                    </label>
                  </div>
                  <Button type="submit" variant="outline" className="min-h-11 w-full rounded-xl">
                    Save club
                  </Button>
                </OfflineRoundEditForm>
              ))}
            </div>
          </section>

          <section className="grid gap-2">
            <IOSSectionHeader
              title="Individual shots"
              description="Use this only when one imported shot has the wrong club."
            />
            <div className="ios-grouped-list divide-y divide-border/70 overflow-hidden">
              {round.shots.map((shot) => (
                <OfflineRoundEditForm
                  key={shot.id}
                  action={updateShotClubAction}
                  editKind="shot-club"
                  recordVersion={round.session.updatedAt.toISOString()}
                  className="grid gap-3 p-4"
                >
                  <input type="hidden" name="sessionId" value={round.session.id} />
                  <input type="hidden" name="shotId" value={shot.id} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold">{clubLabel(shot)}</h3>
                      <p className="text-[13px] text-muted-foreground">
                        Hole {formatHole(shot.courseHoleNumber, shot.courseHoleShotNumber)} · shot{" "}
                        {shot.shotNumber ?? "--"}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-[13px] text-muted-foreground tabular-nums">
                      {formatMetric(shot.carryYd)} yd
                    </span>
                  </div>
                  <select
                    name="clubId"
                    defaultValue={shot.clubId}
                    aria-label={`Club for shot ${shot.shotNumber ?? "unknown"}`}
                    className="focus-aaa h-11 min-w-0 rounded-xl border border-input bg-background px-3 text-base outline-none"
                  >
                    {round.allClubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {clubLabel(club)}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline" className="min-h-11 w-full rounded-xl">
                    Save shot club
                  </Button>
                </OfflineRoundEditForm>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-xl bg-card p-4 ring-1 ring-border/70">
          <p className="text-sm leading-5 text-muted-foreground">
            No launch-monitor shots are linked, so there are no club labels to correct.
          </p>
          <Button asChild variant="outline" className="mt-3 min-h-11 w-full rounded-xl">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" aria-hidden />
              Import shot evidence
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function RecordOpportunitiesCard({ round }: { round: RoundDetail }) {
  if (round.recordOpportunities.length === 0 && round.tournamentOpportunities.length === 0) {
    return null;
  }

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle>Record opportunities</CardTitle>
        <CardDescription>
          This round can go straight into the boards it qualifies for.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {round.recordOpportunities.slice(0, 4).map((item) => (
          <div key={item.record.id} className="rounded-lg border bg-[#F5F6F4] p-3 text-sm">
            <p className="font-semibold">{item.category.name}</p>
            <p className="mt-1 text-muted-foreground">
              {item.record.period === "month" ? "Monthly board" : "Course record"}
            </p>
            {item.attempt ? (
              <p
                className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-[#0B7A3B]"
                role="status"
              >
                Submitted - {item.attempt.verificationStatus.replace(/_/g, " ")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Not submitted yet.</p>
            )}
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link
                href={
                  item.attempt
                    ? `/course-records/${item.record.id}?attempt=${encodeURIComponent(item.attempt.id)}`
                    : `/course-records/${item.record.id}?sessionId=${encodeURIComponent(round.session.id)}#submit-record`
                }
                prefetch={false}
              >
                {item.attempt ? "View board" : "Review and submit"}
              </Link>
            </Button>
          </div>
        ))}
        {round.tournamentOpportunities.slice(0, 4).map((event) => (
          <div key={event.id} className="rounded-lg border bg-[#F5F6F4] p-3 text-sm">
            <p className="font-semibold">{event.title}</p>
            <p className="mt-1 text-muted-foreground">Round submission available</p>
            {event.submission ? (
              <p
                className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-[#0B7A3B]"
                role="status"
              >
                Submitted - {event.submission.verificationStatus.replace(/_/g, " ")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Not submitted yet.</p>
            )}
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link
                href={
                  event.submission ? `/tournaments/${event.id}` : `/tournaments/${event.id}/submit`
                }
                prefetch={false}
              >
                {event.submission ? "View event" : "Review and submit"}
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MobileCollapsible({
  title,
  description,
  count,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  count?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group lg:contents">
      <summary className="ios-grouped-list ios-grouped-row focus-aaa flex min-h-14 cursor-pointer list-none touch-manipulation items-center justify-between gap-3 px-4 py-2.5 text-left outline-none lg:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[15px] font-medium leading-5 tracking-normal">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-[13px] leading-[1.15rem] text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 text-[13px] font-medium text-muted-foreground">
          {count ? <span>{count}</span> : null}
          <ChevronDown
            className="size-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </span>
      </summary>
      <div className="hidden pt-2 group-open:block lg:contents">{children}</div>
    </details>
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
    <details id={id} className="group premium-card scroll-mt-28">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
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
            className="size-4 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="border-t border-slate-200 px-4 pb-4 pt-4">{children}</div>
    </details>
  );
}

function RoundHoleSelector({ holes }: { holes: RoundDetail["holes"] }) {
  return (
    <nav
      aria-label="Hole selector"
      className="sticky top-[7.75rem] z-30 -mx-1 flex gap-1 overflow-x-auto px-1 py-1 sm:hidden"
    >
      {holes.map((hole) => (
        <a
          key={hole.holeNumber}
          href={`#hole-${hole.holeNumber}`}
          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/95 text-sm font-semibold shadow-sm"
        >
          {hole.holeNumber}
        </a>
      ))}
    </nav>
  );
}

function CurrentHoleCard({
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
    <Card id="current-hole" className="premium-card scroll-mt-36 sm:hidden">
      <CardHeader>
        <CardTitle>Hole {hole.holeNumber}</CardTitle>
        <CardDescription>{formatHoleSummary(hole)}</CardDescription>
      </CardHeader>
      <CardContent>
        <PageArtwork
          variant="fairway"
          alt=""
          crop="random"
          cropKey={`${sessionId}-${hole.holeNumber}`}
          className="mb-3 block h-24 min-h-0 rounded-xl"
          sizes="calc(100vw - 2rem)"
        />
        <OfflineRoundEditForm
          action={updateRoundHoleAction}
          editKind="round-hole"
          recordVersion={recordVersion}
          className="grid gap-3"
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
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-white/85 p-2 ring-1 ring-slate-200/80">
            <MiniMetric label="Par" value={integerFormatter.format(hole.par)} />
            <MiniMetric
              label="Yards"
              value={hole.yards > 0 ? integerFormatter.format(hole.yards) : "--"}
            />
            <MiniMetric
              label="Shots"
              value={hasClubData ? hole.shots.length.toString() : "Score"}
            />
          </div>
          <Button type="submit" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
            <Save className="size-4" />
            Save hole
          </Button>
        </OfflineRoundEditForm>
      </CardContent>
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
      <select
        name={name}
        defaultValue={value === null || value === undefined ? "null" : String(value)}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:h-9 lg:text-sm"
      >
        <option value="null">-</option>
        <option value="true">Hit</option>
        <option value="false">Miss</option>
      </select>
    </label>
  );
}

function ClubTypeSelect({ name, value }: { name: string; value: string }) {
  const options = CLUB_TYPE_OPTIONS.includes(value)
    ? CLUB_TYPE_OPTIONS
    : [value, ...CLUB_TYPE_OPTIONS];

  return (
    <select
      name={name}
      defaultValue={value}
      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:h-9 lg:text-sm"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {formatClubType(option)}
        </option>
      ))}
    </select>
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
