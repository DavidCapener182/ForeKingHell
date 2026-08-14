"use client";

import { useEffect, useState } from "react";
import { Check, Pin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SavedInsightLink = {
  title: string;
  href: string;
  detail: string;
  group?: string;
};

const savedInsightStorageKey = "fkh:desktop-saved-insights";
export const savedInsightUpdatedEvent = "fkh:desktop-saved-insights-updated";

export function DesktopSaveInsightButton({
  title,
  detail,
  group = "Saved insight",
  className,
}: {
  title: string;
  detail: string;
  group?: string;
  className?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    function syncSavedState() {
      const href = currentHref();
      setSaved(readSavedInsights().some((link) => link.href === href));
    }

    const timer = window.setTimeout(() => {
      setHydrated(true);
      syncSavedState();
    }, 0);
    window.addEventListener(savedInsightUpdatedEvent, syncSavedState);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(savedInsightUpdatedEvent, syncSavedState);
    };
  }, []);

  function saveInsight() {
    const href = currentHref();
    const existing = readSavedInsights();
    const next = [
      normalizeInsightLink({
        title,
        href,
        detail,
        group,
      }),
      ...existing.filter((link) => link.href !== href),
    ]
      .filter((link): link is SavedInsightLink => link !== null)
      .slice(0, 12);

    try {
      window.localStorage.setItem(savedInsightStorageKey, JSON.stringify(next));
    } catch {
      return;
    }

    setSaved(true);
    window.dispatchEvent(new CustomEvent(savedInsightUpdatedEvent));
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={saveInsight}
      disabled={!hydrated}
      data-save-insight-hydrated={hydrated ? "true" : "false"}
      className={cn(
        "focus-aaa grid h-auto min-h-11 grid-cols-[auto_minmax(0,1fr)] items-center justify-start gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold outline-none",
        saved
          ? "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)]"
          : "border-border bg-card/80 hover:border-primary/40 hover:bg-card",
        className,
      )}
    >
      {saved ? (
        <Check className="size-4 text-primary" aria-hidden />
      ) : (
        <Pin className="size-4 text-primary" aria-hidden />
      )}
      <span>{saved ? "Insight saved" : "Save this insight"}</span>
    </Button>
  );
}

function currentHref() {
  return `${window.location.pathname}${window.location.search}` || "/";
}

function readSavedInsights() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(savedInsightStorageKey) ?? "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizeInsightLink(item))
      .filter((item): item is SavedInsightLink => item !== null);
  } catch {
    return [];
  }
}

function normalizeInsightLink(value: unknown): SavedInsightLink | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<SavedInsightLink>;

  if (
    typeof candidate.title !== "string" ||
    typeof candidate.href !== "string" ||
    typeof candidate.detail !== "string" ||
    !candidate.href.startsWith("/")
  ) {
    return null;
  }

  return {
    title: candidate.title.slice(0, 80),
    href: candidate.href.slice(0, 180),
    detail: candidate.detail.slice(0, 120),
    group: typeof candidate.group === "string" ? candidate.group.slice(0, 40) : undefined,
  };
}
