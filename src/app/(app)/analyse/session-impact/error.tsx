"use client";

import { AppErrorState } from "@/components/app/app-error-state";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";

export default function Error({ retry }: { retry: () => void }) {
  return (
    <PageShell>
      <AppErrorState
        title="Session impact could not load"
        description="No session evidence was changed. Retry the comparison to load it again."
        action={
          <Button type="button" variant="outline" onClick={retry}>
            Retry
          </Button>
        }
      />
    </PageShell>
  );
}
