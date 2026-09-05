"use client";

import { SegmentErrorState } from "@/components/segment-error-state";

export default function AuthenticatedRouteError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <SegmentErrorState {...props} />;
}
