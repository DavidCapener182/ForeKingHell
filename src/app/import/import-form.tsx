"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Award,
  ExternalLink,
  FlaskConical,
  GitCompareArrows,
  Route,
} from "lucide-react";

import { saveRapsodoImportBatchAction } from "@/app/import/actions";
import { notifyAchievementUnlocks } from "@/components/achievement-notifications";
import { OperationStatus } from "@/components/app/operation-status";
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

const SAMPLE_IMPORT_CSV = [
  "Club Type,Carry Distance (yd),Total Distance (yd),Ball Speed,Launch Angle,Side Carry (yd)",
  "7 Iron,151,158,116,18.1,-4",
  "7 Iron,154,161,118,17.6,2",
  "7 Iron,149,156,115,18.8,-7",
  "Driver,232,251,147,13.4,12",
  "Driver,238,258,150,12.9,-8",
].join("\n");

export function ImportForm({
  defaultDistanceUnit = "yards",
  startWithSampleData = false,
}: {
  defaultDistanceUnit?: DistanceUnit;
  startWithSampleData?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scorecardImageInputRef = useRef<HTMLInputElement>(null);
  const sampleLoadedRef = useRef(false);
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
  const [scorecardExtractState, setScorecardExtractState] = useState<ScorecardExtractState>({
    status: "idle",
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isOnline, setIsOnline] = useState(true);
  const [offlineStorageEnabled, setOfflineStorageEnabled] = useState(false);
  const isCourseUpload = sessionType === "simulated_course";

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

  useEffect(() => {
    if (!startWithSampleData || sampleLoadedRef.current) return;

    sampleLoadedRef.current = true;
    const sampleFile = new File([SAMPLE_IMPORT_CSV], "forekinghell-sample-session.csv", {
      type: "text/csv",
      lastModified: Date.UTC(2026, 6, 18),
    });
    void readImportFiles([sampleFile]);
  }, [readImportFiles, startWithSampleData]);

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
    !startWithSampleData &&
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
    <section className="min-w-0" data-import-ready={isHydrated ? "true" : "false"}>
      <div className="mx-auto flex w-full max-w-none flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">CSV import workspace</p>
            <p className="text-sm text-muted-foreground">
              Choose files, review mappings and save trusted rows.
            </p>
          </div>
          <Badge variant="secondary">
            {isCourseUpload ? "Simulated course CSV" : "Launch monitor CSV"}
          </Badge>
        </div>

        {startWithSampleData ? (
          <Alert>
            <FlaskConical className="size-4" />
            <AlertTitle>Sample preview only</AlertTitle>
            <AlertDescription>
              <p>
                These five demo shots are not saved to your account. Review each step, then use a
                measured export to create a real session.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href="/import?source=csv#csv-import" prefetch={false}>
                  Upload your own CSV
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {isPending ? (
          <OperationStatus
            status="working"
            title="Saving import"
            description="Validating files and saving trusted shot rows."
          />
        ) : saveState.status !== "idle" ? (
          <OperationStatus
            status={saveState.status}
            title={
              saveState.status === "error"
                ? "Import failed"
                : saveState.achievementUnlockNotifications.length > 0
                  ? "Achievements unlocked"
                  : saveState.longestShotNotifications.length > 0
                    ? "New longest shot"
                    : "Import saved"
            }
            description={
              <>
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
                  <div className="mt-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-surface)] p-3 text-[var(--status-success-foreground)]">
                    <p className="text-sm font-medium">
                      {saveState.longestShotNotifications.length === 1
                        ? "Personal best beaten"
                        : "Personal bests beaten"}
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                      {saveState.longestShotNotifications.map((notification) => (
                        <li
                          key={`${notification.clubId}-${notification.shotDistanceYd}-${notification.fileName}`}
                          className="flex flex-col gap-2 rounded-lg border border-[var(--status-success-border)] bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span>
                            <Link
                              href={clubHref(notification)}
                              className="font-medium text-foreground underline-offset-4 hover:underline"
                            >
                              {notification.clubLabel}
                            </Link>
                            {": "}
                            {formatMetric(notification.shotDistanceYd)} yd{" "}
                            {notification.distanceType}
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
                              className="inline-flex h-8 items-center gap-1 rounded-lg border bg-card px-2 text-xs font-medium text-foreground hover:bg-muted"
                            >
                              Club page
                              <ExternalLink className="size-3.5" />
                            </Link>
                            <Link
                              href={shotRowsHref(notification)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border bg-card px-2 text-xs font-medium text-foreground hover:bg-muted"
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
                  <div className="mt-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-surface)] p-3 text-[var(--status-success-foreground)]">
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
                            className="flex flex-col gap-1 rounded-lg border border-[var(--status-success-border)] bg-card px-3 py-2 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span>
                              <span className="font-medium">{achievement.name}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                - {achievement.description}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <Badge className="w-fit bg-primary text-primary-foreground hover:bg-primary/90">
                                +{achievement.xpAwarded.toLocaleString("en-GB")} XP
                              </Badge>
                              <ExternalLink className="size-3.5 text-primary" />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            }
          />
        ) : null}
        <section className="grid gap-4" data-import-configuration>
          <header>
            <h2 className="text-xl font-semibold tracking-normal">
              Choose files and configure the session
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag in one or more launch-monitor files. Obvious parse issues appear before save.
            </p>
          </header>
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="grid min-w-0 content-start gap-5">
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
            <div className="grid min-w-0 content-start gap-5">
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

              <ColumnMappingPanel
                files={uploadedFiles}
                columnMapping={columnMapping}
                onColumnMappingChange={setColumnMapping}
              />
              {isCourseUpload ? (
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
              ) : null}
            </div>
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
          <Card className="premium-card">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Round mapping step</CardTitle>
                  <CardDescription>
                    Shots are grouped into holes using the scorecard yardage and the CSV shot order.
                  </CardDescription>
                </div>
                <Route className="size-5 text-primary" />
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

        <ShotPreview shots={previewShots} isCourseUpload={isCourseUpload} />
      </div>
    </section>
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
