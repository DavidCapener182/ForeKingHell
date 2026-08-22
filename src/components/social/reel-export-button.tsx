"use client";

import { useEffect, useState, useTransition } from "react";
import { Clapperboard } from "lucide-react";

import { Button } from "@/components/ui/button";

type ReelExportButtonProps = {
  feedItemId: string;
  compact?: boolean;
};

export function ReelExportButton({ feedItemId, compact = false }: ReelExportButtonProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<"idle" | "ready" | "error">("idle");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsMounted(true), 0);

    return () => window.clearTimeout(timer);
  }, []);

  function exportReel() {
    startTransition(() => {
      void createExport();
    });
  }

  async function createExport() {
    setMessage("idle");

    try {
      const response = await fetch("/api/content-exports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourceType: "feed_item",
          sourceId: feedItemId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        imageUrl?: unknown;
        message?: unknown;
      } | null;

      if (!response.ok || typeof payload?.imageUrl !== "string") {
        throw new Error(typeof payload?.message === "string" ? payload.message : "Export failed.");
      }

      const url = new URL(payload.imageUrl, window.location.origin).toString();

      if (navigator.share) {
        await navigator.share({ title: "ForeKingHell Reel card", url }).catch(() => undefined);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }

      setMessage("ready");
      window.dispatchEvent(
        new CustomEvent("fkh:feedback", { detail: { sound: "success", haptic: "strong" } }),
      );
      window.setTimeout(() => setMessage("idle"), 1800);
    } catch {
      setMessage("error");
      window.setTimeout(() => setMessage("idle"), 2200);
    }
  }

  const label = !isMounted
    ? "Preparing Reel"
    : pending
      ? "Building Reel"
      : message === "ready"
        ? "Reel ready"
        : message === "error"
          ? "Try again"
          : "Export Reel";

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      onClick={exportReel}
      disabled={!isMounted || pending}
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      data-export-state={pending ? "building" : message}
      className={compact ? "bg-[#F5F6F4] text-[#0B7A3B]" : undefined}
    >
      <Clapperboard className="size-4" />
      {compact ? null : (
        <span
          key={label}
          className="t-text-state"
          data-motion-ready={isMounted && (pending || message !== "idle") ? "true" : "false"}
        >
          {label}
        </span>
      )}
    </Button>
  );
}
