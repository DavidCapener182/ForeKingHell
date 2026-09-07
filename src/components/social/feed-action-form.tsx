"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { feedInteractionFormAction } from "@/app/feed/actions";
import { useClientReady } from "@/hooks/use-client-ready";
export function FeedActionForm({
  operation,
  children,
  reset = false,
}: {
  operation: string;
  children: ReactNode;
  reset?: boolean;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const lock = useRef(false);
  return (
    <form
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (lock.current) return;
        const form = e.currentTarget;
        const data = new FormData(form);
        data.set("operation", operation);
        lock.current = true;
        setError(undefined);
        start(async () => {
          try {
            const result = await feedInteractionFormAction({ ok: false }, data);
            if (!result.ok) {
              setError(result.error ?? "Could not save. Try again.");
              return;
            }
            if (reset) form.reset();
            router.refresh();
          } catch {
            setError("Could not save. Try again.");
          } finally {
            lock.current = false;
          }
        });
      }}
    >
      <fieldset disabled={!ready || pending} className="min-w-0">
        {children}
      </fieldset>
      {pending ? (
        <p role="status" className="text-xs">
          Saving…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
