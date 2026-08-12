"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Cloud, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";

import {
  disconnectRapsodoAction,
  importRapsodoSessionAction,
  listRapsodoSessionsAction,
  loginRapsodoAction,
  previewRapsodoSessionAction,
} from "@/app/rapsodo/actions";
import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { Button } from "@/components/ui/button";
import type { RapsodoSessionListItem, RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";
import {
  buildCompanionRapsodoShotOverrides,
  companionRapsodoInbox,
  companionRapsodoResultHref,
  uncertainCompanionRapsodoShots,
} from "@/lib/rapsodo/companion-workflow";

type ConnectionStatus = {
  connected: boolean;
  expiresAt: string | null;
  profile: Record<string, unknown> | null;
};

export function RapsodoCompanionClient({
  initialStatus,
  practicePlanId,
}: {
  initialStatus: ConnectionStatus;
  practicePlanId: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [sessions, setSessions] = useState<RapsodoSessionListItem[]>([]);
  const [preview, setPreview] = useState<RapsodoSessionPreview | null>(null);
  const [selectedByRow, setSelectedByRow] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<"sessions" | "preview" | "import" | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadSessions = useCallback(() => {
    if (!status.connected) return;
    setLoading("sessions");
    setMessage(null);
    startTransition(async () => {
      const result = await listRapsodoSessionsAction({ take: 16 });
      setLoading(null);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSessions(companionRapsodoInbox(result.data));
    });
  }, [status.connected]);

  useEffect(() => {
    const timer = window.setTimeout(loadSessions, 0);
    return () => window.clearTimeout(timer);
  }, [loadSessions]);

  function connect(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    setMessage(null);
    startTransition(async () => {
      const result = await loginRapsodoAction({ email, password });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setStatus({ connected: true, expiresAt: null, profile: result.data.profile });
    });
  }

  function openPreview(session: RapsodoSessionListItem) {
    setLoading("preview");
    setMessage(null);
    startTransition(async () => {
      const result = await previewRapsodoSessionAction(session);
      setLoading(null);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setPreview(result.data);
      setSelectedByRow({});
    });
  }

  const uncertain = useMemo(() => uncertainCompanionRapsodoShots(preview), [preview]);
  const uncertainComplete = uncertain.every((shot) =>
    Boolean(selectedByRow[shot.rowNumber] ?? shot.suggestion.choice.clubKey),
  );

  function savePreview() {
    if (!preview || !uncertainComplete || pending) return;
    if (preview.sessionType !== "range") {
      setMessage("Scored course sessions need scorecard confirmation in the Full Site workbench.");
      return;
    }
    setLoading("import");
    setMessage(null);
    const shotOverrides = buildCompanionRapsodoShotOverrides(preview, selectedByRow);
    startTransition(async () => {
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
          shotOverrides,
          practicePlanId: practicePlanId ?? undefined,
        },
      });
      if (!result.ok) {
        setLoading(null);
        setMessage(result.message);
        return;
      }
      if (!result.data.ok) {
        setLoading(null);
        setMessage(result.data.message);
        return;
      }
      const destination = new URL(
        companionRapsodoResultHref(result.data.sessionId),
        window.location.origin,
      );
      window.location.assign(destination);
    });
  }

  if (!status.connected) {
    return (
      <section className="ios-grouped-list grid gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Rapsodo R-Cloud
          </p>
          <h1 className="mt-1 text-2xl font-bold">Connect your account</h1>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Credentials are sent directly to R-Cloud to establish the encrypted provider session.
          </p>
        </div>
        <form action={connect} className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold">
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="min-h-11 rounded-xl border bg-background px-3 font-normal"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="min-h-11 rounded-xl border bg-background px-3 font-normal"
            />
          </label>
          <Button type="submit" className="min-h-12 rounded-xl" disabled={pending}>
            Connect R-Cloud
          </Button>
        </form>
        {message ? (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        ) : null}
      </section>
    );
  }

  if (preview) {
    return (
      <div
        className="grid gap-4"
        data-rapsodo-companion-preview
        data-hydrated={hydrated ? "true" : "false"}
      >
        <section className="ios-grouped-list grid gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Session preview
              </p>
              <h1 className="mt-1 text-xl font-bold">{preview.session.title}</h1>
            </div>
            <IOSInlineStatus label={`${preview.shotCount} shots`} tone="positive" />
          </div>
          <IOSGroupedList label="R-Cloud session summary" className="bg-card">
            <IOSMetricRow label="Date" value={formatDate(preview.sessionDate)} />
            <IOSMetricRow
              label="Type"
              value={preview.sessionType === "range" ? "Range practice" : "Scored course"}
            />
            <IOSMetricRow
              label="Detected clubs"
              value={String(
                new Set(preview.shots.map((shot) => shot.suggestion.choice.clubType)).size,
              )}
            />
            <IOSMetricRow label="Needs confirmation" value={String(uncertain.length)} />
          </IOSGroupedList>
        </section>
        {uncertain.length > 0 ? (
          <section className="ios-grouped-list grid gap-3 p-4" data-uncertain-club-mappings>
            <div>
              <h2 className="font-semibold">Confirm uncertain clubs</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Trusted matches are already accepted.
              </p>
            </div>
            {uncertain.map((shot) => (
              <label key={shot.rowNumber} className="grid gap-1 text-sm font-semibold">
                Shot {shot.shotNumber ?? shot.rowNumber} · {Math.round(shot.carryYd ?? 0)} yd
                <select
                  className="min-h-11 rounded-xl border bg-background px-3"
                  value={selectedByRow[shot.rowNumber] ?? shot.suggestion.choice.clubKey}
                  onChange={(event) =>
                    setSelectedByRow((current) => ({
                      ...current,
                      [shot.rowNumber]: event.target.value,
                    }))
                  }
                >
                  {preview.clubChoices.map((choice) => (
                    <option key={choice.clubKey} value={choice.clubKey}>
                      {choice.clubLabel}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal text-muted-foreground">
                  {shot.suggestion.reason}
                </span>
              </label>
            ))}
          </section>
        ) : (
          <p className="rounded-xl bg-primary/10 p-3 text-sm font-medium text-primary">
            <ShieldCheck className="mr-2 inline size-4" />
            All club matches are high confidence.
          </p>
        )}
        {preview.sessionType !== "range" ? (
          <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
            This course session needs scorecard confirmation. Open Full Site to import it without
            guessing holes or scores.
          </p>
        ) : null}
        {message ? (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        ) : null}
        <Button
          type="button"
          className="min-h-12 rounded-xl"
          onClick={savePreview}
          disabled={!hydrated || pending || !uncertainComplete || preview.sessionType !== "range"}
        >
          {loading === "import" ? (
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
          ) : null}
          Import and review
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => setPreview(null)}
          disabled={!hydrated || pending}
        >
          Back to inbox
        </Button>
      </div>
    );
  }

  return (
    <div
      className="grid gap-4"
      data-rapsodo-companion-inbox
      data-hydrated={hydrated ? "true" : "false"}
    >
      <section className="ios-grouped-list flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">R-Cloud connected</p>
          <p className="text-xs text-muted-foreground">Recent unimported sessions</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 rounded-xl"
          onClick={loadSessions}
          disabled={!hydrated || pending}
          aria-label="Refresh R-Cloud sessions"
        >
          <RefreshCw className="size-4" />
        </Button>
      </section>
      <section className="grid gap-2.5">
        <IOSSectionHeader
          title="Session inbox"
          description={
            sessions.length ? "Newest unimported session first" : "No unimported sessions found"
          }
        />
        <IOSGroupedList label="R-Cloud session inbox">
          {sessions.map((session, index) => (
            <IOSListRow
              key={`${session.providerKind}-${session.providerSessionId}`}
              icon={Cloud}
              label={session.title}
              detail={`${formatDate(session.dateIso)} · ${session.shotCount ?? "—"} shots`}
              onClick={() => openPreview(session)}
              status={index === 0 ? <IOSInlineStatus label="Newest" tone="positive" /> : undefined}
            />
          ))}
          {loading === "sessions" ? (
            <IOSListRow label="Loading recent sessions…" icon={LoaderCircle} />
          ) : null}
          {!loading && sessions.length === 0 ? (
            <IOSListRow
              label="You are up to date"
              detail="Refresh after your next Rapsodo session."
            />
          ) : null}
        </IOSGroupedList>
      </section>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 text-muted-foreground"
        disabled={!hydrated || pending}
        onClick={() =>
          startTransition(async () => {
            await disconnectRapsodoAction();
            setStatus({ connected: false, expiresAt: null, profile: null });
            setSessions([]);
          })
        }
      >
        Disconnect R-Cloud
      </Button>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
