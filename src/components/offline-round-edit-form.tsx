"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, WifiOff } from "lucide-react";

import { queueOfflineAction } from "@/lib/offline-queue";
import type { OfflineRoundEditKind } from "@/lib/offline-round-edit-payload";

type OfflineRoundEditFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  editKind: OfflineRoundEditKind;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function OfflineRoundEditForm({
  action,
  editKind,
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
      {children}
      {saveStatus === "saving" ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[#0B7A3B]" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin" />
          Saving...
        </p>
      ) : null}
      {saveStatus === "saved" ? (
        <p
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#0B7A3B]"
          aria-live="polite"
        >
          <CheckCircle2 className="size-3.5" />
          Saved just now.
        </p>
      ) : null}
      {saveStatus === "error" ? (
        <p
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-700"
          aria-live="polite"
        >
          <AlertCircle className="size-3.5" />
          Save failed. Try again.
        </p>
      ) : null}
      {queued ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700" aria-live="polite">
          <WifiOff className="size-3.5" />
          Queued for sync when this device is online.
        </p>
      ) : null}
    </form>
  );
}
