"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, WifiOff } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { queueOfflineAction } from "@/lib/offline-queue";
import type { OfflineRoundEditKind } from "@/lib/offline-round-edit-payload";

type OfflineRoundEditFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  editKind: OfflineRoundEditKind;
  recordVersion: string;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function OfflineRoundEditForm({
  action,
  editKind,
  recordVersion,
  children,
  className,
  id,
}: OfflineRoundEditFormProps) {
  const [queued, setQueued] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  return (
    <form
      id={id}
      action={async (formData) => {
        setQueued(false);
        setSaveStatus("saving");

        try {
          await action(formData);
          setSaveStatus("saved");
        } catch {
          setSaveStatus("error");
        }
      }}
      className={className}
      onChange={() => {
        if (saveStatus === "saved" || saveStatus === "error") {
          setSaveStatus("idle");
        }
      }}
      onSubmit={(event) => {
        if (navigator.onLine) {
          return;
        }

        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const fields = Array.from(formData.entries())
          .filter((entry): entry is [string, string] => typeof entry[1] === "string")
          .map(([key, value]) => [key, value] as [string, string]);

        void queueOfflineAction({
          id: `round-edit-${editKind}-${Date.now()}-${crypto.randomUUID()}`,
          kind: "round-edit",
          payload: { editKind, fields },
        }).then(() => {
          setSaveStatus("idle");
          setQueued(true);
        });
      }}
    >
      <input type="hidden" name="expectedUpdatedAt" value={recordVersion} />
      {children}
      {saveStatus === "saving" ? (
        <Alert
          className="mt-2 border-[var(--status-information-border)] bg-[var(--status-information-surface)] text-[var(--status-information-foreground)]"
          aria-live="polite"
        >
          <Loader2 className="size-3.5 animate-spin" />
          <AlertDescription className="text-xs text-[var(--status-information-foreground)]">
            Saving…
          </AlertDescription>
        </Alert>
      ) : null}
      {saveStatus === "saved" ? (
        <Alert
          className="mt-2 border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]"
          aria-live="polite"
        >
          <CheckCircle2 className="size-3.5" />
          <AlertDescription className="text-xs font-medium text-[var(--status-success-foreground)]">
            Saved just now.
          </AlertDescription>
        </Alert>
      ) : null}
      {saveStatus === "error" ? (
        <Alert variant="destructive" className="mt-2" aria-live="polite">
          <AlertCircle className="size-3.5" />
          <AlertDescription className="text-xs font-medium text-destructive">
            Save failed. Try again.
          </AlertDescription>
        </Alert>
      ) : null}
      {queued ? (
        <Alert
          className="mt-2 border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]"
          aria-live="polite"
        >
          <WifiOff className="size-3.5" />
          <AlertDescription className="text-xs text-[var(--status-warning-foreground)]">
            Queued for sync when this device is online.
          </AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
