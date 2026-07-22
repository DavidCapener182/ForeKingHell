"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NotificationTone = "green" | "amber" | "blue" | "slate";

type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: NotificationTone;
  unread: boolean;
};

const notificationReadStorageKey = "fkh:desktop-notification-read-ids";

export function NotificationCentre({ embedded = false }: { embedded?: boolean }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const readNotificationIdsRef = useRef<Set<string>>(new Set());
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  useEffect(() => {
    const controller = new AbortController();
    const storedReadIds = readNotificationReadIds();
    readNotificationIdsRef.current = storedReadIds;

    async function loadNotifications() {
      try {
        const response = await fetch("/api/desktop-workbench/notifications", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          if (!controller.signal.aborted) {
            setNotifications([]);
            setLoaded(true);
          }
          return;
        }

        const payload: unknown = await response.json();
        if (!controller.signal.aborted) {
          setNotifications(
            applyNotificationReadIds(normalizeNotificationItems(payload), storedReadIds),
          );
          setLoaded(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setNotifications([]);
          setLoaded(true);
        }
      }
    }

    void loadNotifications();

    return () => controller.abort();
  }, []);

  function markNotificationRead(id: string) {
    setNotifications((items) =>
      items.map((notification) =>
        notification.id === id ? { ...notification, unread: false } : notification,
      ),
    );
    const next = new Set(readNotificationIdsRef.current);
    next.add(id);
    readNotificationIdsRef.current = next;
    writeNotificationReadIds(next);
  }

  function markAllNotificationsRead() {
    if (notifications.length === 0) return;

    setNotifications((items) => items.map((notification) => ({ ...notification, unread: false })));
    const next = new Set(readNotificationIdsRef.current);

    for (const notification of notifications) next.add(notification.id);

    readNotificationIdsRef.current = next;
    writeNotificationReadIds(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={embedded ? "ghost" : "outline"}
          size={embedded ? "default" : "icon"}
          className={cn("relative", embedded && "w-full justify-start")}
          aria-label={
            unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : "Open notifications"
          }
        >
          <Bell className="size-4" />
          {embedded ? <span>Notifications</span> : null}
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-emerald-700 px-1 text-[10px] font-semibold leading-4 text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {unreadCount > 0 ? `${unreadCount} unread` : "All clear"}
            </Badge>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={(event) => {
                  event.stopPropagation();
                  markAllNotificationsRead();
                }}
              >
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="grid gap-2 p-1">
          {!loaded ? (
            <NotificationStatus title="Checking updates" detail="Loading golf workspace signals." />
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onMarkRead={markNotificationRead}
              />
            ))
          ) : (
            <NotificationStatus
              title="No new alerts"
              detail="Friend requests, challenge invites, imports and data warnings will appear here."
            />
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-lg border bg-white/74",
        notification.unread ? "border-emerald-200" : "border-border",
      )}
    >
      <Link
        href={notification.href}
        prefetch={false}
        onClick={() => onMarkRead(notification.id)}
        className="focus-aaa grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-l-lg p-3 outline-none hover:bg-white"
      >
        <span
          className={cn(
            "mt-1 size-2 rounded-full",
            notification.unread ? notificationToneClass(notification.tone) : "bg-slate-300",
          )}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold">{notification.title}</span>
            {notification.unread ? (
              <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
                New
              </Badge>
            ) : null}
          </span>
          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
            {notification.detail}
          </span>
        </span>
        <ArrowRight className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
      </Link>
      <div className="grid min-w-[4.25rem] place-items-center border-l border-border px-2">
        {notification.unread ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onMarkRead(notification.id)}
          >
            Mark read
          </Button>
        ) : (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            Read
          </Badge>
        )}
      </div>
    </div>
  );
}

function NotificationStatus({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white/60 p-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function normalizeNotificationItems(payload: unknown): NotificationItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.items)) return [];

  return payload.items
    .map((item) => normalizeNotificationItem(item))
    .filter((item): item is NotificationItem => Boolean(item))
    .slice(0, 8);
}

function applyNotificationReadIds(notifications: NotificationItem[], readIds: Set<string>) {
  if (readIds.size === 0) return notifications;
  return notifications.map((notification) =>
    readIds.has(notification.id) ? { ...notification, unread: false } : notification,
  );
}

function readNotificationReadIds() {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(notificationReadStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(
      parsed.filter((item): item is string => typeof item === "string" && item.length > 0),
    );
  } catch {
    return new Set<string>();
  }
}

function writeNotificationReadIds(readIds: Set<string>) {
  try {
    window.localStorage.setItem(
      notificationReadStorageKey,
      JSON.stringify(Array.from(readIds).slice(-80)),
    );
  } catch {
    // Local storage is optional desktop polish; ignore private-mode failures.
  }
}

function normalizeNotificationItem(value: unknown): NotificationItem | null {
  if (!isRecord(value)) return null;

  const id = cleanText(value.id, 80);
  const title = cleanText(value.title, 100);
  const detail = cleanText(value.detail, 180);
  const href = cleanHref(value.href);
  const tone = isNotificationTone(value.tone) ? value.tone : "slate";

  if (!id || !title || !detail || !href) return null;
  return { id, title, detail, href, tone, unread: value.unread === true };
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanHref(value: unknown) {
  if (typeof value !== "string") return "";
  const href = value.trim();
  return href.startsWith("/") && !href.startsWith("//") ? href.slice(0, 220) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNotificationTone(value: unknown): value is NotificationTone {
  return value === "green" || value === "amber" || value === "blue" || value === "slate";
}

function notificationToneClass(tone: NotificationTone) {
  if (tone === "green") return "bg-emerald-500";
  if (tone === "amber") return "bg-amber-500";
  if (tone === "blue") return "bg-blue-500";
  return "bg-slate-400";
}
