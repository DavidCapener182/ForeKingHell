"use client";

import { AppErrorState } from "@/components/app/app-error-state";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";

export default function AnalysisWorkspaceError({ retry }: { retry: () => void }) {
  return (
    <PageShell>
      <AppErrorState
        title="Analysis workspace unavailable"
        description="Your saved analysis has not changed. Retry the workspace to load its evidence."
        action={
          <Button type="button" variant="outline" onClick={retry}>
            Retry
          </Button>
        }
      />
    </PageShell>
  );
}
