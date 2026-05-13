"use client";

import { useEffect, useState } from "react";

import { GolfLoader } from "@/components/visuals/golf-loader";

export function DelayedGolfLoader({
  label,
  className,
  delayMs = 900,
}: {
  label: string;
  className?: string;
  delayMs?: number;
}) {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowLoader(true);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs]);

  if (!showLoader) {
    return null;
  }

  return <GolfLoader label={label} className={className} />;
}
