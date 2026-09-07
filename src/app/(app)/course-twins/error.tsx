"use client";
import Link from "next/link";
import { AppErrorState } from "@/components/app/app-error-state";
import { Button } from "@/components/ui/button";
export default function CourseTwinsError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section className="p-4 pb-40" role="alert">
      <AppErrorState
        title="Course Twins could not be loaded"
        description="The catalogue is temporarily unavailable. Retry to check your available packages, or open your course records."
        action={
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" onClick={retry}>
              Retry catalogue
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/courses">Open courses</Link>
            </Button>
          </div>
        }
      />
    </section>
  );
}
