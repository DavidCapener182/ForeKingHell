"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Database,
  Flag,
  FileText,
  ImageIcon,
  Loader2,
  MapPinned,
  Route,
  Trophy,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";

import { saveRapsodoImportBatchAction } from "@/app/import/actions";
import { notifyAchievementUnlocks } from "@/components/achievement-notifications";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  type CourseInferenceResult,
  type InferredCourseHole,
  type InferredCourseShot,
  inferCourseShotsFromHoleShotCounts,
  inferCourseShots,
  parseScorecardText,
} from "@/lib/course-scorecard";
import { type DistanceUnit, parseRapsodoCsv } from "@/lib/rapsodo/parser";
import type { LongestShotNotification } from "@/lib/imports/save-rapsodo-import";
import type { AchievementUnlockNotification } from "@/lib/achievements/types";
import type { ExtractedScorecard } from "@/lib/scorecard-extraction";

type SessionType = "range" | "round" | "simulator" | "simulated_course";

type UploadedCsv = {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  rawCsvText: string;
};

type SaveState =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
      longestShotNotifications: LongestShotNotification[];
      achievementUnlockNotifications: AchievementUnlockNotification[];
    }
  | { status: "error"; message: string };

type ScorecardExtractState =
  | { status: "idle" }
  | { status: "loading"; fileName: string }
  | { status: "success"; fileName: string; message: string }
  | { status: "error"; fileName?: string; message: string };

type HoleReviewState = Record<
  number,
  {
    shotCount?: number | null;
    penalties?: number | null;
    score?: number | null;
    putts?: number | null;
    netScore?: number | null;
    fairwayHit?: boolean | null;
    gir?: boolean | null;
    strokeIndex?: number | null;
  }
>;

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

export function ImportForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scorecardImageInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedCsv[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("yards");
  const [sessionType, setSessionType] = useState<SessionType>("range");
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [courseName, setCourseName] = useState("");
  const [scorecardText, setScorecardText] = useState("");
  const [holeReview, setHoleReview] = useState<HoleReviewState>({});
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [scorecardExtractState, setScorecardExtractState] = useState<ScorecardExtractState>({
    status: "idle",
  });
  const [isPending, startTransition] = useTransition();
  const isCourseUpload = sessionType === "simulated_course";

  const parsedFiles = useMemo(
    () =>
      uploadedFiles.map((file) => ({
        ...file,
        parsed: parseRapsodoCsv(file.rawCsvText, { fallbackDistanceUnit: distanceUnit }),
      })),
    [distanceUnit, uploadedFiles],
  );

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
        autoCourseInference?.holes.find((autoHole) => autoHole.holeNumber === hole.holeNumber)?.shots.length ?? 0;
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
  const courseAssignedShotCount = courseHoleShotCounts.reduce((total, hole) => total + hole.shotCount, 0);

  const aggregate = useMemo(() => {
    const uniqueClubs = new Set<string>();
    const warnings: string[] = [];

    for (const file of parsedFiles) {
      for (const shot of file.parsed.shots) {
        uniqueClubs.add(shot.clubKey);
      }
      warnings.push(...file.parsed.warnings.map((warning) => `${file.fileName}: ${warning}`));
    }

    if (isCourseUpload && uploadedFiles.length > 1) {
      warnings.push("Simulated course import currently supports one CSV per save so hole inference stays deterministic.");
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
    uploadedFiles.length,
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
  const canSave =
    uploadedFiles.length > 0 &&
    aggregate.shotCount > 0 &&
    (!isCourseUpload ||
      (uploadedFiles.length === 1 &&
        scorecard.holes.length > 0 &&
        courseAssignedShotCount === aggregate.shotCount)) &&
    !isPending;

  async function readSelectedFiles(files: FileList | File[]) {
    const csvFiles = Array.from(files).filter((file) => {
      const name = file.name.toLowerCase();
      return name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
    });

    setSaveState({ status: "idle" });

    if (csvFiles.length === 0) {
      return;
    }

    const nextFiles = await Promise.all(
      csvFiles.map(async (file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        fileName: file.name,
        fileSizeBytes: file.size,
        rawCsvText: await file.text(),
      })),
    );

    setUploadedFiles((currentFiles) => {
      const existingIds = new Set(currentFiles.map((file) => file.id));
      return [...currentFiles, ...nextFiles.filter((file) => !existingIds.has(file.id))];
    });
  }

  function removeFile(fileId: string) {
    setSaveState({ status: "idle" });
    setUploadedFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
  }

  function clearBatch() {
    setSaveState({ status: "idle" });
    setUploadedFiles([]);
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
      setScorecardExtractState({ status: "error", fileName: file.name, message: "Choose a scorecard image file." });
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
    const isSawgrass = /sawgrass|stadium/i.test(extractedCourseName);
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
    setCourseName(extractedCourseName || "TPC Sawgrass - THE PLAYERS Stadium Course");
    setHoleReview(nextHoleReview);

    if (scorecard.dateIso) {
      setSessionDate(scorecard.dateIso);
    }

    if (isSawgrass || scorecard.totalYards === 6086) {
      setScorecardText(TPC_SAWGRASS_PLAYERS_2026_SCORECARD);
      return `Extracted ${scorecard.holes.length} hole scores and applied the TPC Sawgrass White tee yardages.`;
    }

    const extractedRows = scorecard.holes
      .filter((hole) => hole.par !== null && hole.yards !== null)
      .map((hole) => [hole.holeNumber, hole.par, hole.yards].join(","));

    if (extractedRows.length === scorecard.holes.length && extractedRows.length > 0) {
      setScorecardText(extractedRows.join("\n"));
      return `Extracted ${scorecard.holes.length} holes from the scorecard image.`;
    }

    return `Extracted ${scorecard.holes.length} hole scores. Add scorecard yardages before saving.`;
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
    startTransition(async () => {
      const result = await saveRapsodoImportBatchAction(
        uploadedFiles.map((file) => ({
          ...file,
          parsed: parseRapsodoCsv(file.rawCsvText, { fallbackDistanceUnit: distanceUnit }),
        })).map((file) => ({
          rawCsvText: file.rawCsvText,
          fileName: file.fileName,
          fileSizeBytes: file.fileSizeBytes,
          source: "rapsodo",
          sessionType,
          sessionDate: file.parsed.exportedAtIso ?? sessionDate,
          distanceUnit,
          courseName: isCourseUpload ? courseName : undefined,
          courseScorecardText: isCourseUpload ? scorecardText : undefined,
          courseHoleShotCounts: isCourseUpload ? courseHoleShotCounts : undefined,
          courseHoleScoring: isCourseUpload ? courseHoleScoring : undefined,
        })),
      );

      if (result.ok) {
        const skippedText =
          result.skippedCount > 0
            ? ` ${result.skippedCount} duplicate ${result.skippedCount === 1 ? "file was" : "files were"} skipped.`
            : "";
        setSaveState({
          status: "success",
          message: `Saved ${result.shotCount} shots and ${result.rawRowCount} raw rows from ${result.sessionCount} CSV ${
            result.sessionCount === 1 ? "file" : "files"
          } across ${result.clubCount} detected clubs.${skippedText}`,
          longestShotNotifications: result.longestShotNotifications,
          achievementUnlockNotifications: result.achievementUnlockNotifications,
        });
        notifyAchievementUnlocks(result.achievementUnlockNotifications);
        setUploadedFiles([]);
        router.refresh();
      } else {
        setSaveState({ status: "error", message: result.message });
      }
    });
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
          </Button>
          <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">
            {isCourseUpload ? "Simulated course CSV" : "Batch Rapsodo CSV"}
          </Badge>
        </div>

        <header className="premium-hero p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
                Import launch monitor shots
              </h1>
              <p className="text-base leading-7 text-muted-foreground">
                Upload one or more Rapsodo MLM2PRO CSVs, review the normalized shot rows, then save
                each file as its own session in Postgres.
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
                className="w-full bg-[#111827] text-white sm:w-auto"
              >
                <Upload className="size-4" />
                {isPending ? "Saving..." : "Save batch"}
              </Button>
            </div>
          </div>
        </header>


        <ImportStepper
          isCourseUpload={isCourseUpload}
          hasFiles={uploadedFiles.length > 0}
          hasShots={aggregate.shotCount > 0}
          hasCourseMapping={!isCourseUpload || (scorecard.holes.length > 0 && courseAssignedShotCount === aggregate.shotCount)}
          hasWarnings={aggregate.warnings.length > 0}
          canSave={canSave}
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
              {saveState.status === "success" && saveState.longestShotNotifications.length > 0 ? (
                <div className="mt-3 rounded-[8px] border bg-[#f9fafb] p-3 text-foreground">
                  <p className="text-sm font-medium">
                    {saveState.longestShotNotifications.length === 1
                      ? "Personal best beaten"
                      : "Personal bests beaten"}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {saveState.longestShotNotifications.map((notification) => (
                      <li key={`${notification.clubId}-${notification.shotDistanceYd}-${notification.fileName}`}>
                        <span className="font-medium text-foreground">{notification.clubLabel}</span>
                        {": "}
                        {formatMetric(notification.shotDistanceYd)} yd {notification.distanceType}
                        {" beat "}
                        {formatMetric(notification.previousDistanceYd)} yd
                        {notification.shotNumber === null ? "" : ` on shot ${notification.shotNumber}`}
                        {"."}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {saveState.status === "success" && saveState.achievementUnlockNotifications.length > 0 ? (
                <div className="mt-3 rounded-[8px] border bg-emerald-50 p-3 text-foreground">
                  <p className="text-sm font-medium">
                    {saveState.achievementUnlockNotifications.length === 1
                      ? "Achievement unlocked"
                      : "Achievements unlocked"}
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {saveState.achievementUnlockNotifications.map((achievement) => (
                      <li
                        key={`${achievement.achievementId}-${achievement.unlockedAt}`}
                        className="flex flex-col gap-1 rounded-[8px] bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span>
                          <span className="font-medium">{achievement.name}</span>
                          <span className="text-muted-foreground"> - {achievement.description}</span>
                        </span>
                        <Badge className="w-fit bg-[#111827] text-white hover:bg-[#111827]">
                          +{achievement.xpAwarded.toLocaleString("en-GB")} XP
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {saveState.status === "success" ? (
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/achievements">
                    <Award className="size-4" />
                    View achievements
                  </Link>
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Step 1: Upload CSV</CardTitle>
              <CardDescription>Drag in one or more Rapsodo files. Obvious parse issues appear before save.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <input
                ref={fileInputRef}
                className="hidden"
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                multiple
                onChange={(event) => {
                  void readSelectedFiles(event.target.files ?? []);
                  event.currentTarget.value = "";
                }}
              />

              <div
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed bg-[#f9fafb] px-4 py-8 text-center transition-colors",
                  isDragging ? "border-emerald-500 bg-emerald-50" : "border-border hover:border-emerald-400",
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  void readSelectedFiles(event.dataTransfer.files);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <UploadCloud className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Choose CSV files</p>
                  <p className="text-sm text-muted-foreground">Click here or drop multiple CSVs at once.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload className="size-4" />
                  Browse files
                </Button>
              </div>

              {uploadedFiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Selected files</p>
                    <Button type="button" variant="ghost" size="sm" onClick={clearBatch}>
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {parsedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-3 rounded-[8px] border bg-white px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="size-4 shrink-0 text-sky-500" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{file.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.parsed.shotCount} shots
                              {file.parsed.exportedAtIso
                                ? `, ${formatDate(file.parsed.exportedAtIso)}`
                                : ""}
                              , {file.parsed.detectedDistanceUnit} detected
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(file.id)}
                          aria-label={`Remove ${file.fileName}`}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="session-date">
                    Session date
                  </label>
                  <Input
                    id="session-date"
                    type="date"
                    value={sessionDate}
                    onChange={(event) => setSessionDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Session type</label>
                  <Select value={sessionType} onValueChange={(value) => setSessionType(value as SessionType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="range">Range</SelectItem>
                      <SelectItem value="round">Round</SelectItem>
                      <SelectItem value="simulator">Simulator</SelectItem>
                      <SelectItem value="simulated_course">Simulated course</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isCourseUpload ? (
                <div className="space-y-4 rounded-[8px] border bg-[#f9fafb] p-4">
                  <div className="flex items-start gap-3">
                    <MapPinned className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Course scorecard</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          The CSV does not include hole labels, so the app uses the scorecard, shot order,
                          and review rows below to map shots to holes. Enter a hole score and anything
                          above CSV shots plus penalties is treated as putts.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={applySawgrassPreset}>
                        Use TPC Sawgrass preset
                      </Button>
                      <input
                        ref={scorecardImageInputRef}
                        className="hidden"
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          void extractScorecardImage(event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                      <div className="flex flex-col gap-2 rounded-[8px] border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Scorecard screenshot</p>
                          <p className="text-xs leading-5 text-muted-foreground">
                            Upload an 18Birdies scorecard image to pull scores, putts, FIR, GIR,
                            handicap strokes and the round date into the review rows.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={scorecardExtractState.status === "loading"}
                          onClick={() => scorecardImageInputRef.current?.click()}
                        >
                          {scorecardExtractState.status === "loading" ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <ImageIcon className="size-4" />
                          )}
                          {scorecardExtractState.status === "loading" ? "Reading..." : "Upload image"}
                        </Button>
                      </div>
                      {scorecardExtractState.status !== "idle" ? (
                        <p
                          className={cn(
                            "text-xs leading-5",
                            scorecardExtractState.status === "error"
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {scorecardExtractState.status === "loading"
                            ? `Extracting ${scorecardExtractState.fileName}...`
                            : scorecardExtractState.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[0.85fr_1.15fr]">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="course-name">
                        Course name
                      </label>
                      <Input
                        id="course-name"
                        value={courseName}
                        onChange={(event) => setCourseName(event.target.value)}
                        placeholder="TPC Sawgrass"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="scorecard">
                        Scorecard rows
                      </label>
                      <textarea
                        id="scorecard"
                        value={scorecardText}
                        onChange={(event) => setScorecardText(event.target.value)}
                        placeholder={"1,4,423,Opening\n2,5,532\n3,3,177"}
                        className="min-h-28 w-full resize-y rounded-[8px] border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        {scorecard.holes.length > 0
                          ? `${scorecard.holes.length} holes, ${scorecard.holes
                              .reduce((total, hole) => total + hole.yards, 0)
                              .toLocaleString("en-GB")} yards`
                          : "Use one row per hole: hole, par, yards, optional name."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Step 2: Confirm session</p>
                    <p className="text-xs text-muted-foreground">Type, date, unit fallback, and course details if needed.</p>
                  </div>
                  <Badge variant="outline">Confirm</Badge>
                </div>
                <label className="text-sm font-medium">Fallback distance unit</label>
                <Select value={distanceUnit} onValueChange={(value) => setDistanceUnit(value as DistanceUnit)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Yards" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yards">Yards</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Distances are imported in yards. Apex is imported in feet. Detected units:{" "}
                  {detectedUnits.length > 0 ? detectedUnits.join(", ") : "none yet"}.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Files"
              value={aggregate.fileCount.toString()}
              detail={uploadedFiles.length > 0 ? "Ready for batch import" : "No files selected"}
            />
            <MetricCard label="Rows" value={aggregate.rowCount.toString()} detail="All non-empty CSV rows" />
            <MetricCard label="Shots" value={aggregate.shotCount.toString()} detail="Parsed preview rows" />
            <MetricCard label="Clubs" value={aggregate.clubCount.toString()} detail="Detected across files" />
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

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Step 4: Save import</CardTitle>
            <CardDescription>Save only when the checklist is green. Successful saves show PBs, achievements, and updated yardages.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-2 text-sm">
              <ChecklistItem complete={uploadedFiles.length > 0}>CSV file selected</ChecklistItem>
              <ChecklistItem complete={aggregate.shotCount > 0}>Shots detected</ChecklistItem>
              <ChecklistItem complete={!isCourseUpload || courseAssignedShotCount === aggregate.shotCount}>Round mapping complete</ChecklistItem>
              <ChecklistItem complete={aggregate.warnings.length === 0}>Warnings reviewed</ChecklistItem>
            </div>
            <Button type="button" size="lg" disabled={!canSave} onClick={saveImportBatch} className="bg-[#111827] text-white">
              <Upload className="size-4" />
              {isPending ? "Saving..." : "Save import"}
            </Button>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Step 3: Review shots</CardTitle>
            <CardDescription>
              Showing the first {previewShots.length} parsed shots across the selected batch. Distance
              values are stored in yards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-[8px] border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Shot</TableHead>
                    {isCourseUpload ? <TableHead>Hole</TableHead> : null}
                    <TableHead>Club</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Carry yd</TableHead>
                    <TableHead className="text-right">Total yd</TableHead>
                    <TableHead className="text-right">Ball mph</TableHead>
                    <TableHead className="text-right">Launch</TableHead>
                    <TableHead className="text-right">Side yd</TableHead>
                    {isCourseUpload ? <TableHead className="text-right">Remain</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewShots.length > 0 ? (
                    previewShots.map((shot) => (
                      <TableRow key={`${shot.fileName}-${shot.rowNumber}-${shot.clubKey}`}>
                        <TableCell className="max-w-40 truncate">{shot.fileName}</TableCell>
                        <TableCell>{shot.fileShotNumber}</TableCell>
                        {isCourseUpload ? (
                          <TableCell>
                            {shot.courseShot
                              ? `${shot.courseShot.holeNumber}.${shot.courseShot.holeShotNumber}`
                              : "--"}
                          </TableCell>
                        ) : null}
                        <TableCell className="font-medium">{shot.clubLabel}</TableCell>
                        <TableCell>{shot.clubBrand ?? "--"}</TableCell>
                        <TableCell className="text-right">{formatMetric(shot.carryYd)}</TableCell>
                        <TableCell className="text-right">{formatMetric(shot.totalYd)}</TableCell>
                        <TableCell className="text-right">{formatMetric(shot.ballSpeedMph)}</TableCell>
                        <TableCell className="text-right">{formatMetric(shot.launchAngleDeg)}</TableCell>
                        <TableCell className="text-right">{formatMetric(shot.sideCarryYd)}</TableCell>
                        {isCourseUpload ? (
                          <TableCell className="text-right">
                            {formatMetric(shot.courseShot?.distanceRemainingYd ?? null)}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={isCourseUpload ? 11 : 9}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Select one or more CSV files to preview shots.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}


function ImportStepper({
  isCourseUpload,
  hasFiles,
  hasShots,
  hasCourseMapping,
  hasWarnings,
  canSave,
}: {
  isCourseUpload: boolean;
  hasFiles: boolean;
  hasShots: boolean;
  hasCourseMapping: boolean;
  hasWarnings: boolean;
  canSave: boolean;
}) {
  const steps = [
    { label: "Upload", detail: hasFiles ? "CSV selected" : "Choose CSV", complete: hasFiles },
    { label: "Confirm", detail: "Session settings", complete: hasFiles },
    {
      label: "Review",
      detail: isCourseUpload ? "Shots + round map" : "Shot preview",
      complete: hasShots && hasCourseMapping,
    },
    { label: "Save", detail: canSave ? "Ready" : hasWarnings ? "Warnings" : "Waiting", complete: canSave },
  ];

  return (
    <Card className="premium-card">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3 rounded-xl border bg-[#f9fafb] p-3">
            <div
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
                step.complete ? "bg-emerald-600 text-white" : "bg-white text-muted-foreground",
              )}
            >
              {step.complete ? <CheckCircle2 className="size-4" /> : index + 1}
            </div>
            <div>
              <p className="text-sm font-semibold">{step.label}</p>
              <p className="text-xs text-muted-foreground">{step.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ChecklistItem({ complete, children }: { complete: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className={cn("size-4", complete ? "text-emerald-600" : "text-muted-foreground")} />
      <span className={complete ? "font-medium" : "text-muted-foreground"}>{children}</span>
    </div>
  );
}

function CourseOverlay({
  inference,
  holeReview,
  totalShotCount,
  assignedShotCount,
  onReset,
  onUpdateHole,
}: {
  inference: CourseInferenceResult | null;
  holeReview: HoleReviewState;
  totalShotCount: number;
  assignedShotCount: number;
  onReset: () => void;
  onUpdateHole: (holeNumber: number, patch: HoleReviewState[number]) => void;
}) {
  if (!inference) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed bg-[#f9fafb] p-6 text-center">
        <MapPinned className="size-8 text-emerald-600" />
        <div className="space-y-1">
          <p className="font-medium">Waiting for a CSV and scorecard</p>
          <p className="text-sm text-muted-foreground">
            Add one simulated course CSV and scorecard rows to generate the overlay.
          </p>
        </div>
      </div>
    );
  }

  const assignedText = `${inference.assignedShotCount}/${inference.assignedShotCount + inference.unassignedShotCount}`;
  const assignmentMatches = assignedShotCount === totalShotCount;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <CourseMetric label="Mapped shots" value={assignedText} />
        <CourseMetric
          label="Review total"
          value={`${assignedShotCount}/${totalShotCount}`}
          tone={assignmentMatches ? "default" : "warning"}
        />
        <CourseMetric label="Holes" value={inference.completedHoleCount.toString()} />
        <CourseMetric label="Scorecard" value={`${inference.totalScorecardYards.toLocaleString("en-GB")} yd`} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border bg-[#f9fafb] p-3">
        <p className="text-sm text-muted-foreground">
          Edit CSV shots to move the boundary between holes. Enter score and penalties to calculate putts.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Reset auto splits
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {inference.holes.map((hole) => (
          <HoleOverlay
            key={hole.holeNumber}
            hole={hole}
            review={holeReview[hole.holeNumber]}
            onUpdate={(patch) => onUpdateHole(hole.holeNumber, patch)}
          />
        ))}
      </div>
    </div>
  );
}

function CourseMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className={cn("rounded-[8px] border bg-[#f9fafb] p-3", tone === "warning" && "border-amber-300 bg-amber-50")}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function HoleOverlay({
  hole,
  review,
  onUpdate,
}: {
  hole: InferredCourseHole;
  review: HoleReviewState[number] | undefined;
  onUpdate: (patch: HoleReviewState[number]) => void;
}) {
  const maxSide = Math.max(35, ...hole.shots.map((shot) => Math.abs(shot.displaySideYd)));
  const points = hole.shots.map((shot) => ({
    shot,
    x: 28 + Math.min(1, Math.max(0, shot.progressAfterYd / hole.yards)) * 244,
    y: 50 + Math.max(-1, Math.min(1, shot.displaySideYd / maxSide)) * 28,
  }));
  const score = review?.score ?? null;
  const explicitPutts = review?.putts ?? null;
  const penalties =
    explicitPutts !== null && score !== null
      ? Math.max(0, score - hole.shots.length - explicitPutts)
      : Math.max(0, review?.penalties ?? 0);
  const putts =
    explicitPutts ??
    (score === null ? null : Math.max(0, score - hole.shots.length - penalties));

  return (
    <div className="overflow-hidden rounded-[8px] border bg-white">
      <div className="flex items-start justify-between gap-3 border-b bg-[#f9fafb] px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            Hole {hole.holeNumber}
            {hole.name ? ` - ${hole.name}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Par {hole.par} - {hole.yards.toLocaleString("en-GB")} yd - {hole.shots.length} shots
            {review?.strokeIndex ? ` - SI ${review.strokeIndex}` : ""}
          </p>
        </div>
        <Flag className="size-4 shrink-0 text-emerald-600" />
      </div>
      <svg viewBox="0 0 300 104" className="h-28 w-full bg-[#f4f7f2]" role="img" aria-label={`Hole ${hole.holeNumber} overlay`}>
        <rect x="0" y="0" width="300" height="104" fill="#f4f7f2" />
        <path
          d="M24 50 C82 20 132 80 184 48 C220 26 252 38 276 50 C252 62 220 74 184 56 C132 24 82 84 24 50Z"
          fill="#cfe8d1"
          stroke="#a4c7a8"
        />
        <ellipse cx="266" cy="50" rx="18" ry="13" fill="#a7d8ab" stroke="#6ca771" />
        <circle cx="28" cy="50" r="5" fill="#f59e0b" />
        <line x1="28" x2="272" y1="50" y2="50" stroke="#6b7280" strokeDasharray="4 5" strokeOpacity="0.35" />
        {points.map((point, index) => {
          const previous = index === 0 ? { x: 28, y: 50 } : points[index - 1];

          return (
            <g key={`${point.shot.holeNumber}-${point.shot.holeShotNumber}`}>
              <line
                x1={previous.x}
                y1={previous.y}
                x2={point.x}
                y2={point.y}
                stroke="#111827"
                strokeWidth="1.5"
                strokeOpacity="0.45"
              />
              <circle cx={point.x} cy={point.y} r="5.5" fill={categoryColour(point.shot)} />
              <text
                x={point.x}
                y={point.y + 2.8}
                textAnchor="middle"
                fontSize="7"
                fontWeight="700"
                fill="#ffffff"
              >
                {point.shot.holeShotNumber}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="grid grid-cols-3 border-t px-3 py-2 text-xs">
        <span className="text-muted-foreground">Progress</span>
        <span className="text-center font-medium">{formatMetric(hole.progressYd)} yd</span>
        <span className="text-right text-muted-foreground">{formatMetric(hole.distanceRemainingYd)} left</span>
      </div>
      <div className="grid gap-2 border-t bg-[#f9fafb] p-3 text-sm sm:grid-cols-3">
        <NumberField
          label="CSV shots"
          value={hole.shots.length}
          min={0}
          max={10}
          onChange={(value) => onUpdate({ shotCount: value })}
        />
        <NumberField
          label="Score"
          value={score}
          min={1}
          max={12}
          placeholder="-"
          onChange={(value) => onUpdate({ score: value })}
        />
        <NumberField
          label="Putts"
          value={putts}
          min={0}
          max={8}
          placeholder="-"
          onChange={(value) => onUpdate({ putts: value })}
        />
        <NumberField
          label="Penalties"
          value={penalties}
          min={0}
          max={8}
          onChange={(value) => onUpdate({ penalties: value })}
        />
        <div className="rounded-[8px] border bg-white p-2">
          <p className="text-xs text-muted-foreground">Fairway</p>
          <p className="mt-1 text-lg font-semibold tracking-normal">
            {review?.fairwayHit === null || review?.fairwayHit === undefined
              ? "-"
              : review.fairwayHit
                ? "Hit"
                : "Miss"}
          </p>
        </div>
        <div className="rounded-[8px] border bg-white p-2">
          <p className="text-xs text-muted-foreground">GIR</p>
          <p className="mt-1 text-lg font-semibold tracking-normal">
            {review?.gir === null || review?.gir === undefined ? "-" : review.gir ? "Hit" : "Miss"}
          </p>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  placeholder?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="rounded-[8px] border bg-white p-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => {
          if (event.target.value === "") {
            onChange(null);
            return;
          }

          const nextValue = Number(event.target.value);
          onChange(Number.isFinite(nextValue) ? Math.max(min, Math.min(max, Math.floor(nextValue))) : null);
        }}
        className="mt-1 h-8 border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
      />
    </label>
  );
}

function categoryColour(shot: InferredCourseShot) {
  if (shot.shotCategory === "tee") {
    return "#111827";
  }

  if (shot.shotCategory === "approach") {
    return "#0284c7";
  }

  if (shot.shotCategory === "pitch") {
    return "#059669";
  }

  return "#f97316";
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function aggregateShotCount(parsedFiles: Array<{ parsed: { shotCount: number } }>) {
  return parsedFiles.reduce((total, file) => total + file.parsed.shotCount, 0);
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
