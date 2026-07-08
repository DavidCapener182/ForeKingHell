"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Cloud,
  CloudUpload,
  Database,
  ExternalLink,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  X,
} from "lucide-react";

import {
  disconnectRapsodoAction,
  importRapsodoSessionAction,
  listRapsodoSessionsAction,
  loginRapsodoAction,
  previewRapsodoSessionAction,
  syncRapsodoShotClubsAction,
} from "@/app/rapsodo/actions";
import { notifyAchievementUnlocks } from "@/components/achievement-notifications";
import { CourseScorecardSvg } from "@/components/course-scorecard-svg";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataPair,
  MobileAccordionSection,
  MobileBentoSummary,
  MobileDataCard,
  MobileDataList,
  StickyMobileAction,
} from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
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
  DesktopTableWorkbenchControls,
  DesktopWorkflowLayout,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
  type DesktopWorkflowHelpItem,
  type DesktopWorkflowStep,
} from "@/components/app/desktop-workbench";
import {
  formatCourseScorecardText,
  type InferredCourseShot,
  inferCourseShots,
  inferCourseShotsFromHoleShotCounts,
  parseScorecardText,
} from "@/lib/course-scorecard";
import type { RapsodoShotOverride } from "@/lib/imports/save-rapsodo-import";
import type { RapsodoClubChoice } from "@/lib/rapsodo/club-inference";
import {
  buildCourseHoleScoringRows,
  summarizeCourseHoleScoring,
} from "@/lib/rapsodo/course-scoring";
import type { RapsodoSessionListItem, RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";
import { cn } from "@/lib/utils";

type ConnectionStatus = {
  connected: boolean;
  expiresAt: string | null;
  profile: Record<string, unknown> | null;
};

type Notice =
  | { kind: "idle" }
  | { kind: "success"; title: string; message: string; sessionId?: string | null }
  | { kind: "error"; title: string; message: string };
type SaveStatus =
  | { kind: "saving"; title: string; message: string }
  | { kind: "success"; title: string; message: string; sessionId: string | null }
  | { kind: "error"; title: string; message: string };
type SaveConfirmation = {
  id: string;
  title: string;
  message: string;
  sessionId: string | null;
};

type HoleReviewState = Record<
  number,
  {
    shotCount?: number | null;
    score?: number | null;
    putts?: number | null;
    penalties?: number | null;
  }
>;

type ClubSelectionMode = "recommendations" | "rapsodo" | "custom";
type CourseImportMode = "shot_only" | "scored_round";
type BrowserNotificationState = NotificationPermission | "unsupported";
type RapsodoMobileStep =
  | "connect"
  | "sessions"
  | "preview"
  | "clubs"
  | "course"
  | "import"
  | "review";

const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const RAPSODO_SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const SAVE_CONFIRMATION_DISMISS_MS = 14000;
const rapsodoSessionColumns: DesktopWorkbenchColumn[] = [
  { id: "session", label: "Session", locked: true },
  { id: "type", label: "Type" },
  { id: "date", label: "Date" },
  { id: "shots", label: "Shots" },
  { id: "action", label: "Action", locked: true },
];
const rapsodoSessionSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "New R-Cloud sessions",
    href: "/rapsodo#rapsodo-sessions",
    detail: "Load unimported sessions, then preview before saving.",
  },
  {
    title: "Course sessions",
    href: "/rapsodo#rapsodo-sessions",
    detail: "Use the Course filter for scorecard and hole-mapping review.",
  },
  {
    title: "Manual CSV fallback",
    href: "/import?source=csv#csv-import",
    detail: "Use the CSV import wizard when cloud sync is unavailable.",
  },
];
const rapsodoWorkflowHelpItems = [
  {
    title: "Token privacy",
    detail:
      "Rapsodo credentials are exchanged for a short-lived encrypted token; the password is not stored.",
  },
  {
    title: "Review before save",
    detail:
      "Preview sessions, club matches and course context before the data changes bag trust or coach priorities.",
  },
  {
    title: "Avoid duplicates",
    detail:
      "Imported R-Cloud sessions are hidden from the inbox and linked back to LM World Tour shot evidence.",
  },
] satisfies DesktopWorkflowHelpItem[];

export function RapsodoSyncClient({
  initialStatus,
  children,
}: {
  initialStatus: ConnectionStatus;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [notice, setNotice] = useState<Notice>({ kind: "idle" });
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [saveConfirmation, setSaveConfirmation] = useState<SaveConfirmation | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessions, setSessions] = useState<RapsodoSessionListItem[]>([]);
  const [sessionFilter, setSessionFilter] = useState<"all" | "range" | "course">("all");
  const [dateFilter, setDateFilter] = useState({ startDate: "", endDate: "" });
  const [preview, setPreview] = useState<RapsodoSessionPreview | null>(null);
  const [selectedClubByRow, setSelectedClubByRow] = useState<Record<number, string>>({});
  const [clubSelectionMode, setClubSelectionMode] = useState<ClubSelectionMode>("recommendations");
  const [updateRapsodoClubs, setUpdateRapsodoClubs] = useState(false);
  const [courseImportMode, setCourseImportMode] = useState<CourseImportMode>("shot_only");
  const [mobileStep, setMobileStep] = useState<RapsodoMobileStep>("connect");
  const [courseName, setCourseName] = useState("");
  const [scorecardText, setScorecardText] = useState("");
  const [holeReview, setHoleReview] = useState<HoleReviewState>({});
  const [browserNotificationState, setBrowserNotificationState] =
    useState<BrowserNotificationState>(() =>
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "unsupported",
    );
  const noticeRef = useRef<HTMLDivElement | null>(null);
  const previewSectionRef = useRef<HTMLElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);

  const availableSessions = useMemo(
    () => sessions.filter((session) => !session.importedSessionId),
    [sessions],
  );

  const filteredSessions = useMemo(
    () =>
      availableSessions.filter((session) => {
        if (sessionFilter === "course") {
          return isCourseSession(session);
        }

        if (sessionFilter === "range") {
          return !isCourseSession(session);
        }

        return true;
      }),
    [availableSessions, sessionFilter],
  );

  const choicesByKey = useMemo(() => {
    const choices = new Map<string, RapsodoClubChoice>();

    for (const choice of preview?.clubChoices ?? []) {
      choices.set(choice.clubKey, choice);
    }

    return choices;
  }, [preview]);

  const scorecard = useMemo(() => parseScorecardText(scorecardText), [scorecardText]);
  const savedCourseScorecardText = useMemo(
    () =>
      preview?.courseScorecard.length ? formatCourseScorecardText(preview.courseScorecard) : "",
    [preview],
  );
  const usingSavedCourseScorecard = Boolean(
    savedCourseScorecardText && scorecardText.trim() === savedCourseScorecardText.trim(),
  );
  const scorecardTotalPar = scorecard.holes.reduce((total, hole) => total + hole.par, 0);
  const scorecardTotalYards = scorecard.holes.reduce((total, hole) => total + hole.yards, 0);
  const isCoursePreview = preview?.sessionType === "simulated_course";
  const autoCourseInference = useMemo(() => {
    if (!preview || !isCoursePreview || scorecard.holes.length === 0) {
      return null;
    }

    return inferCourseShots(previewShotsForCourse(preview), scorecard.holes);
  }, [isCoursePreview, preview, scorecard.holes]);
  const courseHoleShotCounts = useMemo(() => {
    if (!preview || !isCoursePreview || scorecard.holes.length === 0) {
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
  }, [autoCourseInference, holeReview, isCoursePreview, preview, scorecard.holes]);
  const courseInference = useMemo(() => {
    if (!preview || !isCoursePreview || scorecard.holes.length === 0) {
      return null;
    }

    return inferCourseShotsFromHoleShotCounts(
      previewShotsForCourse(preview),
      scorecard.holes,
      courseHoleShotCounts,
    );
  }, [courseHoleShotCounts, isCoursePreview, preview, scorecard.holes]);
  const assignedCourseShots = courseHoleShotCounts.reduce(
    (total, hole) => total + hole.shotCount,
    0,
  );
  const courseShotOnlyImport = isCoursePreview && courseImportMode === "shot_only";
  const courseHoleScoring = useMemo(() => {
    if (!courseInference) {
      return [];
    }

    return buildCourseHoleScoringRows(
      courseInference.holes.map((hole) => ({
        holeNumber: hole.holeNumber,
        shotCount: hole.shots.length,
      })),
      holeReview,
    );
  }, [courseInference, holeReview]);
  const courseScoringSummary = useMemo(
    () => summarizeCourseHoleScoring(courseHoleScoring),
    [courseHoleScoring],
  );
  const courseScorecardSvgHoles = useMemo(() => {
    const scoringByHole = new Map(courseHoleScoring.map((row) => [row.holeNumber, row]));
    const shotCountByHole = new Map(
      courseHoleShotCounts.map((hole) => [hole.holeNumber, hole.shotCount]),
    );

    return scorecard.holes.map((hole) => {
      const review = holeReview[hole.holeNumber] ?? {};
      const scoring = scoringByHole.get(hole.holeNumber);

      return {
        holeNumber: hole.holeNumber,
        par: hole.par,
        yards: hole.yards,
        score: review.score ?? null,
        putts: scoring?.putts ?? null,
        penalties: scoring?.penalties ?? review.penalties ?? null,
        shotCount: shotCountByHole.get(hole.holeNumber) ?? null,
      };
    });
  }, [courseHoleScoring, courseHoleShotCounts, holeReview, scorecard.holes]);
  const scoredRoundNeedsScores = Boolean(isCoursePreview && !courseShotOnlyImport);
  const scoredRoundReady = !scoredRoundNeedsScores || courseScoringSummary.isComplete;
  const everyShotHasClub =
    preview?.shots.every((shot) => {
      const choice = choicesByKey.get(selectedClubByRow[shot.rowNumber]);
      return choice && choice.clubType !== "unknown" && choice.clubType !== "other";
    }) ?? false;
  const courseReady =
    !isCoursePreview ||
    courseShotOnlyImport ||
    (scorecard.holes.length > 0 &&
      assignedCourseShots === preview?.shotCount &&
      courseName.trim().length > 0 &&
      scoredRoundReady);
  const newSessionCount = availableSessions.filter((session) => session.isNew).length;
  const rapsodoWritebackRows = useMemo(() => {
    if (!preview) {
      return {
        updates: [],
        updatableCount: 0,
        skippedCount: 0,
      };
    }

    const updates = preview.shots.map((shot) => {
      const choice = choicesByKey.get(selectedClubByRow[shot.rowNumber]) ?? shot.suggestion.choice;

      return {
        rowNumber: shot.rowNumber,
        rapsodoShotId: shot.rapsodoShotId,
        rapsodoClubId: choice.rapsodoClubId ?? null,
        clubLabel: choice.clubLabel,
      };
    });

    return {
      updates,
      updatableCount: updates.filter((update) => update.rapsodoShotId && update.rapsodoClubId)
        .length,
      skippedCount: updates.filter((update) => !update.rapsodoShotId || !update.rapsodoClubId)
        .length,
    };
  }, [choicesByKey, preview, selectedClubByRow]);
  const previewSyncSession = useMemo(() => {
    if (!preview) {
      return null;
    }

    return sessions.find((session) => isSameRapsodoSession(session, preview.session)) ?? null;
  }, [preview, sessions]);
  const importedPreviewSessionId = previewSyncSession?.importedSessionId ?? null;
  const previewAlreadyImported = Boolean(importedPreviewSessionId);
  const importedPreviewStatus: SaveStatus | null = importedPreviewSessionId
    ? {
        kind: "success",
        title: "Session already imported",
        message: previewSyncSession?.lastImportedAt
          ? `Imported ${formatDateTime(previewSyncSession.lastImportedAt)}. It is hidden from the R-Cloud inbox so you do not save it twice.`
          : "This R-Cloud session is already linked in LM World Tour and hidden from the R-Cloud inbox.",
        sessionId: importedPreviewSessionId,
      }
    : null;
  const visibleSaveStatus = saveStatus ?? importedPreviewStatus;
  const isSavingPreview = saveStatus?.kind === "saving";
  const saveButtonLabel = previewAlreadyImported
    ? "Imported"
    : isSavingPreview
      ? loadingLabel === "Updating Rapsodo clubs"
        ? "Updating Rapsodo"
        : "Importing session"
      : "Save confirmed shots";
  const canSave = Boolean(
    preview && everyShotHasClub && courseReady && !isPending && !previewAlreadyImported,
  );
  const mobileSteps = useMemo(
    () => [
      { id: "connect" as const, label: "Connect/upload" },
      { id: "sessions" as const, label: "Choose" },
      { id: "preview" as const, label: "Preview" },
      { id: "clubs" as const, label: "Map clubs" },
      ...(isCoursePreview ? [{ id: "course" as const, label: "Course" }] : []),
      { id: "import" as const, label: "Import" },
      { id: "review" as const, label: "Review trust" },
    ],
    [isCoursePreview],
  );
  const visibleMobileStep = mobileSteps.some((step) => step.id === mobileStep)
    ? mobileStep
    : "preview";
  const activeMobileStepIndex = mobileSteps.findIndex((step) => step.id === visibleMobileStep);
  const isMobileReviewStep = ["preview", "clubs", "course", "import", "review"].includes(
    visibleMobileStep,
  );
  const showStickyReviewBar = Boolean(preview && isMobileReviewStep);
  const showMobileReviewChrome = Boolean(preview);
  const showMobileConnectionCard = !status.connected || visibleMobileStep === "connect";
  const showMobileSessionsCard = status.connected && (!preview || visibleMobileStep === "sessions");
  const latestUnimportedSession = useMemo(
    () =>
      [...availableSessions].sort(
        (left, right) => sessionTimestamp(right) - sessionTimestamp(left),
      )[0] ?? null,
    [availableSessions],
  );
  const rapsodoWorkflowSteps = buildRapsodoWorkflowSteps({
    availableCount: availableSessions.length,
    canSave,
    connected: status.connected,
    courseReady,
    everyShotHasClub,
    previewShotCount: preview?.shotCount ?? null,
    saveStatus: visibleSaveStatus?.kind ?? null,
    totalSessions: sessions.length,
  });

  const loadSessions = useCallback(
    async (options: { silent?: boolean } = {}) => {
      setLoadingLabel(options.silent ? null : "Loading sessions");
      const result = await listRapsodoSessionsAction({
        take: 60,
        startDate: dateFilter.startDate || null,
        endDate: dateFilter.endDate || null,
      });
      setLoadingLabel(null);

      if (!result.ok) {
        if (!options.silent) {
          setNotice({ kind: "error", title: "Sessions unavailable", message: result.message });
        }
        if (result.code === "RAPSODO_AUTH_EXPIRED" || result.code === "RAPSODO_NOT_CONNECTED") {
          setStatus((current) => ({ ...current, connected: false }));
        }
        return;
      }

      setSessions(result.data);
      const availableResultSessions = result.data.filter((session) => !session.importedSessionId);
      const newSessions = availableResultSessions.filter((session) => session.isNew);

      if (newSessions.length > 0) {
        setNotice({
          kind: "success",
          title: "New Rapsodo sessions available",
          message: `${newSessions.length} new session${newSessions.length === 1 ? "" : "s"} found. Review them, then use Rapsodo clubs or LM World Tour recommendations before saving.`,
        });
        notifyNewRapsodoSessions(newSessions.length);
        return;
      }

      if (!options.silent) {
        setNotice({
          kind: "success",
          title: "Sessions loaded",
          message: `${availableResultSessions.length} unimported R-Cloud session${availableResultSessions.length === 1 ? "" : "s"} ready to review.`,
        });
      }
    },
    [dateFilter.endDate, dateFilter.startDate],
  );

  useEffect(() => {
    if (!status.connected) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadSessions({ silent: true });
    }, RAPSODO_SESSION_CHECK_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadSessions, status.connected]);

  useEffect(() => {
    if (!saveConfirmation) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSaveConfirmation((current) => (current?.id === saveConfirmation.id ? null : current));
    }, SAVE_CONFIRMATION_DISMISS_MS);

    return () => window.clearTimeout(timeoutId);
  }, [saveConfirmation]);

  function login() {
    setNotice({ kind: "idle" });
    setLoadingLabel("Signing in");
    startTransition(async () => {
      const result = await loginRapsodoAction({ email, password });
      setLoadingLabel(null);

      if (!result.ok) {
        setNotice({ kind: "error", title: "R-Cloud login failed", message: result.message });
        return;
      }

      setPassword("");
      setStatus({
        connected: result.data.connected,
        expiresAt: null,
        profile: result.data.profile,
      });
      setNotice({
        kind: "success",
        title: "R-Cloud connected",
        message: "Token saved for this browser session.",
      });
      await loadSessions();
    });
  }

  function enableBrowserNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserNotificationState("unsupported");
      return;
    }

    void Notification.requestPermission().then((permission) => {
      setBrowserNotificationState(permission);
    });
  }

  function disconnect() {
    setLoadingLabel("Disconnecting");
    startTransition(async () => {
      await disconnectRapsodoAction();
      setStatus({ connected: false, expiresAt: null, profile: null });
      setSessions([]);
      setPreview(null);
      setLoadingLabel(null);
      setNotice({
        kind: "success",
        title: "R-Cloud disconnected",
        message: "Saved token cleared.",
      });
    });
  }

  function previewSession(session: RapsodoSessionListItem) {
    setNotice({ kind: "idle" });
    setSaveStatus(null);
    setSaveConfirmation(null);
    setLoadingLabel("Exporting CSV");
    startTransition(async () => {
      const result = await previewRapsodoSessionAction(session);
      setLoadingLabel(null);

      if (!result.ok) {
        setNotice({ kind: "error", title: "Preview failed", message: result.message });
        return;
      }

      setPreview(result.data);
      setMobileStep("preview");
      setCourseName(result.data.courseName || result.data.session.title);
      setScorecardText(
        result.data.courseScorecard.length > 0
          ? formatCourseScorecardText(result.data.courseScorecard)
          : "",
      );
      setHoleReview({});
      setCourseImportMode(result.data.courseScorecard.length > 0 ? "scored_round" : "shot_only");
      setClubSelectionMode("recommendations");
      setUpdateRapsodoClubs(false);
      setSelectedClubByRow(selectionByMode(result.data, "recommendations"));
      requestAnimationFrame(() => {
        previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      setSessions((current) =>
        current.map((currentSession) =>
          currentSession.providerKind === session.providerKind &&
          currentSession.providerSessionId === session.providerSessionId
            ? { ...currentSession, shotCount: result.data.shotCount }
            : currentSession,
        ),
      );
    });
  }

  function applyClubSelectionMode(mode: ClubSelectionMode) {
    if (!preview) {
      return;
    }

    setClubSelectionMode(mode);
    setSelectedClubByRow(selectionByMode(preview, mode));
  }

  function savePreview() {
    if (!preview || !canSave) {
      return;
    }

    setNotice({ kind: "idle" });
    setSaveStatus({
      kind: "saving",
      title: updateRapsodoClubs ? "Updating Rapsodo clubs" : "Saving confirmed shots",
      message: updateRapsodoClubs
        ? `Updating ${rapsodoWritebackRows.updatableCount} Rapsodo club match${rapsodoWritebackRows.updatableCount === 1 ? "" : "es"} first, then importing ${preview.shotCount} confirmed shot${preview.shotCount === 1 ? "" : "s"}. Keep this page open.`
        : `Importing ${preview.shotCount} confirmed shot${preview.shotCount === 1 ? "" : "s"} into LM World Tour. Keep this page open.`,
    });
    const shotOverrides = preview.shots.map((shot): RapsodoShotOverride => {
      const choice = choicesByKey.get(selectedClubByRow[shot.rowNumber]) ?? shot.suggestion.choice;
      return {
        rowNumber: shot.rowNumber,
        clubType: choice.clubType,
        clubBrand: choice.clubBrand,
        clubModel: choice.clubModel,
      };
    });

    const courseHoleScoringForImport =
      isCoursePreview && !courseShotOnlyImport ? courseHoleScoring : undefined;

    setLoadingLabel(updateRapsodoClubs ? "Updating Rapsodo clubs" : "Saving shots");
    startTransition(async () => {
      let writebackMessage = "";

      if (updateRapsodoClubs) {
        if (rapsodoWritebackRows.updatableCount === 0) {
          const errorStatus = {
            kind: "error" as const,
            title: "Rapsodo update unavailable",
            message:
              "R-Cloud did not expose enough shot and bag club IDs to update Rapsodo. Save with LM World Tour recommendations or update Rapsodo manually first.",
          };
          setLoadingLabel(null);
          setSaveStatus(errorStatus);
          showNotice(errorStatus, { scroll: true });
          return;
        }

        const writebackResult = await syncRapsodoShotClubsAction({
          session: preview.session,
          updates: rapsodoWritebackRows.updates,
        });

        if (!writebackResult.ok) {
          const errorStatus = {
            kind: "error" as const,
            title: "Rapsodo update failed",
            message: writebackResult.message,
          };
          setLoadingLabel(null);
          setSaveStatus(errorStatus);
          showNotice(errorStatus, { scroll: true });
          return;
        }

        writebackMessage =
          writebackResult.data.updated > 0
            ? ` Updated ${writebackResult.data.updated} club${writebackResult.data.updated === 1 ? "" : "s"} in Rapsodo first.`
            : " Rapsodo did not expose any updateable shot IDs, so only LM World Tour was saved.";
        setLoadingLabel("Saving shots");
        setSaveStatus({
          kind: "saving",
          title: "Saving confirmed shots",
          message: `Rapsodo club update finished. Saving ${preview.shotCount} confirmed shot${preview.shotCount === 1 ? "" : "s"} into LM World Tour now.`,
        });
      }

      const resolvedCourseName = (
        courseName.trim() ||
        preview.courseName ||
        preview.session.courseName ||
        preview.session.title
      ).trim();
      const result = await importRapsodoSessionAction({
        session: preview.session,
        importInput: {
          rawCsvText: preview.rawCsvText,
          fileName: preview.fileName,
          fileSizeBytes: preview.fileSizeBytes,
          source: "rapsodo",
          sessionType: preview.sessionType,
          sessionDate: preview.sessionDate,
          distanceUnit: preview.distanceUnit,
          courseName: isCoursePreview ? resolvedCourseName : undefined,
          courseScorecardText: isCoursePreview && !courseShotOnlyImport ? scorecardText : undefined,
          courseHoleShotCounts:
            isCoursePreview && !courseShotOnlyImport ? courseHoleShotCounts : undefined,
          courseHoleScoring: courseHoleScoringForImport,
          shotOverrides,
          notes: courseShotOnlyImport
            ? `Shot-only Rapsodo course import from ${resolvedCourseName}. Scorecard detail was not saved yet.`
            : undefined,
        },
      });
      setLoadingLabel(null);

      if (!result.ok) {
        const errorStatus = {
          kind: "error" as const,
          title: "Import failed",
          message: result.message,
        };
        setSaveStatus(errorStatus);
        showNotice(errorStatus, { scroll: true });
        return;
      }

      if (!result.data.ok) {
        const errorStatus = {
          kind: "error" as const,
          title: "Import failed",
          message: result.data.message,
        };
        setSaveStatus(errorStatus);
        showNotice(errorStatus, { scroll: true });
        return;
      }

      const importedSessionId = result.data.sessionId;
      notifyAchievementUnlocks(result.data.achievementUnlockNotifications);
      const saveNotice: Extract<Notice, { kind: "success" }> = {
        kind: "success",
        title: result.data.skipped ? "Already imported" : "Rapsodo session saved",
        message: result.data.skipped
          ? "This exported CSV already exists in LM World Tour."
          : `Saved ${result.data.shotCount} shot${result.data.shotCount === 1 ? "" : "s"}.${
              courseShotOnlyImport
                ? " Saved as a shot-linked course round without scorecard detail."
                : ""
            }${
              result.data.practicePlanMatch
                ? ` Practice plan matched: ${result.data.practicePlanMatch.title} (${result.data.practicePlanMatch.matchScore}% confidence) and scored ${result.data.practicePlanMatch.score.score}/100.`
                : ""
            }${writebackMessage}`,
        sessionId: result.data.sessionId,
      };
      setSaveStatus({
        kind: "success",
        title: saveNotice.title,
        message: saveNotice.message,
        sessionId: result.data.sessionId,
      });
      showNotice(saveNotice, { scroll: true });
      setSaveConfirmation({
        id: `${Date.now()}-${result.data.sessionId}`,
        title: saveNotice.title,
        message: saveNotice.message,
        sessionId: result.data.sessionId,
      });
      setMobileStep("review");
      setSessions((current) =>
        current.map((session) =>
          session.providerKind === preview.session.providerKind &&
          session.providerSessionId === preview.session.providerSessionId
            ? {
                ...session,
                importedSessionId,
                lastImportedAt: new Date().toISOString(),
                exportRawCsvHash: preview.rawCsvHash,
              }
            : session,
        ),
      );
      router.refresh();
    });
  }

  return (
    <main
      id="main-content"
      className={cn(
        "min-h-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8",
        showStickyReviewBar
          ? "pb-[calc(7.75rem+env(safe-area-inset-bottom))] sm:pb-6"
          : "pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:pb-6",
      )}
    >
      <div className="mx-auto flex w-full max-w-none flex-col gap-5 sm:gap-6">
        <MobileRouteHeader title="Analyse" group="analyse" activeKey="rapsodo" />

        <DesktopWorkflowLayout
          steps={rapsodoWorkflowSteps}
          helpTitle="Rapsodo sync help"
          helpDescription="Keep provider imports deterministic"
          helpItems={rapsodoWorkflowHelpItems}
        >
          <div className="hidden items-center justify-between gap-4 sm:flex">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/import">
                <Upload className="size-4" />
                Manual CSV
              </Link>
            </Button>
          </div>

          <RapsodoInboxPrimaryCard
            session={latestUnimportedSession}
            connected={status.connected}
            availableCount={availableSessions.length}
            newSessionCount={newSessionCount}
            isPending={isPending}
            loadingLabel={loadingLabel}
            onConnect={() => setMobileStep("connect")}
            onLoadSessions={() => void loadSessions()}
            onPreviewSession={previewSession}
          />

          <header className="premium-hero hidden p-5 sm:block sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-2">
                <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  Experimental R-Cloud connector
                </Badge>
                <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
                  Rapsodo cloud sync
                </h1>
                <p className="text-base leading-7 text-muted-foreground">
                  Pull R-Cloud CSV exports, review club matches, and save confirmed shots into LM
                  World Tour.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[640px]">
                <StatusTile
                  label="Connection"
                  value={status.connected ? "Connected" : "Signed out"}
                />
                <StatusTile label="Available" value={availableSessions.length.toString()} />
                <StatusTile label="New" value={newSessionCount.toString()} />
                <StatusTile label="Preview" value={preview ? preview.shotCount.toString() : "--"} />
              </div>
            </div>
          </header>

          {!status.connected ? (
            <section className="premium-command-surface hidden rounded-2xl p-5 sm:grid sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-center">
              <div className="space-y-2">
                <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  Why connect
                </Badge>
                <h2 className="text-2xl font-semibold tracking-normal text-foreground">
                  Connect Rapsodo to unlock your bag and coach
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  Pull latest sessions, confirm clubs, update bag trust and unlock coach
                  recommendations from the same reviewed launch-monitor data.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: "Pull latest sessions",
                    detail: "Find waiting R-Cloud exports.",
                    icon: CloudUpload,
                  },
                  {
                    title: "Confirm clubs",
                    detail: "Map Rapsodo labels before save.",
                    icon: ShieldCheck,
                  },
                  {
                    title: "Update bag + coach",
                    detail: "Refresh trust and drill signals.",
                    icon: Sparkles,
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border bg-white/80 p-3">
                    <item.icon className="size-5 text-emerald-700" />
                    <p className="mt-3 text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {showMobileReviewChrome ? (
            <RapsodoMobileStepper
              steps={mobileSteps}
              step={visibleMobileStep}
              onStepChange={setMobileStep}
            />
          ) : null}

          {showMobileReviewChrome ? (
            <MobileBentoSummary
              items={[
                {
                  label: "Connection",
                  value: status.connected ? "On" : "Off",
                  detail: "R-Cloud",
                  tone: status.connected ? "green" : "slate",
                },
                {
                  label: "Available",
                  value: availableSessions.length.toString(),
                  detail: "Sessions",
                  tone: "sky",
                },
                {
                  label: "New",
                  value: newSessionCount.toString(),
                  detail: "Since last sync",
                  tone: newSessionCount > 0 ? "amber" : "slate",
                },
                {
                  label: "Preview",
                  value: preview ? preview.shotCount.toString() : "--",
                  detail: "Shots",
                  tone: "pink",
                },
              ]}
            />
          ) : null}

          {status.connected ? (
            <MobileAccordionSection
              title="Filters"
              description="Date range and session type."
              count={sessionFilter === "all" ? "All" : sessionFilter}
            >
              <div className="grid gap-2">
                <select
                  aria-label="Remote session type"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={sessionFilter}
                  onChange={(event) => setSessionFilter(event.target.value as typeof sessionFilter)}
                >
                  <option value="all">All</option>
                  <option value="range">Range</option>
                  <option value="course">Course</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    aria-label="Session start date"
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(event) =>
                      setDateFilter((current) => ({ ...current, startDate: event.target.value }))
                    }
                  />
                  <Input
                    aria-label="Session end date"
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(event) =>
                      setDateFilter((current) => ({ ...current, endDate: event.target.value }))
                    }
                  />
                </div>
              </div>
            </MobileAccordionSection>
          ) : null}

          {notice.kind !== "idle" ? (
            <div ref={noticeRef} className="scroll-mt-4">
              <Alert variant={notice.kind === "error" ? "destructive" : "default"}>
                {notice.kind === "error" ? (
                  <AlertCircle className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                <AlertTitle>{notice.title}</AlertTitle>
                <AlertDescription>
                  <span>{notice.message}</span>
                  {notice.kind === "error" ? (
                    <Button asChild variant="outline" size="sm" className="mt-3 flex w-fit">
                      <Link href="/import">
                        <ExternalLink className="size-4" />
                        Use manual import
                      </Link>
                    </Button>
                  ) : notice.sessionId ? (
                    <Button asChild variant="outline" size="sm" className="mt-3 flex w-fit">
                      <Link href={`/shots?sessionId=${encodeURIComponent(notice.sessionId)}`}>
                        <Database className="size-4" />
                        View shots
                      </Link>
                    </Button>
                  ) : null}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <section
            id="rapsodo-sessions"
            className="grid scroll-mt-28 gap-4 lg:grid-cols-[0.9fr_1.1fr]"
          >
            <Card
              className={cn("premium-card", showMobileConnectionCard ? "flex" : "hidden sm:flex")}
            >
              <CardHeader>
                <CardTitle>Connection</CardTitle>
                <CardDescription>
                  We do not store your Rapsodo password. It is exchanged for a short-lived encrypted
                  token. You can disconnect at any time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status.connected ? (
                  <div className="space-y-4">
                    <div className="trust-indicator rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <ShieldCheck className="size-4" />
                        Token saved
                      </div>
                      <p className="mt-1 text-emerald-800">
                        {status.expiresAt
                          ? `Expires ${formatDateTime(status.expiresAt)}.`
                          : "Expires automatically."}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        onClick={() => void loadSessions()}
                        disabled={isPending}
                      >
                        {loadingLabel === "Loading sessions" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                        Load sessions
                      </Button>
                      {browserNotificationState !== "granted" ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={enableBrowserNotifications}
                          disabled={browserNotificationState === "unsupported"}
                        >
                          <Bell className="size-4" />
                          Notifications
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={disconnect}
                        disabled={isPending}
                      >
                        <LogOut className="size-4" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      login();
                    }}
                  >
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="Rapsodo email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Rapsodo password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <Button type="submit" className="premium-action w-full" disabled={isPending}>
                      {loadingLabel === "Signing in" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Cloud className="size-4" />
                      )}
                      Sign in to R-Cloud
                    </Button>
                  </form>
                )}

                <div className="hidden gap-2 sm:grid sm:grid-cols-2">
                  <Input
                    aria-label="Session start date"
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(event) =>
                      setDateFilter((current) => ({ ...current, startDate: event.target.value }))
                    }
                  />
                  <Input
                    aria-label="Session end date"
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(event) =>
                      setDateFilter((current) => ({ ...current, endDate: event.target.value }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn("premium-card", showMobileSessionsCard ? "flex" : "hidden sm:flex")}
            >
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Remote sessions</CardTitle>
                    <CardDescription>
                      Choose a session, export its CSV, then review before saving. Imported sessions
                      are hidden from this inbox.
                    </CardDescription>
                  </div>
                  <select
                    aria-label="Remote session type"
                    className="hidden h-9 rounded-md border bg-background px-3 text-sm sm:block"
                    value={sessionFilter}
                    onChange={(event) =>
                      setSessionFilter(event.target.value as typeof sessionFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="range">Range</option>
                    <option value="course">Course</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                <MobileDataList className="sm:hidden">
                  {filteredSessions.length > 0 ? (
                    filteredSessions.map((session) => (
                      <MobileDataCard
                        key={`${session.providerKind}-${session.providerSessionId}`}
                        title={session.title}
                        subtitle={session.dateIso ? formatDate(session.dateIso) : "No date"}
                        action={
                          session.isNew && !session.importedSessionId ? (
                            <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">New</Badge>
                          ) : null
                        }
                      >
                        <DataPair label="Type" value={formatSessionKind(session)} />
                        <DataPair
                          label="Shots"
                          value={session.shotCount === null ? "--" : session.shotCount}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => previewSession(session)}
                          disabled={isPending}
                        >
                          Preview
                        </Button>
                      </MobileDataCard>
                    ))
                  ) : (
                    <div className="apple-panel p-6 text-center text-sm text-muted-foreground">
                      {status.connected
                        ? "No unimported R-Cloud sessions found for these dates. Imported sessions are hidden here."
                        : "Sign in to load sessions."}
                    </div>
                  )}
                </MobileDataList>
                <DesktopTableWorkbenchControls
                  viewKey="rapsodo-sessions"
                  scope="rapsodo"
                  currentViewLabel={`R-Cloud ${sessionFilter === "all" ? "sessions" : `${sessionFilter} sessions`}`}
                  resultLabel={`${filteredSessions.length} sessions`}
                  columns={rapsodoSessionColumns}
                  suggestedViews={rapsodoSessionSuggestedViews}
                  exportTableId="rapsodo-sessions"
                  exportFileName="forekinghell-rapsodo-sessions.csv"
                  className="mb-3"
                />
                <div className="hidden overflow-hidden rounded-lg border sm:block">
                  <Table
                    data-main-table-target="true"
                    data-workbench-export-table="rapsodo-sessions"
                    aria-label="Rapsodo remote sessions table"
                    aria-describedby="rapsodo-sessions-summary"
                    tabIndex={-1}
                  >
                    <TableCaption id="rapsodo-sessions-summary" className="sr-only">
                      Unimported Rapsodo cloud sessions with type, date, shot count and preview
                      action.
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-column="session">Session</TableHead>
                        <TableHead data-column="type">Type</TableHead>
                        <TableHead data-column="date">Date</TableHead>
                        <TableHead data-column="shots" className="text-right">
                          Shots
                        </TableHead>
                        <TableHead data-column="action" className="w-28">
                          <span className="sr-only">Action</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((session) => (
                        <TableRow key={`${session.providerKind}-${session.providerSessionId}`}>
                          <TableCell data-column="session">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{session.title}</span>
                              {session.isNew && !session.importedSessionId ? (
                                <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">
                                  New
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              {session.importedSessionId ? (
                                <Link
                                  href={`/shots?sessionId=${encodeURIComponent(session.importedSessionId)}`}
                                  className="text-emerald-700 underline-offset-4 hover:underline"
                                >
                                  Imported
                                </Link>
                              ) : null}
                              {session.firstSeenAt ? (
                                <span className="text-muted-foreground">
                                  Seen {formatDate(session.firstSeenAt)}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell data-column="type">{formatSessionKind(session)}</TableCell>
                          <TableCell data-column="date">
                            {session.dateIso ? formatDate(session.dateIso) : "--"}
                          </TableCell>
                          <TableCell data-column="shots" className="text-right">
                            {session.shotCount === null ? "--" : session.shotCount}
                          </TableCell>
                          <TableCell data-column="action">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => previewSession(session)}
                              disabled={isPending}
                            >
                              Preview
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSessions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            {status.connected
                              ? "No unimported R-Cloud sessions found for these dates. Imported sessions are hidden here."
                              : "Sign in to load sessions."}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>

          <MobileAccordionSection
            title="Provider health"
            description="Connection and latest sync status."
            count={status.connected ? "Connected" : "Signed out"}
          >
            <section className="premium-command-surface grid gap-2 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">Provider import health</span>
                <Badge
                  className={cn(
                    status.connected
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {status.connected ? "Connected" : "Signed out"}
                </Badge>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {status.connected
                  ? `${availableSessions.length} sessions available · ${newSessionCount} new since last sync.`
                  : "Sign in or use manual CSV import when R-Cloud is unavailable."}
              </p>
            </section>
          </MobileAccordionSection>

          {preview ? (
            <section
              id="rapsodo-preview"
              ref={previewSectionRef}
              className={cn(
                "space-y-4 scroll-mt-4",
                ["preview", "clubs", "course", "import", "review"].includes(visibleMobileStep)
                  ? "block"
                  : "hidden sm:block",
              )}
            >
              <Card className="premium-card">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{preview.session.title}</CardTitle>
                      <CardDescription>
                        {preview.shotCount} shots, {preview.rawRowCount} raw rows,{" "}
                        {preview.distanceUnit}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      onClick={savePreview}
                      disabled={!canSave}
                      className="premium-action"
                    >
                      {isSavingPreview ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : previewAlreadyImported ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      {saveButtonLabel}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {visibleSaveStatus ? <SaveStatusPanel status={visibleSaveStatus} /> : null}
                  <div
                    className={cn(
                      "premium-command-surface grid gap-2 rounded-lg p-3 lg:grid-cols-[auto_auto_minmax(220px,1fr)]",
                      visibleMobileStep === "clubs" ? "grid" : "hidden sm:grid",
                    )}
                  >
                    <Button
                      type="button"
                      variant={clubSelectionMode === "recommendations" ? "default" : "outline"}
                      className={clubSelectionMode === "recommendations" ? "premium-action" : ""}
                      onClick={() => applyClubSelectionMode("recommendations")}
                      disabled={isPending}
                    >
                      <Sparkles className="size-4" />
                      Use recommendations
                    </Button>
                    <Button
                      type="button"
                      variant={clubSelectionMode === "rapsodo" ? "default" : "outline"}
                      className={clubSelectionMode === "rapsodo" ? "premium-action" : ""}
                      onClick={() => applyClubSelectionMode("rapsodo")}
                      disabled={isPending}
                    >
                      <ShieldCheck className="size-4" />
                      Use Rapsodo clubs
                    </Button>
                    <label
                      className={`flex min-h-10 items-center gap-3 rounded-md border bg-white/75 px-3 py-2 text-sm ${
                        rapsodoWritebackRows.updatableCount === 0 ? "opacity-60" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={updateRapsodoClubs}
                        disabled={rapsodoWritebackRows.updatableCount === 0 || isPending}
                        onChange={(event) => setUpdateRapsodoClubs(event.target.checked)}
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium leading-tight">
                          <CloudUpload className="size-4" />
                          Update Rapsodo first
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {rapsodoWritebackRows.updatableCount}/{preview.shotCount} shots can be
                          matched back to R-Cloud.
                        </span>
                      </span>
                    </label>
                  </div>
                  <div
                    className={cn(
                      "grid gap-2 sm:grid-cols-4",
                      visibleMobileStep === "preview" ||
                        visibleMobileStep === "import" ||
                        visibleMobileStep === "review"
                        ? "grid"
                        : "hidden sm:grid",
                    )}
                  >
                    <CompactSummaryTile
                      label="Type"
                      value={
                        courseShotOnlyImport ? "Shot-only" : formatPreviewType(preview.sessionType)
                      }
                    />
                    <CompactSummaryTile label="Date" value={formatDate(preview.sessionDate)} />
                    <CompactSummaryTile
                      label="Clubs"
                      value={`${confirmedClubCount(preview, selectedClubByRow)}/${preview.shotCount}`}
                    />
                    <CompactSummaryTile label="Duplicate" value={preview.rawCsvHash.slice(0, 12)} />
                  </div>
                  {visibleMobileStep === "review" ? (
                    <div className="premium-command-surface grid gap-3 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">Review trust</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Confirmed clubs, duplicate hash, warnings and save status decide whether
                            this session is trusted for bag numbers, coach scoring and challenge
                            proof.
                          </p>
                        </div>
                        <Badge
                          variant={visibleSaveStatus?.kind === "success" ? "default" : "secondary"}
                        >
                          {visibleSaveStatus?.kind === "success" ? "Trusted" : "Reviewing"}
                        </Badge>
                      </div>
                      <div className="grid gap-2 text-sm">
                        <DataPair
                          label="Club mapping"
                          value={`${confirmedClubCount(preview, selectedClubByRow)}/${preview.shotCount} confirmed`}
                        />
                        <DataPair
                          label="Warnings"
                          value={
                            preview.warnings.length === 0 ? "None" : `${preview.warnings.length}`
                          }
                        />
                        <DataPair
                          label="Save status"
                          value={visibleSaveStatus?.title ?? "Not imported yet"}
                        />
                      </div>
                    </div>
                  ) : null}
                  {preview.warnings.length > 0 ? (
                    <Alert>
                      <AlertCircle className="size-4" />
                      <AlertTitle>CSV warnings</AlertTitle>
                      <AlertDescription>{preview.warnings.join(" ")}</AlertDescription>
                    </Alert>
                  ) : null}
                  <MobileAccordionSection
                    title="Review shots"
                    description="Raw row audit and club confirmation."
                    count={preview.shots.length}
                  >
                    <div className="grid gap-2">
                      {preview.shots.slice(0, 8).map((shot) => (
                        <MobileDataCard
                          key={shot.rowNumber}
                          title={`Shot ${shot.shotNumber ?? shot.rowNumber}`}
                          subtitle={shot.reportedClubLabel}
                          action={
                            <Badge
                              variant={
                                shot.suggestion.confidence === "low" ? "secondary" : "default"
                              }
                            >
                              {shot.suggestion.confidenceScore}%
                            </Badge>
                          }
                        >
                          <DataPair label="Carry" value={formatMetric(shot.carryYd)} />
                          <DataPair label="Total" value={formatMetric(shot.totalYd)} />
                          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                            Confirmed club
                            <select
                              aria-label={`Confirmed club for shot ${
                                shot.shotNumber ?? shot.rowNumber
                              }`}
                              className="h-10 rounded-md border bg-background px-2 text-sm text-foreground"
                              value={selectedClubByRow[shot.rowNumber] ?? ""}
                              onChange={(event) => {
                                setClubSelectionMode("custom");
                                setSelectedClubByRow((current) => ({
                                  ...current,
                                  [shot.rowNumber]: event.target.value,
                                }));
                              }}
                            >
                              <option value="">Choose club</option>
                              {preview.clubChoices.map((choice) => (
                                <option
                                  key={`${shot.rowNumber}-${choice.clubKey}`}
                                  value={choice.clubKey}
                                >
                                  {choice.clubLabel}
                                </option>
                              ))}
                            </select>
                          </label>
                        </MobileDataCard>
                      ))}
                    </div>
                  </MobileAccordionSection>
                  <div className="hidden rounded-lg border sm:block">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-8 w-14 px-3">Shot</TableHead>
                          <TableHead className="h-8 w-24 px-2">Rapsodo</TableHead>
                          <TableHead className="h-8 w-64 px-2">Confirmed club</TableHead>
                          <TableHead className="h-8 w-20 px-2 text-right">Carry</TableHead>
                          <TableHead className="h-8 w-20 px-2 text-right">Total</TableHead>
                          <TableHead className="h-8 px-2">Match</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.shots.map((shot) => (
                          <TableRow key={shot.rowNumber}>
                            <TableCell className="px-3 py-1.5">
                              {shot.shotNumber ?? shot.rowNumber}
                            </TableCell>
                            <TableCell className="px-2 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <span>{shot.reportedClubLabel}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-1.5">
                              <select
                                aria-label={`Confirmed club for shot ${
                                  shot.shotNumber ?? shot.rowNumber
                                }`}
                                className="h-8 w-56 rounded-md border bg-background px-2 text-xs"
                                value={selectedClubByRow[shot.rowNumber] ?? ""}
                                onChange={(event) => {
                                  setClubSelectionMode("custom");
                                  setSelectedClubByRow((current) => ({
                                    ...current,
                                    [shot.rowNumber]: event.target.value,
                                  }));
                                }}
                              >
                                <option value="">Choose club</option>
                                {preview.clubChoices.map((choice) => (
                                  <option
                                    key={`${shot.rowNumber}-${choice.clubKey}`}
                                    value={choice.clubKey}
                                  >
                                    {choice.clubLabel}
                                    {choice.clubBrand || choice.clubModel
                                      ? ` - ${[choice.clubBrand, choice.clubModel].filter(Boolean).join(" ")}`
                                      : ""}
                                    {choice.active === false ? " (retired)" : ""}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-right">
                              {formatMetric(shot.carryYd)}
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-right">
                              {formatMetric(shot.totalYd)}
                            </TableCell>
                            <TableCell className="min-w-[360px] px-2 py-1.5">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge
                                  variant={
                                    shot.suggestion.confidence === "low" ? "secondary" : "default"
                                  }
                                  className="shrink-0"
                                >
                                  {shot.suggestion.confidenceScore}%
                                </Badge>
                                <span className="truncate">{shot.suggestion.reason}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {isCoursePreview ? (
                <Card
                  className={cn(
                    "premium-card",
                    visibleMobileStep === "course" ? "flex" : "hidden sm:flex",
                  )}
                >
                  <CardHeader>
                    <CardTitle>Course import</CardTitle>
                    <CardDescription>
                      Save club data only, or add scorecard detail when it should become a round.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant={courseImportMode === "shot_only" ? "default" : "outline"}
                        className={courseImportMode === "shot_only" ? "premium-action" : ""}
                        onClick={() => setCourseImportMode("shot_only")}
                        disabled={isPending}
                      >
                        <Database className="size-4" />
                        Shot data only
                      </Button>
                      <Button
                        type="button"
                        variant={courseImportMode === "scored_round" ? "default" : "outline"}
                        className={courseImportMode === "scored_round" ? "premium-action" : ""}
                        onClick={() => setCourseImportMode("scored_round")}
                        disabled={isPending}
                      >
                        <ShieldCheck className="size-4" />
                        Scored round
                      </Button>
                    </div>
                    {courseImportMode === "shot_only" ? (
                      <div className="premium-command-surface rounded-lg p-3 text-sm text-muted-foreground">
                        These shots will save as a shot-linked course round without scorecard
                        detail.
                      </div>
                    ) : (
                      <>
                        <div
                          className={cn(
                            "grid gap-3",
                            usingSavedCourseScorecard ? "" : "lg:grid-cols-[0.8fr_1.2fr]",
                          )}
                        >
                          <Input
                            value={courseName}
                            placeholder="Course name"
                            onChange={(event) => setCourseName(event.target.value)}
                          />
                          {usingSavedCourseScorecard ? (
                            <div className="premium-command-surface rounded-lg px-3 py-2 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-medium">
                                  {scorecard.holes.length} saved holes
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  par {scorecardTotalPar}, {scorecardTotalYards} yards
                                </span>
                              </div>
                            </div>
                          ) : (
                            <textarea
                              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                              placeholder="Hole, par, yards"
                              value={scorecardText}
                              onChange={(event) => setScorecardText(event.target.value)}
                            />
                          )}
                        </div>
                        <div className="premium-command-surface rounded-lg p-3 text-sm">
                          {scorecard.holes.length === 0 ? (
                            <p className="text-muted-foreground">
                              Add scorecard rows before saving this course session.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              <p>
                                {assignedCourseShots}/{preview.shotCount} shots assigned across{" "}
                                {scorecard.holes.length} holes.
                              </p>
                              {scoredRoundNeedsScores ? (
                                <>
                                  <p className="text-xs text-muted-foreground">
                                    {courseScoringSummary.scoreCount}/
                                    {courseScoringSummary.holeCount} scores · derived{" "}
                                    {courseScoringSummary.puttCount}/
                                    {courseScoringSummary.holeCount} putts
                                    {courseScoringSummary.isComplete &&
                                    courseScoringSummary.totalScore !== null &&
                                    courseScoringSummary.totalPutts !== null
                                      ? ` · total ${courseScoringSummary.totalScore}, ${courseScoringSummary.totalPutts} putts`
                                      : ""}
                                  </p>
                                  {!courseScoringSummary.isComplete ? (
                                    <p className="text-xs font-medium text-amber-700">
                                      Enter a score for every hole before saving as a scored round.
                                    </p>
                                  ) : null}
                                </>
                              ) : null}
                            </div>
                          )}
                          {scorecard.warnings.length > 0 ? (
                            <p className="mt-2 text-amber-700">{scorecard.warnings.join(" ")}</p>
                          ) : null}
                        </div>
                      </>
                    )}
                    {courseImportMode === "scored_round" && scorecard.holes.length > 0 ? (
                      <CourseScorecardSvg
                        courseName={courseName.trim() || preview.courseName || "Course scorecard"}
                        editable
                        holes={courseScorecardSvgHoles}
                        onPenaltiesChange={(holeNumber, value) =>
                          updateHoleReview(holeNumber, { penalties: value })
                        }
                        onScoreChange={(holeNumber, value) =>
                          updateHoleReview(holeNumber, { score: value })
                        }
                        onShotCountChange={(holeNumber, value) =>
                          updateHoleReview(holeNumber, { shotCount: value })
                        }
                        playerName="ForeKingHell"
                        showPenalties
                        showShotCounts
                        subtitle={
                          usingSavedCourseScorecard
                            ? "Saved course card · enter scores"
                            : "Manual card · enter scores"
                        }
                      />
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </section>
          ) : null}

          {showStickyReviewBar ? (
            <StickyMobileAction>
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={activeMobileStepIndex <= 0}
                  onClick={() =>
                    setMobileStep(mobileSteps[Math.max(0, activeMobileStepIndex - 1)].id)
                  }
                >
                  Back
                </Button>
                {visibleMobileStep === "review" ? (
                  <Button asChild className="premium-action rounded-lg">
                    <Link
                      href={
                        visibleSaveStatus?.kind === "success" && visibleSaveStatus.sessionId
                          ? `/shots?sessionId=${encodeURIComponent(visibleSaveStatus.sessionId)}`
                          : "/shots"
                      }
                    >
                      View trusted shots
                    </Link>
                  </Button>
                ) : visibleMobileStep === "import" ? (
                  <Button
                    type="button"
                    disabled={!canSave}
                    onClick={savePreview}
                    className="premium-action rounded-lg"
                  >
                    {isSavingPreview ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : previewAlreadyImported ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {saveButtonLabel}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="premium-action rounded-lg"
                    onClick={() =>
                      setMobileStep(
                        mobileSteps[Math.min(mobileSteps.length - 1, activeMobileStepIndex + 1)].id,
                      )
                    }
                  >
                    Next
                  </Button>
                )}
              </div>
            </StickyMobileAction>
          ) : null}
          {saveConfirmation ? (
            <SaveConfirmationToast
              confirmation={saveConfirmation}
              onDismiss={() => setSaveConfirmation(null)}
            />
          ) : null}
          {children}
        </DesktopWorkflowLayout>
      </div>
    </main>
  );

  function updateHoleReview(holeNumber: number, patch: HoleReviewState[number]) {
    setHoleReview((current) => ({
      ...current,
      [holeNumber]: {
        ...current[holeNumber],
        ...patch,
      },
    }));
  }

  function showNotice(nextNotice: Notice, options: { scroll?: boolean } = {}) {
    setNotice(nextNotice);

    if (options.scroll) {
      requestAnimationFrame(() => {
        noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }
}

function SaveStatusPanel({ status }: { status: SaveStatus }) {
  return (
    <div
      role={status.kind === "error" ? "alert" : "status"}
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "grid gap-3 rounded-lg border px-3 py-3 text-sm sm:grid-cols-[auto_1fr_auto] sm:items-center",
        status.kind === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : status.kind === "success"
            ? "border-emerald-300 bg-emerald-50/70 text-emerald-950"
            : "border-amber-300 bg-amber-50/70 text-amber-950",
      )}
    >
      <div
        className={cn(
          "grid size-9 place-items-center rounded-[8px]",
          status.kind === "error"
            ? "bg-destructive/10"
            : status.kind === "success"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700",
        )}
      >
        {status.kind === "saving" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : status.kind === "error" ? (
          <AlertCircle className="size-4" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-semibold">{status.title}</p>
        <p
          className={cn(
            "mt-0.5 text-xs leading-5",
            status.kind === "error" ? "text-destructive/90" : "text-muted-foreground",
          )}
        >
          {status.message}
        </p>
      </div>
      {status.kind === "success" && status.sessionId ? (
        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
          <Link href={`/shots?sessionId=${encodeURIComponent(status.sessionId)}`}>
            <Database className="size-4" />
            View saved shots
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function SaveConfirmationToast({
  confirmation,
  onDismiss,
}: {
  confirmation: SaveConfirmation;
  onDismiss: () => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed inset-x-3 top-[calc(5rem+env(safe-area-inset-top))] z-[70] mx-auto max-w-md sm:inset-x-auto sm:right-4 sm:top-24"
    >
      <div className="overflow-hidden rounded-[8px] border border-emerald-300 bg-[#0f172a] text-white shadow-2xl">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-emerald-400/15 text-emerald-300">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{confirmation.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-300">{confirmation.message}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={onDismiss}
            aria-label="Dismiss save confirmation"
          >
            <X className="size-4" />
          </Button>
        </div>
        {confirmation.sessionId ? (
          <div className="grid gap-2 border-t border-white/10 px-4 py-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href={`/shots?sessionId=${encodeURIComponent(confirmation.sessionId)}`}>
                <Database className="size-4" />
                View saved shots
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/course-records">
                  <Trophy className="size-4" />
                  Boards
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/tournaments">
                  <ShieldCheck className="size-4" />
                  Events
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RapsodoInboxPrimaryCard({
  session,
  connected,
  availableCount,
  newSessionCount,
  isPending,
  loadingLabel,
  onConnect,
  onLoadSessions,
  onPreviewSession,
}: {
  session: RapsodoSessionListItem | null;
  connected: boolean;
  availableCount: number;
  newSessionCount: number;
  isPending: boolean;
  loadingLabel: string | null;
  onConnect: () => void;
  onLoadSessions: () => void;
  onPreviewSession: (session: RapsodoSessionListItem) => void;
}) {
  const sessionCountCopy =
    availableCount === 1 ? "1 session ready" : `${availableCount} sessions ready`;
  const latestCopy = session
    ? `Latest: ${session.title} · ${
        session.shotCount === null ? "shots pending preview" : `${session.shotCount} shots`
      }`
    : connected
      ? "No unimported sessions waiting"
      : "Connect R-Cloud to open the inbox";

  return (
    <section className="premium-hero grid gap-3 p-3 sm:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge className="w-fit bg-primary/10 text-primary hover:bg-primary/10">Inbox</Badge>
          <h1 className="mt-2 text-xl font-semibold leading-tight tracking-normal text-balance">
            Rapsodo Inbox
          </h1>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Review sessions from R-Cloud.
          </p>
        </div>
        <div className="premium-command-surface min-w-20 rounded-lg px-2.5 py-2 text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Available
          </p>
          <p className="mt-0.5 text-xl font-semibold tracking-normal">{availableCount}</p>
          <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
            {connected ? `${newSessionCount} new` : "Signed out"}
          </p>
        </div>
      </div>

      <div className="premium-command-surface grid gap-3 rounded-lg p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">Newest unimported session</p>
            <h2 className="mt-1 line-clamp-2 text-2xl font-semibold leading-tight tracking-normal">
              {session ? session.title : connected ? "No sessions waiting" : "Connect R-Cloud"}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
              {session
                ? `${session.dateIso ? formatDate(session.dateIso) : "No date"} · ${formatSessionKind(
                    session,
                  )} · ${
                    session.shotCount === null
                      ? "shots pending preview"
                      : `${session.shotCount} shots`
                  }`
                : connected
                  ? "Load Rapsodo after practice to pull the newest unimported session into this inbox."
                  : "Sign in once, then the newest practice session can be reviewed and imported here."}
            </p>
          </div>
          {session?.isNew ? (
            <Badge className="shrink-0 bg-sky-100 text-sky-700 hover:bg-sky-100">New</Badge>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-white/70 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {sessionCountCopy}
          </p>
          <p className="mt-1 line-clamp-1 text-sm font-semibold">{latestCopy}</p>
        </div>
        <Button
          type="button"
          className="premium-action w-full rounded-lg"
          disabled={isPending}
          onClick={
            session ? () => onPreviewSession(session) : connected ? onLoadSessions : onConnect
          }
        >
          {loadingLabel === "Loading sessions" || loadingLabel === "Exporting CSV" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : session ? (
            <Sparkles className="size-4" />
          ) : connected ? (
            <RefreshCw className="size-4" />
          ) : (
            <Cloud className="size-4" />
          )}
          {session ? "Review latest" : connected ? "Load sessions" : "Connect R-Cloud"}
        </Button>
      </div>
    </section>
  );
}

function RapsodoMobileStepper({
  steps,
  step,
  onStepChange,
}: {
  steps: Array<{ id: RapsodoMobileStep; label: string }>;
  step: RapsodoMobileStep;
  onStepChange: (step: RapsodoMobileStep) => void;
}) {
  return (
    <nav
      aria-label="Rapsodo steps"
      tabIndex={0}
      className="sticky top-[4.75rem] z-30 -mx-1 flex gap-2 overflow-x-auto px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:hidden"
    >
      {steps.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onStepChange(item.id)}
          className={cn(
            "focus-aaa min-h-11 shrink-0 rounded-full border px-3 py-2 text-sm font-medium shadow-sm outline-none",
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

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="luxury-metric-card rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function CompactSummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="premium-command-surface flex min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-semibold">{value}</span>
    </div>
  );
}

function previewShotsForCourse(preview: RapsodoSessionPreview): InferredCourseShot["sourceShot"][] {
  return preview.shots.map((shot) => ({
    rowNumber: shot.rowNumber,
    shotNumber: shot.shotNumber,
    clubTypeRaw: shot.reportedClubLabel,
    clubType: shot.reportedClubType,
    clubLabel: shot.reportedClubLabel,
    clubBrand: null,
    clubModel: null,
    clubKey: shot.suggestion.choice.clubKey,
    carryYd: shot.carryYd,
    totalYd: shot.totalYd,
    ballSpeedMph: shot.ballSpeedMph,
    clubSpeedMph: null,
    launchAngleDeg: shot.launchAngleDeg,
    launchDirectionDeg: null,
    apexFt: null,
    sideCarryYd: shot.sideCarryYd,
    attackAngleDeg: null,
    clubPathDeg: null,
    faceAngleDeg: null,
    descentAngleDeg: null,
    smashFactor: null,
    spinRate: null,
    spinAxis: null,
    shotShape: null,
    shotCategory: "full",
    qualityTag: null,
    clubDataEstType: null,
    sourceRawJson: {},
    warnings: [],
  }));
}

function isCourseSession(session: RapsodoSessionListItem) {
  return [session.providerSessionMode, session.providerSessionType, session.title]
    .join(" ")
    .toLowerCase()
    .includes("course");
}

function isSameRapsodoSession(
  left: Pick<RapsodoSessionListItem, "providerKind" | "providerSessionId">,
  right: Pick<RapsodoSessionListItem, "providerKind" | "providerSessionId">,
) {
  return (
    left.providerKind === right.providerKind && left.providerSessionId === right.providerSessionId
  );
}

function buildRapsodoWorkflowSteps({
  availableCount,
  canSave,
  connected,
  courseReady,
  everyShotHasClub,
  previewShotCount,
  saveStatus,
  totalSessions,
}: {
  availableCount: number;
  canSave: boolean;
  connected: boolean;
  courseReady: boolean;
  everyShotHasClub: boolean;
  previewShotCount: number | null;
  saveStatus: SaveStatus["kind"] | null;
  totalSessions: number;
}): DesktopWorkflowStep[] {
  const hasPreview = previewShotCount !== null;
  const saveComplete = saveStatus === "success";
  const hasSessions = totalSessions > 0 || availableCount > 0;

  return [
    {
      title: "Connect R-Cloud",
      detail: "Exchange Rapsodo credentials for a short-lived token before loading sessions.",
      status: connected ? "complete" : "current",
      value: connected ? "Connected" : "Sign in",
    },
    {
      title: "Load sessions",
      detail: "Pull unimported R-Cloud sessions and hide anything already linked.",
      status: hasSessions ? "complete" : connected ? "current" : "upcoming",
      value: hasSessions ? `${availableCount} available` : undefined,
    },
    {
      title: "Preview shots",
      detail: "Open the selected export and check shot count, session type and date.",
      status: hasPreview ? "complete" : hasSessions ? "current" : "upcoming",
      value: hasPreview ? `${previewShotCount} shots` : undefined,
    },
    {
      title: "Map clubs",
      detail: "Choose Rapsodo labels, LM World Tour recommendations or custom club matches.",
      status: everyShotHasClub && hasPreview ? "complete" : hasPreview ? "current" : "upcoming",
      value: everyShotHasClub && hasPreview ? "Mapped" : undefined,
    },
    {
      title: "Save import",
      detail: "Save only when club mapping and course context are deterministic.",
      status: saveComplete
        ? "complete"
        : canSave || (hasPreview && courseReady)
          ? "current"
          : "upcoming",
      value: saveComplete ? "Saved" : canSave ? "Ready" : undefined,
    },
    {
      title: "Review trust",
      detail: "Use the saved shots for bag confidence, coach evidence and practice scoring.",
      status: saveComplete ? "current" : "upcoming",
      value: saveComplete ? "Open evidence" : undefined,
    },
  ];
}

function sessionTimestamp(session: RapsodoSessionListItem) {
  const date = session.dateIso ?? session.firstSeenAt ?? "";
  const timestamp = Date.parse(date);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatSessionKind(session: RapsodoSessionListItem) {
  if (isCourseSession(session)) {
    return "Course";
  }

  if (session.providerKind === "simulation") {
    return session.providerSessionMode ?? "Simulator";
  }

  return session.providerSessionMode ?? "Practice";
}

function formatPreviewType(value: RapsodoSessionPreview["sessionType"]) {
  if (value === "simulated_course") return "Course";
  if (value === "simulator") return "Simulator";
  if (value === "round") return "Round";
  return "Range";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "--"
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
        date,
      );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "--"
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function formatMetric(value: number | null) {
  return value === null ? "--" : numberFormatter.format(value);
}

function confirmedClubCount(
  preview: RapsodoSessionPreview,
  selectedClubByRow: Record<number, string>,
) {
  return preview.shots.filter((shot) => selectedClubByRow[shot.rowNumber]).length;
}

function selectionByMode(
  preview: RapsodoSessionPreview,
  mode: ClubSelectionMode,
): Record<number, string> {
  return Object.fromEntries(
    preview.shots.map((shot) => {
      const choice =
        mode === "rapsodo" && isUsableChoice(shot.reportedChoice)
          ? shot.reportedChoice
          : shot.suggestion.choice;

      return [shot.rowNumber, choice.clubKey];
    }),
  );
}

function isUsableChoice(choice: RapsodoClubChoice | null | undefined): choice is RapsodoClubChoice {
  return Boolean(choice && choice.clubType !== "unknown" && choice.clubType !== "other");
}

function notifyNewRapsodoSessions(count: number) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  new Notification("New Rapsodo sessions available", {
    body: `${count} new R-Cloud session${count === 1 ? "" : "s"} ready to review in LM World Tour.`,
  });
}
