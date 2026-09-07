"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useState, type ComponentProps } from "react";
import type { FutureBagSlider as FutureBagSliderComponent } from "./future-bag-slider";

const FutureBagSlider = dynamic(
  () => import("./future-bag-slider").then((module) => module.FutureBagSlider),
  { loading: () => <p role="status">Loading carry projection…</p> },
);

/** Keep explored projections mounted when moving between Speed Centre sections. */
export function LazyFutureBagSlider(props: ComponentProps<typeof FutureBagSliderComponent>) {
  const query = useSearchParams();
  const active = query.get("tab") === "evidence";
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return active || visited ? <FutureBagSlider {...props} /> : null;
}
