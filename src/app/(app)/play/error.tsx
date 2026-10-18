"use client";

import { OnCourseRecovery } from "@/app/courses/on-course-recovery";

export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <OnCourseRecovery area="play" retry={retry} />;
}
