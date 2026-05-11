"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Award, ExternalLink, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ACHIEVEMENT_UNLOCK_FLASH_COOKIE,
} from "@/lib/achievements/notification-cookie";
import type { AchievementUnlockNotification } from "@/lib/achievements/types";
import { cn } from "@/lib/utils";

const ACHIEVEMENT_UNLOCK_EVENT = "fkh:achievement-unlocks";
const AUTO_DISMISS_MS = 12000;
const MAX_VISIBLE_TOASTS = 3;
const MAX_ITEMS_PER_TOAST = 4;

type AchievementUnlockEvent = CustomEvent<AchievementUnlockNotification[]>;

type AchievementToast = {
  id: string;
  notifications: AchievementUnlockNotification[];
  totalCount: number;
};

type Props = {
  children: React.ReactNode;
  initialNotifications: AchievementUnlockNotification[];
};

export function notifyAchievementUnlocks(
  notifications: AchievementUnlockNotification[],
) {
  if (typeof window === "undefined" || notifications.length === 0) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(ACHIEVEMENT_UNLOCK_EVENT, { detail: notifications }),
  );
}

export function AchievementNotificationProvider({
  children,
  initialNotifications,
}: Props) {
  const [toasts, setToasts] = useState<AchievementToast[]>([]);
  const seenNotificationKeys = useRef(new Set<string>());
  const initialSignature = useMemo(
    () => notificationSignature(initialNotifications),
    [initialNotifications],
  );

  const pushNotifications = useCallback(
    (notifications: AchievementUnlockNotification[]) => {
      const freshNotifications = notifications.filter((notification) => {
        const key = notificationKey(notification);

        if (seenNotificationKeys.current.has(key)) {
          return false;
        }

        seenNotificationKeys.current.add(key);
        return true;
      });

      if (freshNotifications.length === 0) {
        return;
      }

      const toast: AchievementToast = {
        id: `${Date.now()}-${freshNotifications.map((notification) => notification.achievementId).join("-")}`,
        notifications: freshNotifications.slice(0, MAX_ITEMS_PER_TOAST),
        totalCount: freshNotifications.length,
      };

      setToasts((current) => [toast, ...current].slice(0, MAX_VISIBLE_TOASTS));
    },
    [],
  );

  useEffect(() => {
    if (initialNotifications.length === 0) {
      return;
    }

    pushNotifications(initialNotifications);
    clearFlashCookie();
  }, [initialNotifications, initialSignature, pushNotifications]);

  useEffect(() => {
    function handleAchievementUnlock(event: Event) {
      const notifications = (event as AchievementUnlockEvent).detail;

      if (Array.isArray(notifications)) {
        pushNotifications(notifications);
      }
    }

    window.addEventListener(ACHIEVEMENT_UNLOCK_EVENT, handleAchievementUnlock);
    return () => window.removeEventListener(ACHIEVEMENT_UNLOCK_EVENT, handleAchievementUnlock);
  }, [pushNotifications]);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1));
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timeout);
  }, [toasts]);

  return (
    <>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 top-24 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3"
      >
        {toasts.map((toast) => (
          <AchievementToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => {
              setToasts((current) => current.filter((item) => item.id !== toast.id));
            }}
          />
        ))}
      </div>
    </>
  );
}

function AchievementToastCard({
  toast,
  onDismiss,
}: {
  toast: AchievementToast;
  onDismiss: () => void;
}) {
  const hiddenCount = toast.totalCount - toast.notifications.length;

  return (
    <div className="pointer-events-auto overflow-hidden rounded-[8px] border border-emerald-300 bg-[#0f172a] text-white shadow-2xl">
      <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-emerald-400/15 text-emerald-300">
          <Award className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {toast.totalCount === 1 ? "Achievement unlocked" : `${toast.totalCount} achievements unlocked`}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-slate-300">
            XP has been added and the latest unlocks are in Achievements.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={onDismiss}
          aria-label="Dismiss achievement notification"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="space-y-2 px-4 py-3">
        {toast.notifications.map((notification) => (
          <div
            key={notificationKey(notification)}
            className="rounded-[8px] border border-white/10 bg-white/5 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium">{notification.name}</p>
              <Badge className={cn("shrink-0 border capitalize", tierToastStyles[notification.tier])}>
                {notification.tier}
              </Badge>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-300">
              <span className="truncate">{notification.description}</span>
              <span className="shrink-0 font-medium text-emerald-300">
                +{notification.xpAwarded.toLocaleString("en-GB")} XP
              </span>
            </div>
          </div>
        ))}
        {hiddenCount > 0 ? (
          <p className="px-1 text-xs text-slate-300">
            +{hiddenCount.toLocaleString("en-GB")} more unlocks
          </p>
        ) : null}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
        >
          <Link href="/achievements">
            View achievements
            <ExternalLink className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

const tierToastStyles = {
  bronze: "border-amber-400/30 bg-amber-400/15 text-amber-100",
  silver: "border-slate-300/30 bg-slate-300/15 text-slate-100",
  gold: "border-yellow-300/30 bg-yellow-300/15 text-yellow-100",
  platinum: "border-cyan-300/30 bg-cyan-300/15 text-cyan-100",
  diamond: "border-indigo-300/30 bg-indigo-300/15 text-indigo-100",
  hidden: "border-zinc-300/30 bg-zinc-300/15 text-zinc-100",
} as const;

function notificationKey(notification: AchievementUnlockNotification) {
  return `${notification.achievementId}:${notification.unlockedAt}`;
}

function notificationSignature(notifications: AchievementUnlockNotification[]) {
  return notifications.map(notificationKey).join("|");
}

function clearFlashCookie() {
  document.cookie = `${ACHIEVEMENT_UNLOCK_FLASH_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
}
