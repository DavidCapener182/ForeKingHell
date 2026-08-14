"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Flame, Radio, Save, TriangleAlert } from "lucide-react";

import { createSessionRoastFeedItemAction } from "@/app/simulator-lab/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SessionRoastFact, SimulatorLabSession } from "@/lib/simulator-lab";

type RoastDraft = {
  headline: string;
  roast: string;
  shortCaption: string;
  safetyNote: string;
};

type RoastNotice = {
  kind: "success" | "error";
  message: string;
};

export function SessionRoastPanel({
  session,
  facts,
}: {
  session: SimulatorLabSession | null;
  facts: SessionRoastFact[];
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<RoastDraft | null>(null);
  const [notice, setNotice] = useState<RoastNotice | null>(null);

  if (!session) {
    return (
      <div className="apple-panel p-4 text-sm text-muted-foreground">
        Save a simulator session before generating roast drafts.
      </div>
    );
  }

  const activeSession = session;

  function generateRoast() {
    setNotice(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/ai/session-roast", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: activeSession.id }),
        });
        const payload = (await response.json().catch(() => null)) as {
          roast?: RoastDraft;
          message?: string;
        } | null;

        if (!response.ok || !payload?.roast) {
          setNotice({
            kind: "error",
            message: payload?.message ?? "Roast generation failed.",
          });
          return;
        }

        setDraft(payload.roast);
      } catch {
        setNotice({
          kind: "error",
          message: "Roast generation could not connect. Try again after the page reloads.",
        });
      }
    });
  }

  function saveDraft() {
    if (!draft) {
      return;
    }

    setNotice(null);
    startTransition(async () => {
      try {
        const result = await createSessionRoastFeedItemAction({
          sessionId: activeSession.id,
          headline: draft.headline,
          roast: draft.roast,
          shortCaption: draft.shortCaption,
        });

        setNotice(
          result.ok
            ? { kind: "success", message: "Saved as a private feed draft." }
            : { kind: "error", message: result.message ?? "Could not save draft." },
        );
      } catch {
        setNotice({
          kind: "error",
          message: "Could not save draft. Try again after the page reloads.",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {facts.length > 0 ? (
          facts.map((fact) => (
            <Badge key={`${fact.label}-${fact.value}`} variant="outline">
              {fact.label}: {fact.value}
            </Badge>
          ))
        ) : (
          <Badge variant="outline">No roast facts yet</Badge>
        )}
      </div>

      {draft ? (
        <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Draft
              </p>
              <h3 className="mt-1 text-lg font-semibold">{draft.headline}</h3>
            </div>
            <Radio className="size-5 text-[var(--status-success-foreground)]" />
          </div>
          <p className="mt-3 text-sm leading-6">{draft.roast}</p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{draft.safetyNote}</p>
        </div>
      ) : null}

      {notice?.kind === "error" ? (
        <Alert variant="destructive" data-roast-status="error">
          <TriangleAlert className="size-4" aria-hidden />
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : notice?.kind === "success" ? (
        <Alert
          className="border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)] [&_[data-slot=alert-description]]:text-[var(--status-success-foreground)]"
          data-roast-status="success"
        >
          <CircleCheck className="size-4" aria-hidden />
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={generateRoast} disabled={pending} className="rounded-lg">
          <Flame className="size-4" />
          {pending ? "Working" : "Roast this session"}
        </Button>
        <Button type="button" variant="outline" onClick={saveDraft} disabled={pending || !draft}>
          <Save className="size-4" />
          Save private draft
        </Button>
      </div>
    </div>
  );
}
