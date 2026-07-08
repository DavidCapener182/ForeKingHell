"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Database,
  ExternalLink,
  GitCompareArrows,
  Route,
  Trophy,
  Upload,
} from "lucide-react";

import { saveRapsodoImportBatchAction } from "@/app/import/actions";
import { notifyAchievementUnlocks } from "@/components/achievement-notifications";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourseOverlay } from "@/app/import/course-overlay";
import { SaveChecklistCard } from "@/app/import/save-checklist-card";
import { ScorecardExtractionPanel } from "@/app/import/scorecard-extraction-panel";
import { SessionSettings } from "@/app/import/session-settings";
import { ShotPreview } from "@/app/import/shot-preview";
import type {
  HoleReviewState,
  ScorecardExtractState,
  SessionType,
} from "@/app/import/import-types";
import { UploadDropzone } from "@/app/import/upload-dropzone";
import { useImportFiles } from "@/app/import/use-import-files";
import {
  MobileBentoSummary,
  MobileCompactPageHeader,
  StickyMobileAction,
} from "@/components/premium";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { achievementUnlockHref, clubHref, shotRowsHref } from "@/lib/alert-links";
import { trackPlausibleEvent } from "@/lib/analytics";
import {
  MAX_IMPORT_CSV_BYTES,
  MAX_IMPORT_FILES_PER_BATCH,
  formatMegabytes,
  utf8ByteLength,
} from "@/lib/imports/import-limits";
import { queueOfflineAction } from "@/lib/offline-queue";
import {
  isOfflineImportStorageEnabled,
  subscribeOfflineImportStoragePreference,
} from "@/lib/offline-storage-preferences";
import {
  inferCourseShotsFromHoleShotCounts,
  inferCourseShots,
  parseScorecardText,
} from "@/lib/course-scorecard";
import { ColumnMappingPanel } from "@/app/import/column-mapping-panel";
import { type DistanceUnit, type RapsodoColumnMapping } from "@/lib/rapsodo/parser";
import type {
  LongestShotNotification,
  SaveRapsodoImportInput,
} from "@/lib/imports/save-rapsodo-import";
import type { AchievementUnlockNotification } from "@/lib/achievements/types";
import type { ExtractedScorecard } from "@/lib/scorecard-extraction";
import { cn } from "@/lib/utils";

type SaveState =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
      savedSessionId: string | null;
      longestShotNotifications: LongestShotNotification[];
      achievementUnlockNotifications: AchievementUnlockNotification[];
    }
  | { status: "error"; message: string };

type MobileImportStep = "type" | "upload" | "columns" | "course" | "preview" | "save";

const TPC_SAWGRASS_PLAYERS_2026_SCORECARD = [
  "1,4,360",
  "2,5,469",
  "3,3,134",
  "4,4,324",
  "5,4,422",
  "6,4,333",
  "7,4,382",
  "8,3,168",
  "9,5,522",
  "10,4,351",
  "11,5,469",
  "12,4,296",
  "13,3,141",
  "14,4,377",
  "15,4,366",
  "16,5,470",
  "17,3,115,Island Green",
  "18,4,387",
].join("\n");

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

export function ImportForm({
  defaultDistanceUnit = "yards",
}: {
  defaultDistanceUnit?: DistanceUnit;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scorecardImageInputRef = useRef<HTMLInputElement>(null);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(defaultDistanceUnit);
  const [columnMapping, setColumnMapping] = useState<RapsodoColumnMapping>({});
  const {
    uploadedFiles,
    parsedFiles,
    isDragging,
    readProgress,
    setIsDragging,
    readSelectedFiles: readImportFiles,
    removeFile: removeImportFile,
    clearFiles,
  } = useImportFiles(distanceUnit, columnMapping);
  const [sessionType, setSessionType] = useState<SessionType>("range");
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [courseName, setCourseName] = useState("");
  const [scorecardText, setScorecardText] = useState("");
  const [holeReview, setHoleReview] = useState<HoleReviewState>({});
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [mobileStep, setMobileStep] = useState<MobileImportStep>("type");
  const [scorecardExtractState, setScorecardExtractState] = useState<ScorecardExtractState>({
    status: "idle",
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isOnline, setIsOnline] = useState(true);
  const [offlineStorageEnabled, setOfflineStorageEnabled] = useState(false);
  const isCourseUpload = sessionType === "simulated_course";
  const mobileImportSteps = useMemo(
    () => [
      { id: "type" as const, label: "Type" },
      { id: "upload" as const, label: "Upload" },
      { id: "columns" as const, label: "Columns" },
      ...(isCourseUpload ? [{ id: "course" as const, label: "Course" }] : []),
      { id: "preview" as const, label: "Preview" },
      { id: "save" as const, label: "Save" },
    ],
    [isCourseUpload],
  );
  const visibleMobileStep = mobileImportSteps.some((step) => step.id === mobileStep)
    ? mobileStep
    : "preview";
  const activeMobileStepIndex = mobileImportSteps.findIndex(
    (step) => step.id === visibleMobileStep,
  );

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => setIsHydrated(true), 0);
    const updateOnlineStatus = () => setIsOnline(getClientOnlineStatus());

    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const updatePreference = () => setOfflineStorageEnabled(isOfflineImportStorageEnabled());

    updatePreference();
    return subscribeOfflineImportStoragePreference(updatePreference);
  }, []);

  const scorecard = useMemo(() => parseScorecardText(scorecardText), [scorecardText]);
  const autoCourseInference = useMemo(() => {
    if (!isCourseUpload || parsedFiles.length === 0 || scorecard.holes.length === 0) {
      return null;
    }

    return inferCourseShots(parsedFiles[0].parsed.shots, scorecard.holes);
  }, [isCourseUpload, parsedFiles, scorecard.holes]);
  const courseHoleShotCounts = useMemo(() => {
    if (!isCourseUpload || scorecard.holes.length === 0) {
      return [];
    }

    return scorecard.holes.map((hole) => {
      const autoShotCount =
        autoCourseInference?.holes.find((autoHole) => autoHole.holeNumber === hole.holeNumber)
          ?.shots.length ?? 0;
      const manualShotCount = holeReview[hole.holeNumber]?.shotCount;

      return {
        holeNumber: hole.holeNumber,
        shotCount: Math.max(0, Math.min(10, manualShotCount ?? autoShotCount)),
      };
    });
  }, [autoCourseInference, holeReview, isCourseUpload, scorecard.holes]);
  const courseInference = useMemo(() => {
    if (!isCourseUpload || parsedFiles.length === 0 || scorecard.holes.length === 0) {
      return null;
    }

    return inferCourseShotsFromHoleShotCounts(
      parsedFiles[0].parsed.shots,
      scorecard.holes,
      courseHoleShotCounts,
    );
  }, [courseHoleShotCounts, isCourseUpload, parsedFiles, scorecard.holes]);
  const courseHoleScoring = useMemo(() => {
    if (!courseInference) {
      return [];
    }

    return courseInference.holes.map((hole) => {
      const review = holeReview[hole.holeNumber];
      const score = review?.score ?? null;
      const explicitPutts = review?.putts ?? null;
      const penalties =
        explicitPutts !== null && score !== null
          ? Math.max(0, score - hole.shots.length - explicitPutts)
          : Math.max(0, Math.floor(review?.penalties ?? 0));
      const putts =
        explicitPutts ??
        (score === null ? null : Math.max(0, score - hole.shots.length - penalties));

      return {
        holeNumber: hole.holeNumber,
        csvShotCount: hole.shots.length,
        putts,
        penalties,
        score,
        netScore: review?.netScore ?? null,
        fairwayHit: review?.fairwayHit ?? null,
        gir: review?.gir ?? null,
        strokeIndex: review?.strokeIndex ?? null,
      };
    });
  }, [courseInference, holeReview]);
  const courseAssignedShotCount = courseHoleShotCounts.reduce(
    (total, hole) => total + hole.shotCount,
    0,
  );

  const aggregate = useMemo(() => {
    const uniqueClubs = new Set<string>();
    const warnings: string[] = [];

    for (const file of parsedFiles) {
      for (const shot of file.parsed.shots) {
        uniqueClubs.add(shot.clubKey);
      }
      warnings.push(...file.parsed.warnings.map((warning) => `${file.fileName}: ${warning}`));
    }

    warnings.push(...buildDeterministicImportWarnings(parsedFiles));

    if (isCourseUpload && uploadedFiles.length > 1) {
      warnings.push(
        "Simulated course import currently supports one CSV per save so hole inference stays deterministic.",
      );
    }

    if (isCourseUpload && uploadedFiles.length > 0 && scorecard.holes.length === 0) {
      warnings.push("Add scorecard rows before saving a simulated course upload.");
    }

    if (isCourseUpload && scorecardText.trim() && scorecard.warnings.length > 0) {
      warnings.push(...scorecard.warnings);
    }

    if (isCourseUpload && courseInference?.warnings.length) {
      warnings.push(...courseInference.warnings);
    }

    if (isCourseUpload && uploadedFiles.length === 1 && aggregateShotCount(parsedFiles) > 0) {
      const totalShots = aggregateShotCount(parsedFiles);

      if (courseAssignedShotCount !== totalShots) {
        warnings.push(
          `Review hole shot counts: ${courseAssignedShotCount}/${totalShots} CSV shots are assigned.`,
        );
      }
    }

    if (uploadedFiles.length > MAX_IMPORT_FILES_PER_BATCH) {
      warnings.push(
        `Import up to ${MAX_IMPORT_FILES_PER_BATCH} CSV files at a time. Split larger batches into smaller imports.`,
      );
    }

    const oversizedFiles = uploadedFiles.filter(
      (file) =>
        Math.max(file.fileSizeBytes, utf8ByteLength(file.rawCsvText)) > MAX_IMPORT_CSV_BYTES,
    );

    if (oversizedFiles.length > 0) {
      warnings.push(
        `${oversizedFiles.map((file) => file.fileName).join(", ")} ${
          oversizedFiles.length === 1 ? "is" : "are"
        } too large. Maximum CSV size is ${formatMegabytes(MAX_IMPORT_CSV_BYTES)}.`,
      );
    }

    return {
      fileCount: uploadedFiles.length,
      rowCount: parsedFiles.reduce((total, file) => total + file.parsed.rawRows.length, 0),
      shotCount: parsedFiles.reduce((total, file) => total + file.parsed.shotCount, 0),
      clubCount: uniqueClubs.size,
      warnings,
    };
  }, [
    courseInference,
    courseAssignedShotCount,
    isCourseUpload,
    parsedFiles,
    scorecard.holes.length,
    scorecard.warnings,
    scorecardText,
    uploadedFiles,
  ]);

  const courseShotByRowNumber = useMemo(
    () => new Map((courseInference?.shots ?? []).map((shot) => [shot.sourceShot.rowNumber, shot])),
    [courseInference],
  );

  const previewShots = parsedFiles
    .flatMap((file) =>
      file.parsed.shots.map((shot, index) => ({
        ...shot,
        fileName: file.fileName,
        fileShotNumber: shot.shotNumber ?? index + 1,
        courseShot: courseShotByRowNumber.get(shot.rowNumber) ?? null,
      })),
    )
    .slice(0, 12);

  const detectedUnits = [...new Set(parsedFiles.map((file) => file.parsed.detectedDistanceUnit))];
  const detectedSessionDateIso =
    parsedFiles.find((file) => file.parsed.exportedAtIso)?.parsed.exportedAtIso ?? null;
  const canSave =
    uploadedFiles.length > 0 &&
    uploadedFiles.length <= MAX_IMPORT_FILES_PER_BATCH &&
    uploadedFiles.every(
      (file) =>
        Math.max(file.fileSizeBytes, utf8ByteLength(file.rawCsvText)) <= MAX_IMPORT_CSV_BYTES,
    ) &&
    aggregate.shotCount > 0 &&
    (!isCourseUpload ||
      (uploadedFiles.length === 1 &&
        scorecard.holes.length > 0 &&
        courseAssignedShotCount === aggregate.shotCount)) &&
    !isPending;

  async function readSelectedFiles(files: FileList | File[]) {
    setSaveState({ status: "idle" });
    const selectedFiles = Array.from(files);
    const oversizedFiles = selectedFiles.filter((file) => file.size > MAX_IMPORT_CSV_BYTES);

    if (oversizedFiles.length > 0) {
      setSaveState({
        status: "error",
        message: `${oversizedFiles.map((file) => file.name).join(", ")} ${
          oversizedFiles.length === 1 ? "is" : "are"
        } too large. Split it into smaller session exports. Maximum CSV size is ${formatMegabytes(
          MAX_IMPORT_CSV_BYTES,
        )}.`,
      });
    }

    await readImportFiles(selectedFiles.filter((file) => file.size <= MAX_IMPORT_CSV_BYTES));
  }

  function removeFile(fileId: string) {
    setSaveState({ status: "idle" });
    removeImportFile(fileId);
  }

  function clearBatch() {
    setSaveState({ status: "idle" });
    clearFiles();
  }

  function applySawgrassPreset() {
    setSessionType("simulated_course");
    setCourseName("TPC Sawgrass - THE PLAYERS Stadium Course");
    setScorecardText(TPC_SAWGRASS_PLAYERS_2026_SCORECARD);
    setHoleReview({});
    setSaveState({ status: "idle" });
  }

  async function extractScorecardImage(file: File | null | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setScorecardExtractState({
        status: "error",
        fileName: file.name,
        message: "Choose a scorecard image file.",
      });
      return;
    }

    setSaveState({ status: "idle" });
    setScorecardExtractState({ status: "loading", fileName: file.name });

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const response = await fetch("/api/scorecard/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const payload = (await response.json()) as {
        scorecard?: ExtractedScorecard;
        message?: string;
      };

      if (!response.ok || !payload.scorecard) {
        throw new Error(payload.message ?? "Scorecard extraction failed.");
      }

      const message = applyExtractedScorecard(payload.scorecard);
      trackPlausibleEvent("Scorecard Extracted", {
        props: {
          holeCount: payload.scorecard.holes.length,
          hasCourseName: Boolean(payload.scorecard.courseName),
        },
      });
      setScorecardExtractState({ status: "success", fileName: file.name, message });
    } catch (error) {
      setScorecardExtractState({
        status: "error",
        fileName: file.name,
        message: error instanceof Error ? error.message : "Scorecard extraction failed.",
      });
    }
  }

  function applyExtractedScorecard(scorecard: ExtractedScorecard) {
    const extractedCourseName = scorecard.courseName?.trim() || "";
    const isSawgrass = /sawgrass/i.test(extractedCourseName);
    const nextHoleReview: HoleReviewState = {};

    for (const hole of scorecard.holes) {
      nextHoleReview[hole.holeNumber] = {
        score: hole.score,
        putts: hole.putts,
        netScore: hole.netScore,
        fairwayHit: hole.fairwayHit,
        gir: hole.gir,
        strokeIndex: hole.strokeIndex,
      };
    }

    setSessionType("simulated_course");
    setCourseName(extractedCourseName);
    setHoleReview(nextHoleReview);

    if (scorecard.dateIso) {
      setSessionDate(scorecard.dateIso);
    }

    if (isSawgrass) {
      setScorecardText(TPC_SAWGRASS_PLAYERS_2026_SCORECARD);
      return `Extracted ${scorecard.holes.length} hole scores and applied the sample TPC Sawgrass yardages. Confirm course, tees, par and yardage before saving.`;
    }

    const extractedRows = scorecard.holes
      .filter((hole) => hole.par !== null && hole.yards !== null)
      .map((hole) => [hole.holeNumber, hole.par, hole.yards].join(","));

    if (extractedRows.length === scorecard.holes.length && extractedRows.length > 0) {
      setScorecardText(extractedRows.join("\n"));
      return `Extracted ${scorecard.holes.length} holes from the scorecard image. Confirm course, tees, par and yardage before saving.`;
    }

    return `Extracted ${scorecard.holes.length} hole scores. Confirm course, tees, par and add scorecard yardages before saving.`;
  }

  function resetCourseReview() {
    setHoleReview({});
    setSaveState({ status: "idle" });
  }

  function updateHoleReview(holeNumber: number, patch: HoleReviewState[number]) {
    setSaveState({ status: "idle" });
    setHoleReview((current) => ({
      ...current,
      [holeNumber]: {
        ...current[holeNumber],
        ...patch,
      },
    }));
  }

  function saveImportBatch() {
    if (!canSave) {
      return;
    }

    setSaveState({ status: "idle" });
    const importInputs = buildImportInputs();
    trackPlausibleEvent("Import Started", {
      props: {
        fileCount: uploadedFiles.length,
        sessionType,
        shotCount: aggregate.shotCount,
      },
    });
    startTransition(async () => {
      if (!isOnline || !getClientOnlineStatus()) {
        await queueImportBatch(importInputs);
        return;
      }

      let result: Awaited<ReturnType<typeof saveRapsodoImportBatchAction>>;

      try {
        result = await saveRapsodoImportBatchAction(importInputs);
      } catch (error) {
        if (!getClientOnlineStatus() || error instanceof TypeError) {
          await queueImportBatch(importInputs);
          return;
        }

        setSaveState({
          status: "error",
          message: error instanceof Error ? error.message : "Import failed.",
        });
        return;
      }

      if (result.ok) {
        const skippedText =
          result.skippedCount > 0
            ? ` ${result.skippedCount} duplicate ${result.skippedCount === 1 ? "file was" : "files were"} skipped.`
            : "";
        const practiceText =
          result.practicePlanMatches.length > 0
            ? ` Practice plan matched: ${result.practicePlanMatches[0].title} (${result.practicePlanMatches[0].matchScore}% confidence) and scored ${result.practicePlanMatches[0].score.score}/100.`
            : "";
        setSaveState({
          status: "success",
          message: `Saved ${result.shotCount} shots and ${result.rawRowCount} raw rows from ${result.sessionCount} CSV ${
            result.sessionCount === 1 ? "file" : "files"
          } across ${result.clubCount} detected clubs.${skippedText}${practiceText}`,
          savedSessionId: result.savedSessionId,
          longestShotNotifications: result.longestShotNotifications,
          achievementUnlockNotifications: result.achievementUnlockNotifications,
        });
        trackPlausibleEvent("Import Saved", {
          props: {
            fileCount: result.sessionCount,
            shotCount: result.shotCount,
            skippedCount: result.skippedCount,
          },
        });
        notifyAchievementUnlocks(result.achievementUnlockNotifications);
        clearFiles();
        if (result.savedSessionId) {
          router.push(`/import/result?sessionId=${encodeURIComponent(result.savedSessionId)}`);
        } else {
          router.refresh();
        }
      } else {
        setSaveState({ status: "error", message: result.message });
      }
    });
  }

  function buildImportInputs(): SaveRapsodoImportInput[] {
    return parsedFiles.map((file) => ({
      rawCsvText: file.rawCsvText,
      fileName: file.fileName,
      fileSizeBytes: file.fileSizeBytes,
      source: file.parsed.source,
      sessionType,
      sessionDate: file.parsed.exportedAtIso ?? sessionDate,
      distanceUnit,
      columnMapping:
        file.parsed.source === "rapsodo" && hasColumnMapping(columnMapping)
          ? columnMapping
          : undefined,
      courseName: isCourseUpload ? courseName : undefined,
      courseScorecardText: isCourseUpload ? scorecardText : undefined,
      courseHoleShotCounts: isCourseUpload ? courseHoleShotCounts : undefined,
      courseHoleScoring: isCourseUpload ? courseHoleScoring : undefined,
    }));
  }

  async function queueImportBatch(inputs: SaveRapsodoImportInput[]) {
    if (!offlineStorageEnabled) {
      setSaveState({
        status: "error",
        message:
          "Offline import storage is off for this device. Enable it in Settings before queuing raw CSV files for retry.",
      });
      return;
    }

    await queueOfflineAction({
      id: `import-csv-${Date.now()}-${crypto.randomUUID()}`,
      kind: "import-csv",
      payload: { inputs },
    });
    setSaveState({
      status: "success",
      message: `Queued ${inputs.length} CSV ${inputs.length === 1 ? "file" : "files"} for retry when this device is online.`,
      savedSessionId: null,
      longestShotNotifications: [],
      achievementUnlockNotifications: [],
    });
    clearFiles();
    trackPlausibleEvent("Import Queued Offline", {
      props: {
        fileCount: inputs.length,
        sessionType,
        shotCount: aggregate.shotCount,
      },
    });
  }

  return (
    <section
      className="px-4 py-6 sm:px-6 lg:px-8"
      data-import-ready={isHydrated ? "true" : "false"}
    >
      <div className="mx-auto flex w-full max-w-none flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">
            {isCourseUpload ? "Simulated course CSV" : "Launch monitor CSV"}
          </Badge>
        </div>

        <MobileCompactPageHeader
          title="Import launch monitor shots"
          description="Upload CSVs, confirm columns, preview rows, then save."
          metricLabel="Shots"
          metricValue={aggregate.shotCount.toString()}
          metricDetail={
            uploadedFiles.length > 0
              ? `${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"}`
              : "No files"
          }
          action={
            <Button
              type="button"
              size="sm"
              disabled={!canSave}
              onClick={saveImportBatch}
              className="premium-action rounded-lg"
            >
              <Upload className="size-4" />
              Save
            </Button>
          }
        />

        <MobileImportStatusStrip
          currentStep={visibleMobileStep}
          fileCount={aggregate.fileCount}
          shotCount={aggregate.shotCount}
          clubCount={aggregate.clubCount}
          warningCount={aggregate.warnings.length}
          isCourseUpload={isCourseUpload}
          courseHoleCount={scorecard.holes.length}
          courseAssignedShotCount={courseAssignedShotCount}
          canSave={canSave}
          onStepChange={setMobileStep}
        />

        <div className="sm:hidden">
          <MobileBentoSummary
            items={[
              {
                label: "Files",
                value: aggregate.fileCount.toString(),
                detail: "Selected",
                tone: "green",
              },
              {
                label: "Rows",
                value: aggregate.rowCount.toString(),
                detail: "Parsed",
                tone: "sky",
              },
              {
                label: "Shots",
                value: aggregate.shotCount.toString(),
                detail: "Preview",
                tone: "amber",
              },
              {
                label: "Warnings",
                value: aggregate.warnings.length.toString(),
                detail: "Review",
                tone: aggregate.warnings.length > 0 ? "pink" : "slate",
              },
            ]}
          />
        </div>

        <header className="premium-hero hidden p-5 sm:block sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
                Import launch monitor shots
              </h1>
              <p className="text-base leading-7 text-muted-foreground">
                Upload one or more launch-monitor CSVs, review the normalized shot rows, then save
                each file as its own session with raw data preserved.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/shots">
                  <Database className="size-4" />
                  View saved shots
                </Link>
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={!canSave}
                onClick={saveImportBatch}
                className="premium-action w-full sm:w-auto"
              >
                <Upload className="size-4" />
                {isPending ? "Saving…" : "Save batch"}
              </Button>
            </div>
          </div>
        </header>

        <div className="hidden sm:block">
          <ImportFlowGuide
            currentStep={visibleMobileStep}
            isCourseUpload={isCourseUpload}
            fileCount={aggregate.fileCount}
            rowCount={aggregate.rowCount}
            shotCount={aggregate.shotCount}
            clubCount={aggregate.clubCount}
            warningCount={aggregate.warnings.length}
            courseHoleCount={scorecard.holes.length}
            courseAssignedShotCount={courseAssignedShotCount}
            canSave={canSave}
            onStepChange={setMobileStep}
          />
        </div>

        <MobileImportStepper
          steps={mobileImportSteps}
          step={visibleMobileStep}
          onStepChange={setMobileStep}
        />

        {saveState.status !== "idle" ? (
          <Alert variant={saveState.status === "error" ? "destructive" : "default"}>
            {saveState.status === "error" ? (
              <AlertCircle className="size-4" />
            ) : saveState.achievementUnlockNotifications.length > 0 ? (
              <Award className="size-4" />
            ) : saveState.longestShotNotifications.length > 0 ? (
              <Trophy className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <AlertTitle>
              {saveState.status === "error"
                ? "Import failed"
                : saveState.achievementUnlockNotifications.length > 0
                  ? "Achievements unlocked"
                  : saveState.longestShotNotifications.length > 0
                    ? "New longest shot"
                    : "Import saved"}
            </AlertTitle>
            <AlertDescription>
              <p>{saveState.message}</p>
              {saveState.status === "success" ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {saveState.savedSessionId ? (
                    <Button asChild size="sm" className="premium-action">
                      <Link href={compareSessionHref(saveState.savedSessionId)} prefetch={false}>
                        <GitCompareArrows className="size-4" />
                        Compare this session
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link href="/achievements">
                      <Award className="size-4" />
                      View achievements
                    </Link>
                  </Button>
                </div>
              ) : null}
              {saveState.status === "success" && saveState.longestShotNotifications.length > 0 ? (
                <div className="apple-panel mt-3 p-3 text-foreground">
                  <p className="text-sm font-medium">
                    {saveState.longestShotNotifications.length === 1
                      ? "Personal best beaten"
                      : "Personal bests beaten"}
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                    {saveState.longestShotNotifications.map((notification) => (
                      <li
                        key={`${notification.clubId}-${notification.shotDistanceYd}-${notification.fileName}`}
                        className="flex flex-col gap-2 rounded-lg bg-white/90 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span>
                          <Link
                            href={clubHref(notification)}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {notification.clubLabel}
                          </Link>
                          {": "}
                          {formatMetric(notification.shotDistanceYd)} yd {notification.distanceType}
                          {" beat "}
                          {formatMetric(notification.previousDistanceYd)} yd
                          {notification.shotNumber === null
                            ? ""
                            : ` on shot ${notification.shotNumber}`}
                          {"."}
                        </span>
                        <span className="flex shrink-0 flex-wrap gap-2">
                          <Link
                            href={clubHref(notification)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border bg-white/80 px-2 text-xs font-medium text-foreground hover:bg-white"
                          >
                            Club page
                            <ExternalLink className="size-3.5" />
                          </Link>
                          <Link
                            href={shotRowsHref(notification)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border bg-white/80 px-2 text-xs font-medium text-foreground hover:bg-white"
                          >
                            Shot rows
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {saveState.status === "success" &&
              saveState.achievementUnlockNotifications.length > 0 ? (
                <div className="trust-indicator mt-3 rounded-lg p-3 text-foreground">
                  <p className="text-sm font-medium">
                    {saveState.achievementUnlockNotifications.length === 1
                      ? "Achievement unlocked"
                      : "Achievements unlocked"}
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {saveState.achievementUnlockNotifications.map((achievement) => (
                      <li key={`${achievement.achievementId}-${achievement.unlockedAt}`}>
                        <Link
                          href={achievementUnlockHref(achievement.achievementId)}
                          className="flex flex-col gap-1 rounded-lg bg-white/90 px-3 py-2 transition-colors hover:bg-emerald-100/60 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span>
                            <span className="font-medium">{achievement.name}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              - {achievement.description}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge className="w-fit bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
                              +{achievement.xpAwarded.toLocaleString("en-GB")} XP
                            </Badge>
                            <ExternalLink className="size-3.5 text-emerald-700" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card
            className={cn(
              "premium-card",
              ["type", "upload", "columns", "course"].includes(visibleMobileStep)
                ? "flex"
                : "hidden sm:flex",
            )}
          >
            <CardHeader>
              <CardTitle>{mobileImportCardTitle(visibleMobileStep)}</CardTitle>
              <CardDescription>
                Drag in one or more launch-monitor files. Obvious parse issues appear before save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className={visibleMobileStep === "upload" ? "block" : "hidden sm:block"}>
                <UploadDropzone
                  fileInputRef={fileInputRef}
                  isDragging={isDragging}
                  readProgress={readProgress}
                  files={parsedFiles}
                  setIsDragging={setIsDragging}
                  onFilesSelected={readSelectedFiles}
                  onClear={clearBatch}
                  onRemoveFile={removeFile}
                />
              </div>

              <div className={visibleMobileStep === "type" ? "block" : "hidden sm:block"}>
                <SessionSettings
                  sessionDate={sessionDate}
                  sessionType={sessionType}
                  distanceUnit={distanceUnit}
                  detectedUnits={detectedUnits}
                  detectedSessionDateIso={detectedSessionDateIso}
                  onSessionDateChange={setSessionDate}
                  onSessionTypeChange={setSessionType}
                  onDistanceUnitChange={setDistanceUnit}
                />
              </div>

              <div className={visibleMobileStep === "columns" ? "block" : "hidden sm:block"}>
                <ColumnMappingPanel
                  files={uploadedFiles}
                  columnMapping={columnMapping}
                  onColumnMappingChange={setColumnMapping}
                />
              </div>

              {isCourseUpload ? (
                <div className={visibleMobileStep === "course" ? "block" : "hidden sm:block"}>
                  <ScorecardExtractionPanel
                    scorecardImageInputRef={scorecardImageInputRef}
                    scorecardExtractState={scorecardExtractState}
                    courseName={courseName}
                    scorecardText={scorecardText}
                    holeCount={scorecard.holes.length}
                    totalYards={scorecard.holes.reduce((total, hole) => total + hole.yards, 0)}
                    onApplySawgrassPreset={applySawgrassPreset}
                    onExtractScorecardImage={extractScorecardImage}
                    onCourseNameChange={setCourseName}
                    onScorecardTextChange={setScorecardText}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="hidden gap-4 sm:grid sm:grid-cols-2">
            <MetricCard
              label="Files"
              value={aggregate.fileCount.toString()}
              detail={uploadedFiles.length > 0 ? "Ready for batch import" : "No files selected"}
            />
            <MetricCard
              label="Rows"
              value={aggregate.rowCount.toString()}
              detail="All non-empty CSV rows"
            />
            <MetricCard
              label="Shots"
              value={aggregate.shotCount.toString()}
              detail="Parsed preview rows"
            />
            <MetricCard
              label="Clubs"
              value={aggregate.clubCount.toString()}
              detail="Detected across files"
            />
          </div>
        </section>

        {uploadedFiles.length > 0 && aggregate.warnings.length > 0 ? (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>Review import settings</AlertTitle>
            <AlertDescription>{aggregate.warnings.join(" ")}</AlertDescription>
          </Alert>
        ) : null}

        {isCourseUpload ? (
          <Card
            className={cn(
              "premium-card",
              visibleMobileStep === "course" ? "flex" : "hidden sm:flex",
            )}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Round mapping step</CardTitle>
                  <CardDescription>
                    Shots are grouped into holes using the scorecard yardage and the CSV shot order.
                  </CardDescription>
                </div>
                <Route className="size-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <CourseOverlay
                inference={courseInference}
                holeReview={holeReview}
                totalShotCount={aggregate.shotCount}
                assignedShotCount={courseAssignedShotCount}
                onReset={resetCourseReview}
                onUpdateHole={updateHoleReview}
              />
            </CardContent>
          </Card>
        ) : null}

        <div className={visibleMobileStep === "save" ? "block" : "hidden sm:block"}>
          <SaveChecklistCard
            hasFiles={uploadedFiles.length > 0}
            hasShots={aggregate.shotCount > 0}
            hasCompleteCourseMapping={
              !isCourseUpload || courseAssignedShotCount === aggregate.shotCount
            }
            hasNoWarnings={aggregate.warnings.length === 0}
            isOnline={isOnline}
            isPending={isPending}
            canSave={canSave}
            onSave={saveImportBatch}
          />
        </div>

        <div className={visibleMobileStep === "preview" ? "block" : "hidden sm:block"}>
          <ShotPreview shots={previewShots} isCourseUpload={isCourseUpload} />
        </div>

        <StickyMobileAction>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={activeMobileStepIndex <= 0}
              onClick={() =>
                setMobileStep(mobileImportSteps[Math.max(0, activeMobileStepIndex - 1)].id)
              }
            >
              Back
            </Button>
            {visibleMobileStep === "save" ? (
              <Button
                type="button"
                disabled={!canSave}
                onClick={saveImportBatch}
                className="premium-action rounded-lg"
              >
                <Upload className="size-4" />
                {isPending ? "Saving…" : "Save batch"}
              </Button>
            ) : (
              <Button
                type="button"
                className="premium-action rounded-lg"
                onClick={() =>
                  setMobileStep(
                    mobileImportSteps[
                      Math.min(mobileImportSteps.length - 1, activeMobileStepIndex + 1)
                    ].id,
                  )
                }
              >
                Next
              </Button>
            )}
          </div>
        </StickyMobileAction>
      </div>
    </section>
  );
}

function MobileImportStepper({
  steps,
  step,
  onStepChange,
}: {
  steps: Array<{ id: MobileImportStep; label: string }>;
  step: MobileImportStep;
  onStepChange: (step: MobileImportStep) => void;
}) {
  return (
    <nav
      aria-label="Import steps"
      className="sticky top-[4.75rem] z-30 -mx-1 flex gap-2 overflow-x-auto px-1 py-1 sm:hidden"
    >
      {steps.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onStepChange(item.id)}
          className={cn(
            "min-h-10 shrink-0 rounded-full border px-3 py-2 text-sm font-medium shadow-sm",
            item.id === step
              ? "premium-route-tab-active"
              : "border-border bg-white/80 text-slate-700",
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function MobileImportStatusStrip({
  currentStep,
  fileCount,
  shotCount,
  clubCount,
  warningCount,
  isCourseUpload,
  courseHoleCount,
  courseAssignedShotCount,
  canSave,
  onStepChange,
}: {
  currentStep: MobileImportStep;
  fileCount: number;
  shotCount: number;
  clubCount: number;
  warningCount: number;
  isCourseUpload: boolean;
  courseHoleCount: number;
  courseAssignedShotCount: number;
  canSave: boolean;
  onStepChange: (step: MobileImportStep) => void;
}) {
  const courseReady =
    !isCourseUpload || (courseHoleCount > 0 && courseAssignedShotCount === shotCount);
  const statusItems = [
    {
      id: "upload" as const,
      label: "File",
      value: fileCount > 0 ? "✓" : "Add",
      state: fileCount > 0 ? ("ready" as const) : ("blocked" as const),
    },
    {
      id: "preview" as const,
      label: "Shots",
      value: shotCount > 0 ? "✓" : "--",
      state: shotCount > 0 ? ("ready" as const) : ("blocked" as const),
    },
    {
      id: "columns" as const,
      label: "Clubs",
      value: clubCount > 0 ? "✓" : shotCount > 0 ? "Review" : "--",
      state:
        clubCount > 0
          ? ("ready" as const)
          : shotCount > 0
            ? ("warning" as const)
            : ("blocked" as const),
    },
    {
      id: isCourseUpload ? ("course" as const) : ("preview" as const),
      label: "Audit",
      value: warningCount > 0 ? `${warningCount} warn` : courseReady && shotCount > 0 ? "✓" : "Map",
      state:
        warningCount > 0
          ? ("warning" as const)
          : courseReady && shotCount > 0
            ? ("ready" as const)
            : ("blocked" as const),
    },
    {
      id: "save" as const,
      label: "Save",
      value: canSave ? "Ready" : "Wait",
      state: canSave ? ("ready" as const) : ("blocked" as const),
    },
  ];

  return (
    <section
      className="premium-command-surface grid gap-2 rounded-lg p-3 sm:hidden"
      aria-label="Import status"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Import status</p>
        <Badge className="bg-background/80 text-muted-foreground ring-1 ring-border hover:bg-background">
          {canSave ? "Ready" : "Review"}
        </Badge>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {statusItems.map((item) => (
          <div key={item.label} className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onStepChange(item.id)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border bg-background/80 px-2.5 text-xs font-semibold shadow-sm transition-colors",
                currentStep === item.id
                  ? "border-primary/40 text-primary"
                  : item.state === "ready"
                    ? "border-primary/15 text-primary"
                    : item.state === "warning"
                      ? "border-amber-200 text-amber-700"
                      : "border-border text-muted-foreground",
              )}
              aria-label={`${item.label}: ${item.value}`}
            >
              <span
                className={cn(
                  "grid size-4 place-items-center rounded-full",
                  item.state === "ready"
                    ? "bg-primary/10 text-primary"
                    : item.state === "warning"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {item.state === "ready" ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <AlertCircle className="size-3" />
                )}
              </span>
              <span>{item.label}</span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  item.state === "blocked" ? "text-muted-foreground" : "text-current",
                )}
              >
                {item.value}
              </span>
            </button>
            {item.label !== "Save" ? (
              <span className="text-muted-foreground/50" aria-hidden="true">
                ·
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ImportFlowGuide({
  currentStep,
  isCourseUpload,
  fileCount,
  rowCount,
  shotCount,
  clubCount,
  warningCount,
  courseHoleCount,
  courseAssignedShotCount,
  canSave,
  onStepChange,
}: {
  currentStep: MobileImportStep;
  isCourseUpload: boolean;
  fileCount: number;
  rowCount: number;
  shotCount: number;
  clubCount: number;
  warningCount: number;
  courseHoleCount: number;
  courseAssignedShotCount: number;
  canSave: boolean;
  onStepChange: (step: MobileImportStep) => void;
}) {
  const flowSteps = [
    {
      id: "type" as const,
      title: "Choose source",
      value: isCourseUpload ? "Sim course" : "Range session",
      detail: isCourseUpload ? "CSV plus confirmed scorecard" : "Launch monitor CSV import",
      ready: true,
      icon: Route,
    },
    {
      id: "upload" as const,
      title: "Upload",
      value: fileCount > 0 ? `${fileCount} file${fileCount === 1 ? "" : "s"}` : "No files",
      detail: fileCount > 0 ? `${rowCount} raw rows read` : "Add Rapsodo CSV exports",
      ready: fileCount > 0,
      icon: Upload,
    },
    {
      id: "columns" as const,
      title: "Confirm clubs",
      value: shotCount > 0 ? `${clubCount} club${clubCount === 1 ? "" : "s"}` : "Mapping needed",
      detail: shotCount > 0 ? `${shotCount} shots ready to audit` : "Map unknown club columns",
      ready: shotCount > 0,
      icon: Database,
    },
    ...(isCourseUpload
      ? [
          {
            id: "course" as const,
            title: "Confirm course",
            value: courseHoleCount > 0 ? `${courseHoleCount} holes` : "Scorecard needed",
            detail:
              courseHoleCount > 0
                ? `${courseAssignedShotCount}/${shotCount} shots assigned`
                : "Confirm course, tees, par and yardage",
            ready: courseHoleCount > 0 && courseAssignedShotCount === shotCount && shotCount > 0,
            icon: Route,
          },
        ]
      : []),
    {
      id: "preview" as const,
      title: "Review audit",
      value: warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : "Clean",
      detail: warningCount > 0 ? "Check rows before saving" : "Preview accepted shots",
      ready: shotCount > 0 && warningCount === 0,
      icon: AlertCircle,
    },
    {
      id: "save" as const,
      title: "Save result",
      value: canSave ? "Ready" : "Blocked",
      detail: canSave ? "Creates a result summary page" : "Complete the required checks",
      ready: canSave,
      icon: CheckCircle2,
    },
  ];

  return (
    <section className="premium-command-surface rounded-lg p-3">
      <div className="flex flex-col gap-1 px-1 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#111827]">Guided import path</p>
          <p className="mt-1 text-sm leading-5 text-[#667085]">
            Move one clean export into trusted bag numbers, with every raw row still accounted for.
          </p>
        </div>
        <Badge className="w-fit bg-white/75 text-[#475467] ring-1 ring-[#DFE7DF] hover:bg-white">
          {canSave ? "Ready to save" : "Review required"}
        </Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {flowSteps.map((step, index) => {
          const Icon = step.icon;
          const active = step.id === currentStep;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange(step.id)}
              className={cn(
                "grid min-h-[8.75rem] grid-rows-[auto_1fr] rounded-lg border bg-white/76 p-3 text-left transition-colors",
                active
                  ? "border-[#0B7A3B] shadow-[0_8px_20px_rgba(8,122,61,0.08)]"
                  : "border-[#E5E7EB] hover:border-[#CFE7D6]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-8 place-items-center rounded-md bg-[#F5F6F4] text-xs font-semibold text-[#667085]">
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-lg",
                    step.ready
                      ? "bg-[#E8F7EE] text-[#087A3D]"
                      : active
                        ? "bg-[#FFF4DB] text-[#8A4B00]"
                        : "bg-[#F2F4F7] text-[#667085]",
                  )}
                >
                  <Icon className="size-4" />
                </span>
              </div>
              <span className="mt-3 min-w-0">
                <span className="block text-sm font-semibold leading-5 text-[#111827]">
                  {step.title}
                </span>
                <span className="mt-1 block line-clamp-2 text-lg font-bold leading-6 tracking-normal text-[#111827]">
                  {step.value}
                </span>
                <span className="mt-1 block line-clamp-2 text-sm leading-5 text-[#667085]">
                  {step.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function mobileImportCardTitle(step: MobileImportStep) {
  if (step === "type") return "Step 1: Type";
  if (step === "upload") return "Step 2: Upload CSV";
  if (step === "columns") return "Step 3: Columns";
  if (step === "course") return "Step 4: Course";
  return "Import setup";
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="premium-card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-4xl font-semibold tracking-normal">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="truncate text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function aggregateShotCount(parsedFiles: Array<{ parsed: { shotCount: number } }>) {
  return parsedFiles.reduce((total, file) => total + file.parsed.shotCount, 0);
}

function buildDeterministicImportWarnings(
  files: Array<{
    fileName: string;
    parsed: {
      detectedDistanceUnit: string;
      shots: Array<{
        rowNumber: number;
        shotNumber: number | null;
        clubType: string;
        clubTypeRaw: string | null;
        carryYd: number | null;
        totalYd: number | null;
        ballSpeedMph: number | null;
        launchAngleDeg: number | null;
        sourceRawJson: Record<string, string>;
      }>;
    };
  }>,
) {
  const warnings: string[] = [];
  const units = [
    ...new Set(
      files.map((file) => file.parsed.detectedDistanceUnit).filter((unit) => unit !== "unknown"),
    ),
  ];

  if (units.length > 1) {
    warnings.push(
      `Detected mixed distance units across files (${units.join(", ")}). Confirm the fallback unit before saving.`,
    );
  }

  for (const file of files) {
    const duplicateRows = countDuplicateShotRows(file.parsed.shots);
    const impossibleCarryRows = file.parsed.shots
      .filter(
        (shot) =>
          (shot.carryYd !== null && (shot.carryYd < 0 || shot.carryYd > 430)) ||
          (shot.totalYd !== null && (shot.totalYd < 0 || shot.totalYd > 500)),
      )
      .slice(0, 3);
    const missingLaunchCount = file.parsed.shots.filter(
      (shot) => shot.ballSpeedMph === null || shot.launchAngleDeg === null,
    ).length;
    const unknownClubCount = file.parsed.shots.filter((shot) => shot.clubType === "unknown").length;

    if (duplicateRows > 0) {
      warnings.push(
        `${file.fileName}: ${duplicateRows} duplicate-looking shot row${duplicateRows === 1 ? "" : "s"} detected before save.`,
      );
    }

    if (impossibleCarryRows.length > 0) {
      warnings.push(
        `${file.fileName}: check impossible distance values near row ${impossibleCarryRows.map((shot) => shot.rowNumber).join(", ")}.`,
      );
    }

    if (missingLaunchCount > 0) {
      warnings.push(
        `${file.fileName}: ${missingLaunchCount} shot${missingLaunchCount === 1 ? "" : "s"} are missing ball speed or launch angle.`,
      );
    }

    if (unknownClubCount > 0) {
      warnings.push(
        `${file.fileName}: ${unknownClubCount} shot${unknownClubCount === 1 ? "" : "s"} have club names that need mapping.`,
      );
    }
  }

  return warnings;
}

function countDuplicateShotRows(
  shots: Array<{
    shotNumber: number | null;
    clubTypeRaw: string | null;
    carryYd: number | null;
    totalYd: number | null;
    ballSpeedMph: number | null;
    launchAngleDeg: number | null;
    sourceRawJson: Record<string, string>;
  }>,
) {
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const shot of shots) {
    const key = [
      shot.shotNumber,
      shot.clubTypeRaw,
      shot.carryYd,
      shot.totalYd,
      shot.ballSpeedMph,
      shot.launchAngleDeg,
      JSON.stringify(shot.sourceRawJson),
    ].join("|");

    if (seen.has(key)) {
      duplicateCount += 1;
    } else {
      seen.add(key);
    }
  }

  return duplicateCount;
}

function hasColumnMapping(columnMapping: RapsodoColumnMapping) {
  return Object.values(columnMapping).some((value) => Boolean(value?.trim()));
}

function compareSessionHref(sessionId: string) {
  const params = new URLSearchParams({
    focus: "session",
    sessionId,
    baseline: "previous-session",
  });

  return `/compare?${params.toString()}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read the scorecard image."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the scorecard image."));
    reader.readAsDataURL(file);
  });
}

function getClientOnlineStatus() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
