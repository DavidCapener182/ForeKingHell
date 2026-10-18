"use client";

import { useEffect, useRef } from "react";
import { AppErrorState } from "@/components/app/app-error-state";
import { Button } from "@/components/ui/button";

type EvidenceRecovery = "import" | "rapsodo" | "shots" | "providers" | "companion";
const recoveryCopy = {
  import: {
    title: "Import workspace could not load",
    detail:
      "Open saved history to check an earlier import. If you were saving a session, check history before starting another upload.",
    retry: "Retry import workspace",
    href: "/sessions",
    link: "Check saved sessions",
  },
  rapsodo: {
    title: "Rapsodo workspace could not load",
    detail:
      "Retry the connection view, or use your exported CSV. If an import was in progress, check saved sessions before trying again.",
    retry: "Retry Rapsodo workspace",
    href: "/import?source=csv",
    link: "Use a CSV instead",
  },
  shots: {
    title: "Shot evidence could not load",
    detail:
      "Retry this view with your current selection, or return to session history to choose the evidence you need.",
    retry: "Retry shot evidence",
    href: "/sessions",
    link: "Open session history",
  },
  providers: {
    title: "Provider connections could not load",
    detail:
      "Retry to inspect connection settings and recorded import activity. Your saved sessions remain available separately.",
    retry: "Retry provider connections",
    href: "/sessions",
    link: "Open saved sessions",
  },
  companion: {
    title: "Companion task could not load",
    detail:
      "Retry the current task. If you were saving an upload, check session history before repeating it.",
    retry: "Retry companion task",
    href: "/sessions",
    link: "Check saved sessions",
  },
} satisfies Record<
  EvidenceRecovery,
  { title: string; detail: string; retry: string; href: string; link: string }
>;

export function EvidenceRouteError({
  error,
  retry,
  context,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  context: EvidenceRecovery;
}) {
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    console.error(error);
    retryRef.current?.focus();
  }, [error]);
  const copy = recoveryCopy[context];
  return (
    <main
      id="main-content"
      className="min-h-screen px-4 py-4 pb-[calc(8.75rem+env(safe-area-inset-bottom))] text-foreground sm:px-6 sm:pt-6 lg:px-8 lg:pb-8"
    >
      <AppErrorState
        title={<h1>{copy.title}</h1>}
        description={copy.detail}
        action={
          <div className="flex flex-wrap gap-3">
            <Button
              ref={retryRef}
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={retry}
            >
              {copy.retry}
            </Button>
            <Button asChild variant="ghost" className="min-h-11">
              <a href={copy.href}>{copy.link}</a>
            </Button>
          </div>
        }
      />
    </main>
  );
}
