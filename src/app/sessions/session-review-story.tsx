"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import type { MobileSessionStory } from "./mobile-session-story";

const Story = dynamic(
  () => import("./mobile-session-story").then((module) => module.MobileSessionStory),
  { loading: () => <p role="status">Loading club results…</p> },
);

/** Load the club carousel when its task is first opened, then preserve its position. */
export function SessionReviewStory(props: ComponentProps<typeof MobileSessionStory>) {
  const query = useSearchParams();
  const active = query.get("tab") === "clubs";
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return active || visited ? <Story {...props} /> : null;
}
