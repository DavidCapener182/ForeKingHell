"use client";

import dynamic from "next/dynamic";

import type { RoundMapHole, RoundMapShot } from "@/app/rounds/[sessionId]/round-shot-map";
import { Spinner } from "@/components/ui/spinner";

const RoundShotMap = dynamic(
  () => import("@/app/rounds/[sessionId]/round-shot-map").then((module) => module.RoundShotMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="grid min-h-[32rem] place-items-center rounded-xl bg-slate-950 px-6 text-center text-sm font-medium text-slate-300"
        role="status"
      >
        <span className="grid place-items-center gap-3">
          <Spinner className="size-6 text-emerald-300" />
          Loading the interactive round map…
        </span>
      </div>
    ),
  },
);

export function LazyRoundShotMap({
  holes,
  shots,
  courseName,
  shotMode = "actual",
}: {
  holes: RoundMapHole[];
  shots: RoundMapShot[];
  courseName: string;
  shotMode?: "actual" | "estimated";
}) {
  return <RoundShotMap holes={holes} shots={shots} courseName={courseName} shotMode={shotMode} />;
}
