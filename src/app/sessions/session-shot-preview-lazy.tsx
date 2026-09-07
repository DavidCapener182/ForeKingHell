"use client";
import dynamic from "next/dynamic";

// The evidence workflow is downloaded when requested, rather than by every history row.
export const SessionShotPreview = dynamic(
  () => import("./session-shot-preview-body").then((module) => module.SessionShotPreview),
  { loading: () => <p role="status">Loading shot evidence…</p> },
);
