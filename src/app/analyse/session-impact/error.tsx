"use client";

import { RouteErrorState } from "@/components/route-state";

export default function Error({ reset }: { reset: () => void }) {
  return <RouteErrorState title="Session impact could not load" onRetry={reset} />;
}
