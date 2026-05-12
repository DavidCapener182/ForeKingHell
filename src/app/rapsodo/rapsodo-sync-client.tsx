"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
  Upload,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type InferredCourseShot,
  inferCourseShots,
  inferCourseShotsFromHoleShotCounts,
  parseScorecardText,
} from "@/lib/course-scorecard";
import type { RapsodoShotOverride } from "@/lib/imports/save-rapsodo-import";
import type { RapsodoClubChoice } from "@/lib/rapsodo/club-inference";
import type { RapsodoSessionListItem, RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";

type ConnectionStatus = {
  connected: boolean;
  expiresAt: string | null;
  profile: Record<string, unknown> | null;
};

type Notice =
  | { kind: "idle" }
  | { kind: "success"; title: string; message: string; sessionId?: string | null }
  | { kind: "error"; title: string; message: string };

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
type BrowserNotificationState = NotificationPermission | "unsupported";

const numberFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const RAPSODO_SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function RapsodoSyncClient({ initialStatus }: { initialStatus: ConnectionStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [notice, setNotice] = useState<Notice>({ kind: "idle" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessions, setSessions] = useState<RapsodoSessionListItem[]>([]);
  const [sessionFilter, setSessionFilter] = useState<"all" | "range" | "course" | "imported">("all");
  const [dateFilter, setDateFilter] = useState({ startDate: "", endDate: "" });
  const [preview, setPreview] = useState<RapsodoSessionPreview | null>(null);
  const [selectedClubByRow, setSelectedClubByRow] = useState<Record<number, string>>({});
  const [clubSelectionMode, setClubSelectionMode] = useState<ClubSelectionMode>("recommendations");
  const [updateRapsodoClubs, setUpdateRapsodoClubs] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [scorecardText, setScorecardText] = useState("");
  const [holeReview, setHoleReview] = useState<HoleReviewState>({});
  const [browserNotificationState, setBrowserNotificationState] = useState<BrowserNotificationState>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const [isPending, startTransition] = useTransition();
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);

  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (sessionFilter === "imported") {
          return Boolean(session.importedSessionId);
        }

        if (sessionFilter === "course") {
          return isCourseSession(session);
        }

        if (sessionFilter === "range") {
          return !isCourseSession(session);
        }

        return true;
      }),
    [sessionFilter, sessions],
  );

  const choicesByKey = useMemo(() => {
    const choices = new Map<string, RapsodoClubChoice>();

    for (const choice of preview?.clubChoices ?? []) {
      choices.set(choice.clubKey, choice);
    }

    return choices;
  }, [preview]);

  const scorecard = useMemo(() => parseScorecardText(scorecardText), [scorecardText]);
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
        autoCourseInference?.holes.find((autoHole) => autoHole.holeNumber === hole.holeNumber)?.shots.length ?? 0;
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
  const assignedCourseShots = courseHoleShotCounts.reduce((total, hole) => total + hole.shotCount, 0);
  const everyShotHasClub =
    preview?.shots.every((shot) => {
      const choice = choicesByKey.get(selectedClubByRow[shot.rowNumber]);
      return choice && choice.clubType !== "unknown" && choice.clubType !== "other";
    }) ?? false;
  const courseReady =
    !isCoursePreview ||
    (scorecard.holes.length > 0 &&
      assignedCourseShots === preview?.shotCount &&
      courseName.trim().length > 0);
  const newSessionCount = sessions.filter((session) => session.isNew && !session.importedSessionId).length;
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
      updatableCount: updates.filter((update) => update.rapsodoShotId && update.rapsodoClubId).length,
      skippedCount: updates.filter((update) => !update.rapsodoShotId || !update.rapsodoClubId).length,
    };
  }, [choicesByKey, preview, selectedClubByRow]);
  const canSave = Boolean(preview && everyShotHasClub && courseReady && !isPending);

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
      const newSessions = result.data.filter((session) => session.isNew && !session.importedSessionId);

      if (newSessions.length > 0) {
        setNotice({
          kind: "success",
          title: "New Rapsodo sessions available",
          message: `${newSessions.length} new session${newSessions.length === 1 ? "" : "s"} found. Review them, then use Rapsodo clubs or ForeKingHell recommendations before saving.`,
        });
        notifyNewRapsodoSessions(newSessions.length);
        return;
      }

      if (!options.silent) {
        setNotice({
          kind: "success",
          title: "Sessions loaded",
          message: `${result.data.length} R-Cloud session${result.data.length === 1 ? "" : "s"} found.`,
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
      setStatus({ connected: result.data.connected, expiresAt: null, profile: result.data.profile });
      setNotice({ kind: "success", title: "R-Cloud connected", message: "Token saved for this browser session." });
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
      setNotice({ kind: "success", title: "R-Cloud disconnected", message: "Saved token cleared." });
    });
  }

  function previewSession(session: RapsodoSessionListItem) {
    setNotice({ kind: "idle" });
    setLoadingLabel("Exporting CSV");
    startTransition(async () => {
      const result = await previewRapsodoSessionAction(session);
      setLoadingLabel(null);

      if (!result.ok) {
        setNotice({ kind: "error", title: "Preview failed", message: result.message });
        return;
      }

      setPreview(result.data);
      setCourseName(result.data.courseName || result.data.session.title);
      setScorecardText("");
      setHoleReview({});
      setClubSelectionMode("recommendations");
      setUpdateRapsodoClubs(false);
      setSelectedClubByRow(selectionByMode(result.data, "recommendations"));
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

    const shotOverrides = preview.shots.map((shot): RapsodoShotOverride => {
      const choice = choicesByKey.get(selectedClubByRow[shot.rowNumber]) ?? shot.suggestion.choice;
      return {
        rowNumber: shot.rowNumber,
        clubType: choice.clubType,
        clubBrand: choice.clubBrand,
        clubModel: choice.clubModel,
      };
    });

    const courseHoleScoring =
      isCoursePreview && courseInference
        ? courseInference.holes.map((hole) => {
            const review = holeReview[hole.holeNumber];
            return {
              holeNumber: hole.holeNumber,
              csvShotCount: hole.shots.length,
              putts: review?.putts ?? null,
              penalties: review?.penalties ?? null,
              score: review?.score ?? null,
            };
          })
        : undefined;

    setLoadingLabel("Saving shots");
    startTransition(async () => {
      let writebackMessage = "";

      if (updateRapsodoClubs) {
        if (rapsodoWritebackRows.updatableCount === 0) {
          setLoadingLabel(null);
          setNotice({
            kind: "error",
            title: "Rapsodo update unavailable",
            message: "R-Cloud did not expose enough shot and bag club IDs to update Rapsodo. Save with ForeKingHell recommendations or update Rapsodo manually first.",
          });
          return;
        }

        const writebackResult = await syncRapsodoShotClubsAction({
          session: preview.session,
          updates: rapsodoWritebackRows.updates,
        });

        if (!writebackResult.ok) {
          setLoadingLabel(null);
          setNotice({ kind: "error", title: "Rapsodo update failed", message: writebackResult.message });
          return;
        }

        writebackMessage =
          writebackResult.data.updated > 0
            ? ` Updated ${writebackResult.data.updated} club${writebackResult.data.updated === 1 ? "" : "s"} in Rapsodo first.`
            : " Rapsodo did not expose any updateable shot IDs, so only ForeKingHell was saved.";
      }

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
          courseName: isCoursePreview ? courseName : undefined,
          courseScorecardText: isCoursePreview ? scorecardText : undefined,
          courseHoleShotCounts: isCoursePreview ? courseHoleShotCounts : undefined,
          courseHoleScoring,
          shotOverrides,
        },
      });
      setLoadingLabel(null);

      if (!result.ok) {
        setNotice({ kind: "error", title: "Import failed", message: result.message });
        return;
      }

      if (!result.data.ok) {
        setNotice({ kind: "error", title: "Import failed", message: result.data.message });
        return;
      }

      const importedSessionId = result.data.sessionId;
      notifyAchievementUnlocks(result.data.achievementUnlockNotifications);
      setNotice({
        kind: "success",
        title: result.data.skipped ? "Already imported" : "Rapsodo session saved",
        message: result.data.skipped
          ? "This exported CSV already exists in ForeKingHell."
          : `Saved ${result.data.shotCount} shot${result.data.shotCount === 1 ? "" : "s"}.${writebackMessage}`,
        sessionId: result.data.sessionId,
      });
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
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
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

        <header className="premium-hero p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <Badge className="w-fit bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                Experimental R-Cloud connector
              </Badge>
              <h1 className="text-4xl font-semibold tracking-normal text-balance sm:text-5xl">
                Rapsodo cloud sync
              </h1>
              <p className="text-base leading-7 text-muted-foreground">
                Pull R-Cloud CSV exports, review club matches, and save confirmed shots into ForeKingHell.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[640px]">
              <StatusTile label="Connection" value={status.connected ? "Connected" : "Signed out"} />
              <StatusTile label="Remote sessions" value={sessions.length.toString()} />
              <StatusTile label="New" value={newSessionCount.toString()} />
              <StatusTile label="Preview" value={preview ? preview.shotCount.toString() : "--"} />
            </div>
          </div>
        </header>

        {notice.kind !== "idle" ? (
          <Alert variant={notice.kind === "error" ? "destructive" : "default"}>
            {notice.kind === "error" ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
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
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Connection</CardTitle>
              <CardDescription>Rapsodo password is exchanged for a protected server cookie token.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status.connected ? (
                <div className="space-y-4">
                  <div className="rounded-[8px] border bg-emerald-50 p-3 text-sm text-emerald-900">
                    <div className="flex items-center gap-2 font-medium">
                      <ShieldCheck className="size-4" />
                      Token saved
                    </div>
                    <p className="mt-1 text-emerald-800">
                      {status.expiresAt ? `Expires ${formatDateTime(status.expiresAt)}.` : "Expires automatically."}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" onClick={() => void loadSessions()} disabled={isPending}>
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
                    <Button type="button" variant="outline" onClick={disconnect} disabled={isPending}>
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
                  <Button type="submit" className="w-full bg-[#111827] text-white" disabled={isPending}>
                    {loadingLabel === "Signing in" ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />}
                    Sign in to R-Cloud
                  </Button>
                </form>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(event) => setDateFilter((current) => ({ ...current, startDate: event.target.value }))}
                />
                <Input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(event) => setDateFilter((current) => ({ ...current, endDate: event.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Remote sessions</CardTitle>
                  <CardDescription>Choose a session, export its CSV, then review before saving.</CardDescription>
                </div>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={sessionFilter}
                  onChange={(event) => setSessionFilter(event.target.value as typeof sessionFilter)}
                >
                  <option value="all">All</option>
                  <option value="range">Range</option>
                  <option value="course">Course</option>
                  <option value="imported">Imported</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-[8px] border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Shots</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map((session) => (
                      <TableRow key={`${session.providerKind}-${session.providerSessionId}`}>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{session.title}</span>
                            {session.isNew && !session.importedSessionId ? (
                              <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">New</Badge>
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
                              <span className="text-muted-foreground">Seen {formatDate(session.firstSeenAt)}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{formatSessionKind(session)}</TableCell>
                        <TableCell>{session.dateIso ? formatDate(session.dateIso) : "--"}</TableCell>
                        <TableCell className="text-right">
                          {session.shotCount === null ? "--" : session.shotCount}
                        </TableCell>
                        <TableCell>
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
                          {status.connected ? "Load sessions from R-Cloud." : "Sign in to load sessions."}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>

        {preview ? (
          <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <Card className="premium-card">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{preview.session.title}</CardTitle>
                    <CardDescription>
                      {preview.shotCount} shots, {preview.rawRowCount} raw rows, {preview.distanceUnit}
                    </CardDescription>
                  </div>
                  <Button type="button" onClick={savePreview} disabled={!canSave} className="bg-[#111827] text-white">
                    {loadingLabel === "Saving shots" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    Save confirmed shots
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-[8px] border bg-[#f9fafb] p-3 lg:grid-cols-[1fr_1fr_1.25fr]">
                  <Button
                    type="button"
                    variant={clubSelectionMode === "recommendations" ? "default" : "outline"}
                    className={clubSelectionMode === "recommendations" ? "bg-[#111827] text-white" : ""}
                    onClick={() => applyClubSelectionMode("recommendations")}
                    disabled={isPending}
                  >
                    <Sparkles className="size-4" />
                    Use recommendations
                  </Button>
                  <Button
                    type="button"
                    variant={clubSelectionMode === "rapsodo" ? "default" : "outline"}
                    className={clubSelectionMode === "rapsodo" ? "bg-[#111827] text-white" : ""}
                    onClick={() => applyClubSelectionMode("rapsodo")}
                    disabled={isPending}
                  >
                    <ShieldCheck className="size-4" />
                    Use Rapsodo clubs
                  </Button>
                  <label
                    className={`flex min-h-10 items-start gap-3 rounded-md border bg-white px-3 py-2 text-sm ${
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
                    <span>
                      <span className="flex items-center gap-2 font-medium">
                        <CloudUpload className="size-4" />
                        Update Rapsodo first
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {rapsodoWritebackRows.updatableCount}/{preview.shotCount} shots can be matched back to R-Cloud.
                      </span>
                    </span>
                  </label>
                </div>
                {preview.warnings.length > 0 ? (
                  <Alert>
                    <AlertCircle className="size-4" />
                    <AlertTitle>CSV warnings</AlertTitle>
                    <AlertDescription>{preview.warnings.join(" ")}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="overflow-x-auto rounded-[8px] border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shot</TableHead>
                        <TableHead>Rapsodo</TableHead>
                        <TableHead>Confirmed club</TableHead>
                        <TableHead className="text-right">Carry</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.shots.map((shot) => (
                        <TableRow key={shot.rowNumber}>
                          <TableCell>{shot.shotNumber ?? shot.rowNumber}</TableCell>
                          <TableCell>
                            <div>{shot.reportedClubLabel}</div>
                            {shot.rapsodoShotId ? (
                              <div className="mt-1 text-xs text-muted-foreground">Write-back ready</div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <select
                              className="h-9 w-44 rounded-md border bg-background px-2 text-sm"
                              value={selectedClubByRow[shot.rowNumber] ?? ""}
                              onChange={(event) =>
                                {
                                  setClubSelectionMode("custom");
                                  setSelectedClubByRow((current) => ({
                                    ...current,
                                    [shot.rowNumber]: event.target.value,
                                  }));
                                }
                              }
                            >
                              <option value="">Choose club</option>
                              {preview.clubChoices.map((choice) => (
                                <option key={`${shot.rowNumber}-${choice.clubKey}`} value={choice.clubKey}>
                                  {choice.clubLabel}
                                  {choice.clubBrand || choice.clubModel
                                    ? ` - ${[choice.clubBrand, choice.clubModel].filter(Boolean).join(" ")}`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="text-right">{formatMetric(shot.carryYd)}</TableCell>
                          <TableCell className="text-right">{formatMetric(shot.totalYd)}</TableCell>
                          <TableCell>
                            <div className="max-w-[260px] text-xs text-muted-foreground">
                              <Badge variant={shot.suggestion.confidence === "low" ? "secondary" : "default"}>
                                {shot.suggestion.confidenceScore}%
                              </Badge>
                              <span className="ml-2">{shot.suggestion.reason}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="premium-card">
              <CardHeader>
                <CardTitle>{isCoursePreview ? "Course review" : "Import summary"}</CardTitle>
                <CardDescription>
                  {isCoursePreview
                    ? "Course sessions need scorecard and hole assignment before saving."
                    : "Range and simulator sessions can save after club confirmation."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCoursePreview ? (
                  <>
                    <Input
                      value={courseName}
                      placeholder="Course name"
                      onChange={(event) => setCourseName(event.target.value)}
                    />
                    <textarea
                      className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      placeholder="Hole, par, yards"
                      value={scorecardText}
                      onChange={(event) => setScorecardText(event.target.value)}
                    />
                    <div className="rounded-[8px] border bg-[#f9fafb] p-3 text-sm">
                      {scorecard.holes.length === 0 ? (
                        <p className="text-muted-foreground">Add scorecard rows before saving this course session.</p>
                      ) : (
                        <p>
                          {assignedCourseShots}/{preview.shotCount} shots assigned across {scorecard.holes.length} holes.
                        </p>
                      )}
                      {scorecard.warnings.length > 0 ? (
                        <p className="mt-2 text-amber-700">{scorecard.warnings.join(" ")}</p>
                      ) : null}
                    </div>
                    {scorecard.holes.length > 0 ? (
                      <div className="max-h-[460px] overflow-auto rounded-[8px] border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Hole</TableHead>
                              <TableHead className="text-right">Shots</TableHead>
                              <TableHead className="text-right">Score</TableHead>
                              <TableHead className="text-right">Putts</TableHead>
                              <TableHead className="text-right">Pen</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {scorecard.holes.map((hole) => {
                              const autoShotCount =
                                autoCourseInference?.holes.find((autoHole) => autoHole.holeNumber === hole.holeNumber)
                                  ?.shots.length ?? 0;
                              const review = holeReview[hole.holeNumber] ?? {};

                              return (
                                <TableRow key={hole.holeNumber}>
                                  <TableCell>
                                    {hole.holeNumber}
                                    <span className="ml-1 text-xs text-muted-foreground">
                                      par {hole.par}, {hole.yards}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <NumberInput
                                      value={review.shotCount ?? autoShotCount}
                                      onChange={(value) => updateHoleReview(hole.holeNumber, { shotCount: value })}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <NumberInput
                                      value={review.score ?? null}
                                      onChange={(value) => updateHoleReview(hole.holeNumber, { score: value })}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <NumberInput
                                      value={review.putts ?? null}
                                      onChange={(value) => updateHoleReview(hole.holeNumber, { putts: value })}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <NumberInput
                                      value={review.penalties ?? null}
                                      onChange={(value) => updateHoleReview(hole.holeNumber, { penalties: value })}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="grid gap-3">
                    <SummaryRow label="Session type" value={formatPreviewType(preview.sessionType)} />
                    <SummaryRow label="Session date" value={formatDate(preview.sessionDate)} />
                    <SummaryRow label="Club choices" value={`${confirmedClubCount(preview, selectedClubByRow)}/${preview.shotCount}`} />
                    <SummaryRow label="Duplicate key" value={preview.rawCsvHash.slice(0, 12)} />
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}
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
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-white/70 bg-white/70 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] border bg-[#f9fafb] px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <Input
      type="number"
      min={0}
      className="ml-auto h-8 w-16 text-right"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value === "" ? null : Math.max(0, Number(event.target.value)))}
    />
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
  return [session.providerSessionMode, session.providerSessionType, session.title].join(" ").toLowerCase().includes("course");
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
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
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

function confirmedClubCount(preview: RapsodoSessionPreview, selectedClubByRow: Record<number, string>) {
  return preview.shots.filter((shot) => selectedClubByRow[shot.rowNumber]).length;
}

function selectionByMode(preview: RapsodoSessionPreview, mode: ClubSelectionMode): Record<number, string> {
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
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  new Notification("New Rapsodo sessions available", {
    body: `${count} new R-Cloud session${count === 1 ? "" : "s"} ready to review in ForeKingHell.`,
  });
}
