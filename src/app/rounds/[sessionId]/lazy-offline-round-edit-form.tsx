"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import type { OfflineRoundEditForm as OfflineRoundEditFormComponent } from "@/components/offline-round-edit-form";

type OfflineRoundEditFormProps = ComponentProps<typeof OfflineRoundEditFormComponent>;

const OfflineRoundEditForm = dynamic<OfflineRoundEditFormProps>(() =>
  import("@/components/offline-round-edit-form").then((module) => module.OfflineRoundEditForm),
);

export function LazyOfflineRoundEditForm(props: OfflineRoundEditFormProps) {
  return <OfflineRoundEditForm {...props} />;
}
