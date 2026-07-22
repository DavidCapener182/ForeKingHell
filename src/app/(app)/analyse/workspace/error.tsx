"use client";

import { RouteErrorState } from "@/components/route-state";

export default function AnalysisWorkspaceError({ reset }: { reset: () => void }) {
  return <RouteErrorState title="Analysis workspace unavailable" onRetry={reset} />;
}
