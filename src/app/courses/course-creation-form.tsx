"use client";
import { useClientReady } from "@/hooks/use-client-ready";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";

/** Keeps the user's fields intact when an existing course action rejects. */
export function CourseCreationForm({
  action,
  children,
  className,
  noun = "course",
  ...attributes
}: {
  action: (data: FormData) => unknown | Promise<unknown>;
  children: ReactNode;
  className?: string;
  id?: string;
  noun?: string;
  "data-google-course-selection"?: boolean;
}) {
  const ready = useClientReady();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      {...attributes}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (busy.current) return;
        const data = new FormData(event.currentTarget);
        busy.current = true;
        setError(null);
        setSaved(false);
        startTransition(async () => {
          try {
            await action(data);
            setSaved(true);
          } catch (failure) {
            unstable_rethrow(failure);
            setError(
              `We could not confirm that this ${noun} was saved. Your entries are kept. Check the saved record before trying again.`,
            );
          } finally {
            busy.current = false;
          }
        });
      }}
      aria-busy={pending}
    >
      <fieldset disabled={!ready || pending} className="grid min-w-0 gap-4">
        {children}
      </fieldset>
      {pending ? (
        <p role="status" className="mt-3 text-sm">
          Saving {noun}…
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="mt-3 text-sm">
          Saved {noun}.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-destructive p-3 text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
