"use client";

import { useEffect } from "react";

import { AppErrorState } from "@/components/app/app-error-state";
import { Button } from "@/components/ui/button";

export function SegmentErrorState({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="min-h-screen px-4 py-4 pb-[calc(8.75rem+env(safe-area-inset-bottom))] text-foreground sm:px-6 sm:pt-6 lg:px-8 lg:pb-8"
    >
      <div data-route-error-state>
        <AppErrorState
          title={<h1>This view could not be loaded</h1>}
          description="Try again. If that doesn’t work, reload the page."
          action={
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="min-h-11" onClick={retry}>
                Retry
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
              <Button asChild variant="ghost" className="min-h-11 lg:hidden">
                <a href="/today">Back to Today</a>
              </Button>
              <Button asChild variant="ghost" className="hidden min-h-11 lg:inline-flex">
                <a href="/dashboard">Back to dashboard</a>
              </Button>
              <Button asChild variant="ghost" className="min-h-11 lg:hidden">
                <a href="/offline">Open saved golf</a>
              </Button>
            </div>
          }
        />
      </div>
    </main>
  );
}
