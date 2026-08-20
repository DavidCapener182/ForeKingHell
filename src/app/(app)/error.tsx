"use client";

import { useEffect } from "react";

export default function AuthenticatedRouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section
      role="alert"
      data-app-error-state
      className="mx-4 my-6 rounded-xl border border-destructive/45 bg-destructive/10 p-5 text-foreground sm:mx-6"
    >
      <h1 className="text-lg font-semibold">This view could not be loaded</h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Your data has not been changed. Retry this view, or return to it from the command menu.
      </p>
      <button
        type="button"
        onClick={unstable_retry}
        className="focus-aaa mt-4 min-h-11 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold shadow-sm"
      >
        Retry
      </button>
    </section>
  );
}
