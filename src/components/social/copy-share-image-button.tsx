"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopyShareImageButton({ href }: { href: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimerRef = useRef<number | null>(null);
  const copied = copyStatus === "copied";
  const label = copied ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy share image";

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  async function copyShareImage() {
    const url = new URL(href, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
      resetTimerRef.current = null;
    }, 1500);
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => void copyShareImage()}>
        <span className="t-icon-swap" data-state={copied ? "b" : "a"} aria-hidden="true">
          <span className="t-icon" data-icon="a">
            <Copy className="size-4" />
          </span>
          <span className="t-icon" data-icon="b">
            <Check className="size-4" />
          </span>
        </span>
        <span
          key={copyStatus}
          className="t-text-state"
          data-motion-ready={copyStatus !== "idle" ? "true" : "false"}
        >
          {label}
        </span>
      </Button>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {copied
          ? "Share image link copied."
          : copyStatus === "failed"
            ? "Share image link could not be copied."
            : ""}
      </span>
    </>
  );
}
