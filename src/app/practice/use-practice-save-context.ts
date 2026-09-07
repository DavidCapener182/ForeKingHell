"use client";
import { useRef } from "react";
import type { PracticePlan } from "@/lib/practice-planner";
/** Reuse one creation identity for retries of the same unchanged draft. */
export function usePracticeSaveContext(goalId?: string) {
  const attempt = useRef<{ fingerprint: string; creationId: string } | null>(null);
  return {
    forPlan(plan: PracticePlan) {
      const fingerprint = JSON.stringify({ plan, goalId });
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, creationId: crypto.randomUUID() };
      return { goalId, creationId: attempt.current.creationId };
    },
    saved() {
      attempt.current = null;
    },
  };
}
