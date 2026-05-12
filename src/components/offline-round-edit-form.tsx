"use client";

import { useState, type ReactNode } from "react";
import { WifiOff } from "lucide-react";

import { queueOfflineAction } from "@/lib/offline-queue";
import type { OfflineRoundEditKind } from "@/lib/offline-round-edit-payload";

type OfflineRoundEditFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  editKind: OfflineRoundEditKind;
  children: ReactNode;
  className?: string;
};

export function OfflineRoundEditForm({
  action,
  editKind,
  children,
  className,
}: OfflineRoundEditFormProps) {
  const [queued, setQueued] = useState(false);

  return (
    <form
      action={action}
      className={className}
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
        }).then(() => setQueued(true));
      }}
    >
      {children}
      {queued ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700" aria-live="polite">
          <WifiOff className="size-3.5" />
          Queued for sync when this device is online.
        </p>
      ) : null}
    </form>
  );
}
