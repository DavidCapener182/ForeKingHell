"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { syncCoachDrillsAction } from "@/app/coach/actions";
import { notifyAchievementUnlocks } from "@/components/achievement-notifications";

export function CoachDrillAutoSync({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const hasRun = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled || hasRun.current) {
      return;
    }

    hasRun.current = true;

    startTransition(async () => {
      const result = await syncCoachDrillsAction();

      if (result.notifications.length > 0) {
        notifyAchievementUnlocks(result.notifications);
      }

      router.refresh();
    });
  }, [enabled, router]);

  return null;
}
