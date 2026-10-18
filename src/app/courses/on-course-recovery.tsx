"use client";

import Link from "next/link";
import { AppErrorState } from "@/components/app/app-error-state";
import { Button } from "@/components/ui/button";

export type OnCourseArea = "courses" | "rounds" | "play" | "records" | "lab";
const recovery = {
  courses: {
    title: "Course details could not be loaded",
    description:
      "Retry this course view, or return to your course library to choose another course.",
    retryLabel: "Retry course view",
    href: "/courses",
    label: "Course library",
  },
  rounds: {
    title: "Your rounds could not be loaded",
    description:
      "Retry this round view, or return to saved round history. Open saved golf if your connection is unavailable.",
    retryLabel: "Retry round view",
    href: "/rounds",
    label: "Round history",
  },
  play: {
    title: "Play could not be prepared",
    description:
      "Retry your course setup or Course Twin. You can also return to the course library and open its mapped holes without the 3D view.",
    retryLabel: "Retry play",
    href: "/courses",
    label: "Course library",
  },
  records: {
    title: "Course records could not be loaded",
    description:
      "Retry this board, or review your saved round evidence before returning to the record page.",
    retryLabel: "Retry record view",
    href: "/rounds",
    label: "Saved rounds",
  },
  lab: {
    title: "Performance Lab could not be loaded",
    description:
      "Retry the analysis, or review your saved shots and club evidence while this view is unavailable.",
    retryLabel: "Retry Performance Lab",
    href: "/bag",
    label: "Bag evidence",
  },
} as const;

export function OnCourseRecovery({ area, retry }: { area: OnCourseArea; retry: () => void }) {
  const content = recovery[area];
  return (
    <main
      id="main-content"
      className="grid min-w-0 gap-4 px-4 py-6 pb-32 sm:px-6 lg:px-8"
      aria-label={`${content.title} recovery`}
    >
      <AppErrorState
        title={<h1>{content.title}</h1>}
        description={content.description}
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-11" onClick={retry}>
              {content.retryLabel}
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={content.href}>{content.label}</Link>
            </Button>
            {area === "rounds" || area === "play" ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/offline">Open saved golf</Link>
              </Button>
            ) : null}
          </div>
        }
      />
    </main>
  );
}
