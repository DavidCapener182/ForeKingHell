"use client";

import dynamic from "next/dynamic";

import type {
  CourseTwinManifest,
  CourseTwinReplayDocument,
} from "@/lib/course-twin-contract";

const CourseTwinScene = dynamic(
  () => import("./course-twin-scene").then((module) => module.CourseTwinScene),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[560px] place-items-center bg-[#07150e] text-sm text-emerald-100">
        Preparing the Course Twin renderer…
      </div>
    ),
  },
);

export function CourseTwinRuntime({
  manifest,
  replay,
}: {
  manifest: CourseTwinManifest;
  replay: CourseTwinReplayDocument | null;
}) {
  return <CourseTwinScene manifest={manifest} replay={replay} />;
}
