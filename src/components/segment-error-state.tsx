"use client";

import Link from "next/link";
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
          description="Try again to reload this screen, or return to your main view."
          action={
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="min-h-11" onClick={retry}>
                Retry
              </Button>
              <Button asChild variant="ghost" className="min-h-11 lg:hidden">
                <Link href="/today">Back to Today</Link>
              </Button>
              <Button asChild variant="ghost" className="hidden min-h-11 lg:inline-flex">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          }
        />
      </div>
    </main>
  );
}
