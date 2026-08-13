"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import type { CourseScorecardSvg } from "@/components/course-scorecard-svg";

const CourseScorecard = dynamic(
  () => import("@/components/course-scorecard-svg").then((module) => module.CourseScorecardSvg),
  {
    ssr: false,
    loading: () => <div className="min-h-64 rounded-lg bg-slate-950" aria-hidden />,
  },
);

export function LazyCourseScorecard(props: ComponentProps<typeof CourseScorecardSvg>) {
  return <CourseScorecard {...props} />;
}
