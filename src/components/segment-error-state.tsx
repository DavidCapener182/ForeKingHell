"use client";

import { useEffect } from "react";

import { AppErrorState } from "@/components/app/app-error-state";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";

export function SegmentErrorState({
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
    <PageShell>
      <AppErrorState
        title="This view could not be loaded"
        description="Your data has not been changed. Retry this view, or return to it from the command menu."
        action={
          <Button type="button" variant="outline" onClick={unstable_retry}>
            Retry
          </Button>
        }
      />
    </PageShell>
  );
}
