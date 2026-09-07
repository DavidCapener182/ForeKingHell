"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

import { syncCoachDrillsAction } from "@/app/coach/actions";
import { notifyAchievementUnlocks } from "@/components/achievement-notifications";

export function CoachDrillAutoSync({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const hasRun = useRef(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled || hasRun.current) {
      return;
    }

    hasRun.current = true;

    startTransition(async () => {
      try {
        const result = await syncCoachDrillsAction();

        if (result.notifications.length > 0) {
          notifyAchievementUnlocks(result.notifications);
        }

        setError(false);
        router.refresh();
      } catch {
        setError(true);
      }
    });
  }, [enabled, router, attempt]);

  if (!enabled) return null;
  return (
    <div role="status" className="text-sm">
      {pending ? (
        "Checking saved drill awards… Your practice plan is unchanged."
      ) : error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <span>Drill awards could not sync. This does not save or change your practice plan.</span>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              hasRun.current = false;
              setAttempt((value) => value + 1);
            }}
          >
            Retry drill sync
          </Button>
        </div>
      ) : null}
    </div>
  );
}
