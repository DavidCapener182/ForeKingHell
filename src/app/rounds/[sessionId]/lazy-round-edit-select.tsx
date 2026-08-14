"use client";

import dynamic from "next/dynamic";

import type { RoundEditSelectProps } from "@/app/rounds/[sessionId]/round-edit-select";

const RoundEditSelect = dynamic<RoundEditSelectProps>(() =>
  import("@/app/rounds/[sessionId]/round-edit-select").then((module) => module.RoundEditSelect),
);

export function LazyRoundEditSelect(props: RoundEditSelectProps) {
  return <RoundEditSelect {...props} />;
}
