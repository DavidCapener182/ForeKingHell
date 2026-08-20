"use client";

import { useEffect, useRef } from "react";

export default function SessionsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.error(error);
    retryButtonRef.current?.focus();
  }, [error]);

  return (
    <main
      id="main-content"
      className="min-h-screen px-4 py-4 pb-[calc(8.75rem+env(safe-area-inset-bottom))] text-foreground sm:px-6 sm:pt-6 lg:px-8 lg:pb-8"
    >
      <section
        role="alert"
        className="w-full rounded-lg border border-destructive/35 bg-destructive/10 p-4 text-foreground"
      >
        <h1 className="font-semibold text-destructive">Session history could not load</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Your session evidence has not changed. Retry to load your golf history again.
        </p>
        <button
          ref={retryButtonRef}
          type="button"
          onClick={retry}
          className="mt-3 inline-flex min-h-11 touch-manipulation items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium outline-none transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          Retry session history
        </button>
      </section>
    </main>
  );
}
