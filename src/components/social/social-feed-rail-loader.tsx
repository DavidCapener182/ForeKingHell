"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isHiddenRoute } from "./social-feed-routes";

const Rail = dynamic(() => import("./social-feed-rail").then((module) => module.SocialFeedRail), {
  ssr: false,
});

/** Analytical routes never mount or download the unused social preview. */
export function SocialFeedRailLoader() {
  const pathname = usePathname();
  return pathname && !isHiddenRoute(pathname) ? <Rail key={pathname} /> : null;
}
