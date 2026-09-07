"use client";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
type Result = { ok: true } | { ok: false; error: string; code?: string };
/** Native validation + explicit submission keeps uncontrolled fields intact on server failure. */
export function DraftForm({
  action,
  children,
  submitLabel,
  onSuccess,
  onCancel,
  onPendingChange,
  creationId,
  gridClassName = "grid gap-4 sm:grid-cols-2",
}: {
  action: (data: FormData) => Promise<Result>;
  children: ReactNode;
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
  creationId?: string;
  gridClassName?: string;
}) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const errorBox = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting.current) return;
        const data = new FormData(event.currentTarget);
        if (creationId) data.set("creationId", creationId);
        submitting.current = true;
        onPendingChange?.(true);
        setError("");
        setSaved(false);
        startTransition(async () => {
          try {
            const result = await action(data);
            if (result.ok) {
              setSaved(true);
              onSuccess?.();
            } else setError(result.error);
          } catch {
            setError("The change could not be saved. Your entries are still here; try again.");
          } finally {
            submitting.current = false;
            onPendingChange?.(false);
          }
        });
      }}
      aria-busy={pending}
      onChange={() => setSaved(false)}
    >
      <fieldset disabled={pending} className={gridClassName}>
        {children}
      </fieldset>
      {error ? (
        <p
          ref={errorBox}
          role="alert"
          tabIndex={-1}
          className="mt-4 rounded-lg border border-destructive/30 p-3 text-sm text-destructive focus:outline-2 focus:outline-ring"
        >
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="mt-3 text-sm text-primary">
          Saved.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 border-t pt-4 pb-[env(safe-area-inset-bottom)]">
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="min-h-11"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
