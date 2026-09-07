"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NotificationTone = "green" | "amber" | "blue" | "slate";

type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: NotificationTone;
  unread: boolean;
  createdAt?: string;
};

export function NotificationCentre({ embedded = false }: { embedded?: boolean }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const pendingWrite = useRef(false);
  const unreadCount = notifications.filter((item) => item.unread).length;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/desktop-workbench/notifications", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("unavailable");
        const payload: unknown = await response.json();
        if (!controller.signal.aborted) {
          setNotifications(normalizeNotificationItems(payload));
          setError(null);
          setLoaded(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Notifications could not be loaded. Try again.");
          setLoaded(true);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  async function markRead(ids: string[]) {
    if (pendingWrite.current || !ids.length) return;
    pendingWrite.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/desktop-workbench/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error("save failed");
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !Array.isArray(payload.readIds))
        throw new Error("invalid read state");
      const readIds = new Set(payload.readIds);
      setNotifications((items) =>
        items.map((item) => (readIds.has(item.id) ? { ...item, unread: false } : item)),
      );
      setError(null);
    } catch {
      setError("Read status could not be saved. Your notifications remain unread; try again.");
    } finally {
      pendingWrite.current = false;
      setSaving(false);
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant={embedded ? "ghost" : "outline"}
          size={embedded ? "default" : "icon"}
          className={cn("relative min-h-11", embedded && "w-full justify-start")}
          aria-label={
            unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : "Open notifications"
          }
        >
          <Bell className="size-4" aria-hidden />
          {embedded ? <span>Notifications</span> : null}
          <span
            className="t-badge absolute -right-1 -top-1"
            data-open={unreadCount > 0 ? "true" : "false"}
            aria-hidden="true"
          >
            <span className="t-badge-dot rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-lg" aria-busy={saving}>
        <SheetHeader className="border-b pr-14">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            {!loaded
              ? "Checking updates…"
              : error
                ? "Some updates need attention."
                : `${unreadCount} unread`}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          {error ? (
            <div
              role="alert"
              className="grid gap-2 rounded-lg border border-destructive p-3 text-sm"
            >
              <p>{error}</p>
              <Button variant="outline" onClick={() => setReload((value) => value + 1)}>
                Retry notifications
              </Button>
            </div>
          ) : null}
          {!loaded ? (
            <p role="status">Loading your updates…</p>
          ) : notifications.length ? (
            notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                saving={saving}
                onMarkRead={(id) => void markRead([id])}
              />
            ))
          ) : !error ? (
            <NotificationStatus
              title="No new alerts"
              detail="Friend requests, challenge invites, imports and data warnings will appear here."
            />
          ) : null}
        </div>
        <SheetFooter className="shrink-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            disabled={saving || !unreadCount}
            onClick={() =>
              void markRead(notifications.filter((item) => item.unread).map((item) => item.id))
            }
          >
            {saving ? "Saving read status…" : "Mark all read"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings">Notification preferences</Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
  saving,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
  saving: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-lg border bg-card",
        notification.unread ? "border-primary/35" : "border-border",
      )}
    >
      <Link
        href={notification.href}
        prefetch={false}
        onClick={() => onMarkRead(notification.id)}
        className="focus-aaa grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-l-lg p-3 outline-none hover:bg-muted"
      >
        <span
          className={cn(
            "mt-1 size-2 rounded-full",
            notification.unread
              ? notificationToneClass(notification.tone)
              : "bg-muted-foreground/45",
          )}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="break-words text-sm font-semibold">{notification.title}</span>
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
        {notification.createdAt && Number.isFinite(Date.parse(notification.createdAt)) ? (
          <time
            dateTime={notification.createdAt}
            className="col-start-2 text-xs text-muted-foreground"
          >
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date(notification.createdAt))}
          </time>
        ) : null}
        <ArrowRight className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
      </Link>
      <div className="grid min-w-[4.25rem] place-items-center border-l border-border px-2">
        {notification.unread ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            disabled={saving}
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
    <div className="rounded-lg border border-dashed border-border bg-muted/35 p-3">
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

function normalizeNotificationItem(value: unknown): NotificationItem | null {
  if (!isRecord(value)) return null;

  const id = cleanText(value.id, 80);
  const title = cleanText(value.title, 100);
  const detail = cleanText(value.detail, 180);
  const href = cleanHref(value.href);
  const tone = isNotificationTone(value.tone) ? value.tone : "slate";

  if (!id || !title || !detail || !href) return null;
  return {
    id,
    title,
    detail,
    href,
    tone,
    unread: value.unread === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
  };
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
  if (tone === "green") return "bg-[var(--confidence-high)]";
  if (tone === "amber") return "bg-[var(--confidence-medium)]";
  if (tone === "blue") return "bg-[var(--chart-2)]";
  return "bg-muted-foreground";
}
