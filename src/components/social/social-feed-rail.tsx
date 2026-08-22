"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  Loader2,
  MessageCircle,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  ThumbsUp,
  Zap,
} from "lucide-react";

import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Item } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

type SocialFeedPreviewItem = {
  id: string;
  userId: string;
  itemType: string;
  headline: string;
  metricLabel: string | null;
  metricValue: string | null;
  context: string | null;
  proofUrl: string | null;
  visibility: "private" | "friends" | "public";
  verificationLabel: string;
  createdAt: string;
  profile: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
  };
  reactionCount: number;
  commentCount: number;
  viewerReacted: boolean;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    likeCount: number;
    viewerLiked: boolean;
    viewerCanDelete: boolean;
    profile: {
      userId: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>;
};

type RailDayGroup = {
  key: string;
  label: string;
  items: SocialFeedPreviewItem[];
  xpGained: number;
  reactionCount: number;
  commentCount: number;
  typeSummaries: Array<{ type: string; label: string }>;
};

type FeedStatus = "loading" | "ready" | "error";

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/London",
});

const itemDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("en-GB");
const hiddenRoutePrefixes = [
  "/login",
  "/auth",
  "/privacy",
  "/play",
  "/share",
  "/shared",
  "/settings/invitations",
  "/feed",
  "/today",
  "/dashboard",
  "/sessions",
  "/progress",
  "/analyse",
  "/bag",
  "/rounds",
  "/strokes-gained",
  "/shots",
  "/compare",
  "/simulator-lab",
  "/speed",
  "/stats/training-over-time",
  "/equipment",
  "/handicap",
  "/courses",
  "/course-records",
  "/tournaments",
  "/practice",
  "/coach",
  "/data-chat",
  "/achievements",
  "/challenges",
  "/import",
  "/rapsodo",
  "/providers",
  "/billing",
  "/settings",
  "/admin",
  "/partners",
];
const seenStorageKey = "fkh-social-feed-seen-at";

export function SocialFeedRail() {
  const pathname = usePathname();
  if (!pathname || isHiddenRoute(pathname)) {
    return null;
  }

  return <SocialFeedRailContent key={pathname} />;
}

function SocialFeedRailContent() {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const hasLoadedFeedRef = useRef(false);
  const isMobile = useIsMobile();
  const [status, setStatus] = useState<FeedStatus>("ready");
  const [items, setItems] = useState<SocialFeedPreviewItem[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [commentingItemId, setCommentingItemId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
  const groups = useMemo(() => groupItemsByDayAndUser(items), [items]);

  useEffect(() => {
    if (status !== "loading") {
      return;
    }

    let active = true;

    fetch("/api/social/feed-preview", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Feed preview unavailable.");
        }

        return response.json() as Promise<{ items: SocialFeedPreviewItem[] }>;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        hasLoadedFeedRef.current = true;
        setItems(payload.items);
        if (expandedRef.current) {
          markItemsSeen(payload.items);
          setNewCount(0);
        } else {
          const nextCount = countNewItems(payload.items);
          setNewCount(nextCount);
          if (nextCount > 0) setBadgeCount(nextCount);
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [status]);

  function openRail() {
    setRailOpen(true);
  }

  function setRailOpen(open: boolean) {
    expandedRef.current = open;
    if (open) {
      if (!hasLoadedFeedRef.current && status !== "loading") {
        setStatus("loading");
      }
      markItemsSeen(items);
      setNewCount(0);
    }
    setExpanded(open);
  }

  function refreshFeed() {
    setStatus("loading");
  }

  function updateItem(
    itemId: string,
    updater: (item: SocialFeedPreviewItem) => SocialFeedPreviewItem,
  ) {
    setItems((current) => current.map((item) => (item.id === itemId ? updater(item) : item)));
  }

  function updateComment(
    itemId: string,
    commentId: string,
    updater: (
      comment: SocialFeedPreviewItem["comments"][number],
    ) => SocialFeedPreviewItem["comments"][number],
  ) {
    updateItem(itemId, (item) => ({
      ...item,
      comments: item.comments.map((comment) =>
        comment.id === commentId ? updater(comment) : comment,
      ),
    }));
  }

  async function toggleReaction(item: SocialFeedPreviewItem) {
    const nextReacted = !item.viewerReacted;
    const reactionDelta = nextReacted ? 1 : -1;

    updateItem(item.id, (current) => ({
      ...current,
      viewerReacted: nextReacted,
      reactionCount: Math.max(0, current.reactionCount + reactionDelta),
    }));
    setBusyItemId(item.id);

    try {
      const response = await fetch("/api/social/feed-preview/reactions", {
        method: nextReacted ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ feedItemId: item.id }),
      });

      if (!response.ok) {
        throw new Error("Unable to update kudos.");
      }
    } catch {
      updateItem(item.id, (current) => ({
        ...current,
        viewerReacted: item.viewerReacted,
        reactionCount: item.reactionCount,
      }));
    } finally {
      setBusyItemId(null);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>, itemId: string) {
    event.preventDefault();
    const body = commentDrafts[itemId]?.trim();

    if (!body) {
      return;
    }

    setBusyItemId(itemId);

    try {
      const response = await fetch("/api/social/feed-preview/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ feedItemId: itemId, body }),
      });

      if (!response.ok) {
        throw new Error("Unable to post comment.");
      }

      updateItem(itemId, (item) => ({
        ...item,
        commentCount: item.commentCount + 1,
      }));
      setCommentDrafts((current) => ({ ...current, [itemId]: "" }));
      setCommentingItemId(null);
    } finally {
      setBusyItemId(null);
    }
  }

  async function toggleCommentReaction(
    itemId: string,
    comment: SocialFeedPreviewItem["comments"][number],
  ) {
    const nextLiked = !comment.viewerLiked;
    const likeDelta = nextLiked ? 1 : -1;

    updateComment(itemId, comment.id, (current) => ({
      ...current,
      viewerLiked: nextLiked,
      likeCount: Math.max(0, current.likeCount + likeDelta),
    }));
    setBusyCommentId(comment.id);

    try {
      const response = await fetch("/api/social/feed-preview/comment-reactions", {
        method: nextLiked ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ commentId: comment.id }),
      });

      if (!response.ok) {
        throw new Error("Unable to update comment like.");
      }
    } catch {
      updateComment(itemId, comment.id, () => comment);
    } finally {
      setBusyCommentId(null);
    }
  }

  async function deleteComment(itemId: string, comment: SocialFeedPreviewItem["comments"][number]) {
    updateItem(itemId, (item) => ({
      ...item,
      commentCount: Math.max(0, item.commentCount - 1),
      comments: item.comments.filter((candidate) => candidate.id !== comment.id),
    }));
    setBusyCommentId(comment.id);

    try {
      const response = await fetch("/api/social/feed-preview/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ commentId: comment.id }),
      });

      if (!response.ok) {
        throw new Error("Unable to delete comment.");
      }
    } catch {
      updateItem(itemId, (item) => ({
        ...item,
        commentCount: item.commentCount + 1,
        comments: [...item.comments, comment].sort(
          (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
        ),
      }));
    } finally {
      setBusyCommentId(null);
    }
  }

  const feedContent = (
    <SocialFeedPreviewContent
      busyCommentId={busyCommentId}
      busyItemId={busyItemId}
      commentingItemId={commentingItemId}
      commentDrafts={commentDrafts}
      groups={groups}
      status={status}
      onCommentDelete={deleteComment}
      onCommentDraftChange={(itemId, value) =>
        setCommentDrafts((current) => ({ ...current, [itemId]: value }))
      }
      onCommentReactionToggle={toggleCommentReaction}
      onCommentToggle={(itemId) =>
        setCommentingItemId((current) => (current === itemId ? null : itemId))
      }
      onReactionToggle={toggleReaction}
      onSubmitComment={submitComment}
    />
  );

  return (
    <aside aria-label="Social feed preview" className="print:hidden">
      <Button
        type="button"
        variant="outline"
        className="fixed bottom-5 right-5 z-40 hidden h-11 gap-2 rounded-full border-border bg-card px-4 text-card-foreground shadow-lg hover:bg-muted lg:inline-flex"
        onClick={openRail}
        aria-expanded={expanded}
        aria-controls="social-feed-preview"
        aria-label={
          newCount > 0 ? `Open social feed preview, ${newCount} new` : "Open social feed preview"
        }
      >
        <Radio className="size-4 text-primary" />
        <span className="lg:hidden">Feed</span>
        <span className="hidden lg:inline">Social feed</span>
        <span
          className="t-badge absolute -right-1 -top-1"
          data-open={newCount > 0 ? "true" : "false"}
          aria-hidden="true"
        >
          <span className="t-badge-dot rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            {badgeCount > 99 ? "99+" : numberFormatter.format(badgeCount)}
          </span>
        </span>
      </Button>

      {isMobile ? (
        <Drawer open={expanded} onOpenChange={setRailOpen}>
          <DrawerContent id="social-feed-preview" className="max-h-[86dvh]">
            <DrawerHeader className="text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DrawerTitle className="flex items-center gap-2">
                    <Radio className="size-4 text-primary" />
                    Social feed
                  </DrawerTitle>
                  <DrawerDescription>Daily digests match the full feed.</DrawerDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={refreshFeed}
                    aria-label="Refresh social feed"
                  >
                    {status === "loading" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                  </Button>
                  <DrawerClose asChild>
                    <Button type="button" variant="ghost" size="sm">
                      Close
                    </Button>
                  </DrawerClose>
                </div>
              </div>
            </DrawerHeader>
            <ScrollArea className="min-h-0 flex-1 px-3">{feedContent}</ScrollArea>
            <DrawerFooter>
              <Button asChild className="w-full">
                <Link href="/feed" prefetch={false}>
                  Open feed
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={expanded} onOpenChange={setRailOpen}>
          <SheetContent
            id="social-feed-preview"
            side="right"
            showCloseButton={false}
            className="w-[min(420px,calc(100vw-1rem))] max-w-none gap-0 p-0 sm:max-w-none"
          >
            <SheetHeader className="border-b border-border p-4 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="flex items-center gap-2">
                    <Radio className="size-4 text-primary" />
                    Social feed
                  </SheetTitle>
                  <SheetDescription>Daily digests match the full feed.</SheetDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={refreshFeed}
                    aria-label="Refresh social feed"
                  >
                    {status === "loading" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                  </Button>
                  <SheetClose asChild>
                    <Button type="button" variant="ghost" size="sm">
                      Close
                    </Button>
                  </SheetClose>
                </div>
              </div>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1 px-3 py-3">{feedContent}</ScrollArea>
            <SheetFooter className="border-t border-border p-3">
              <Button asChild className="w-full">
                <Link href="/feed" prefetch={false}>
                  Open feed
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </aside>
  );
}

function SocialFeedPreviewContent({
  busyCommentId,
  busyItemId,
  commentingItemId,
  commentDrafts,
  groups,
  status,
  onCommentDraftChange,
  onCommentDelete,
  onCommentReactionToggle,
  onCommentToggle,
  onReactionToggle,
  onSubmitComment,
}: {
  busyCommentId: string | null;
  busyItemId: string | null;
  commentingItemId: string | null;
  commentDrafts: Record<string, string>;
  groups: RailDayGroup[];
  status: FeedStatus;
  onCommentDraftChange: (itemId: string, value: string) => void;
  onCommentDelete: (itemId: string, comment: SocialFeedPreviewItem["comments"][number]) => void;
  onCommentReactionToggle: (
    itemId: string,
    comment: SocialFeedPreviewItem["comments"][number],
  ) => void;
  onCommentToggle: (itemId: string) => void;
  onReactionToggle: (item: SocialFeedPreviewItem) => void;
  onSubmitComment: (event: FormEvent<HTMLFormElement>, itemId: string) => void;
}) {
  if (status === "loading") {
    return (
      <div className="grid gap-2 py-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <Alert variant="destructive" className="my-3">
        <AlertDescription>Feed preview is unavailable.</AlertDescription>
      </Alert>
    );
  }

  if (groups.length === 0) {
    return (
      <Alert className="my-3">
        <AlertDescription>No visible activity yet.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-2 py-3">
      {groups.map((group) => (
        <RailDayDigest
          key={group.key}
          busyItemId={busyItemId}
          busyCommentId={busyCommentId}
          commentingItemId={commentingItemId}
          commentDrafts={commentDrafts}
          group={group}
          onCommentDraftChange={onCommentDraftChange}
          onCommentToggle={onCommentToggle}
          onReactionToggle={onReactionToggle}
          onCommentReactionToggle={onCommentReactionToggle}
          onCommentDelete={onCommentDelete}
          onSubmitComment={onSubmitComment}
        />
      ))}
    </div>
  );
}

function RailDayDigest({
  busyItemId,
  busyCommentId,
  commentingItemId,
  commentDrafts,
  group,
  onCommentDraftChange,
  onCommentDelete,
  onCommentReactionToggle,
  onCommentToggle,
  onReactionToggle,
  onSubmitComment,
}: {
  busyItemId: string | null;
  busyCommentId: string | null;
  commentingItemId: string | null;
  commentDrafts: Record<string, string>;
  group: RailDayGroup;
  onCommentDraftChange: (itemId: string, value: string) => void;
  onCommentDelete: (itemId: string, comment: SocialFeedPreviewItem["comments"][number]) => void;
  onCommentReactionToggle: (
    itemId: string,
    comment: SocialFeedPreviewItem["comments"][number],
  ) => void;
  onCommentToggle: (itemId: string) => void;
  onReactionToggle: (item: SocialFeedPreviewItem) => void;
  onSubmitComment: (event: FormEvent<HTMLFormElement>, itemId: string) => void;
}) {
  const firstItem = group.items[0];
  const achievements = group.items.filter((item) => item.itemType === "achievement_unlock");
  const nonAchievementHighlights = group.items.filter(
    (item) => item.itemType !== "achievement_unlock",
  );
  const highlights = (
    nonAchievementHighlights.length > 0 ? nonAchievementHighlights : achievements
  ).slice(0, 4);

  if (!firstItem) {
    return null;
  }

  return (
    <Card role="article" size="sm" className="gap-0 py-0 shadow-sm">
      <CardContent className="p-2.5">
        <header>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="gap-1">
                <CalendarDays className="size-3" />
                {group.label}
              </Badge>
              <Link
                href={`/profile/${firstItem.profile.username}`}
                prefetch={false}
                className="text-xs font-semibold hover:underline"
              >
                {firstItem.profile.displayName}
              </Link>
              <span className="text-xs text-muted-foreground">@{firstItem.profile.username}</span>
            </div>
            <p className="mt-2 font-semibold leading-5">
              {digestHeadline(group, achievements.length)}
            </p>
          </div>
        </header>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {group.xpGained > 0 ? (
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
              <Zap className="size-3" />+{numberFormatter.format(group.xpGained)} XP
            </Badge>
          ) : null}
          {group.typeSummaries.map((summary) => (
            <Badge key={summary.type} variant="outline">
              {summary.label}
            </Badge>
          ))}
        </div>

        <div className="mt-3 grid gap-2">
          {highlights.map((item) => (
            <RailActivityItem
              key={item.id}
              busy={busyItemId === item.id}
              busyCommentId={busyCommentId}
              commenting={commentingItemId === item.id}
              commentDraft={commentDrafts[item.id] ?? ""}
              item={item}
              onCommentDraftChange={(value) => onCommentDraftChange(item.id, value)}
              onCommentDelete={(comment) => onCommentDelete(item.id, comment)}
              onCommentReactionToggle={(comment) => onCommentReactionToggle(item.id, comment)}
              onCommentToggle={() => onCommentToggle(item.id)}
              onReactionToggle={() => onReactionToggle(item)}
              onSubmitComment={(event) => onSubmitComment(event, item.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RailActivityItem({
  busy,
  busyCommentId,
  commenting,
  commentDraft,
  item,
  onCommentDraftChange,
  onCommentDelete,
  onCommentReactionToggle,
  onCommentToggle,
  onReactionToggle,
  onSubmitComment,
}: {
  busy: boolean;
  busyCommentId: string | null;
  commenting: boolean;
  commentDraft: string;
  item: SocialFeedPreviewItem;
  onCommentDraftChange: (value: string) => void;
  onCommentDelete: (comment: SocialFeedPreviewItem["comments"][number]) => void;
  onCommentReactionToggle: (comment: SocialFeedPreviewItem["comments"][number]) => void;
  onCommentToggle: () => void;
  onReactionToggle: () => void;
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isStatusUpdate = item.itemType === "status_update";

  return (
    <Item variant="muted" className="block bg-secondary/70 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium leading-5">
            {isStatusUpdate ? "Status update" : item.headline}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {itemDateFormatter.format(new Date(item.createdAt))}
          </p>
        </div>
      </div>

      {item.metricValue ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{item.metricValue}</span>
          {item.metricLabel ? ` · ${item.metricLabel}` : ""}
        </p>
      ) : null}
      {item.context ? (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.context}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck className="size-3" />
          {item.verificationLabel}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          variant={item.viewerReacted ? "default" : "ghost"}
          size="xs"
          className="t-like [--like-color:currentColor]"
          data-liked={item.viewerReacted ? "true" : "false"}
          aria-pressed={item.viewerReacted}
          disabled={busy}
          onClick={onReactionToggle}
        >
          <span className="t-like-icon inline-flex" aria-hidden="true">
            <ThumbsUp className="t-like-heart size-3" />
          </span>
          {item.reactionCount > 0 ? item.reactionCount : "Kudos"}
        </Button>
        <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={onCommentToggle}>
          <MessageCircle className="size-3" />
          {item.commentCount > 0 ? item.commentCount : "Comment"}
        </Button>
      </div>

      {commenting ? (
        <div className="mt-2 grid gap-2">
          {item.comments.length > 0 ? (
            <div className="grid gap-1.5">
              {item.comments.map((comment) => (
                <div key={comment.id} className="rounded-lg bg-card px-2 py-1.5 text-xs">
                  <Link
                    href={`/profile/${comment.profile.username}`}
                    prefetch={false}
                    className="font-medium hover:underline"
                  >
                    {comment.profile.displayName}
                  </Link>
                  <p className="mt-0.5 text-muted-foreground">{comment.body}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant={comment.viewerLiked ? "secondary" : "ghost"}
                      size="xs"
                      className="t-like [--like-color:currentColor]"
                      data-liked={comment.viewerLiked ? "true" : "false"}
                      aria-pressed={comment.viewerLiked}
                      disabled={busyCommentId === comment.id}
                      onClick={() => onCommentReactionToggle(comment)}
                    >
                      <span className="t-like-icon inline-flex" aria-hidden="true">
                        <ThumbsUp className="t-like-heart size-3" />
                      </span>
                      Like {comment.likeCount > 0 ? comment.likeCount : ""}
                    </Button>
                    {comment.viewerCanDelete ? (
                      <ConfirmSubmitButton
                        type="button"
                        confirmMessage="Delete this feed comment? This removes it from the conversation."
                        variant="destructive"
                        size="xs"
                        disabled={busyCommentId === comment.id}
                        onClick={() => onCommentDelete(comment)}
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </ConfirmSubmitButton>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <form onSubmit={onSubmitComment} className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
            <Input
              value={commentDraft}
              onChange={(event) => onCommentDraftChange(event.target.value)}
              placeholder="Write a comment"
              className="h-8 rounded-lg bg-background text-xs"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !commentDraft.trim()}
              aria-label="Post comment"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            </Button>
          </form>
        </div>
      ) : null}
    </Item>
  );
}

function groupItemsByDayAndUser(items: SocialFeedPreviewItem[]): RailDayGroup[] {
  const grouped = new Map<string, SocialFeedPreviewItem[]>();

  for (const item of items) {
    const key = `${dayKeyFormatter.format(new Date(item.createdAt))}:${item.userId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return [...grouped.entries()]
    .map(([key, groupItems]) => {
      const sortedItems = [...groupItems].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
      const firstItem = sortedItems[0];

      return {
        key,
        label: firstItem ? dayFormatter.format(new Date(firstItem.createdAt)) : key,
        items: sortedItems,
        xpGained: sortedItems.reduce((total, item) => total + xpFromFeedItem(item.metricValue), 0),
        reactionCount: sortedItems.reduce((total, item) => total + item.reactionCount, 0),
        commentCount: sortedItems.reduce((total, item) => total + item.commentCount, 0),
        typeSummaries: summarizeItemTypes(sortedItems),
      };
    })
    .sort((left, right) => latestItemTime(right.items) - latestItemTime(left.items));
}

function latestItemTime(items: SocialFeedPreviewItem[]) {
  const timestamp = Date.parse(items[0]?.createdAt ?? "");

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function summarizeItemTypes(items: SocialFeedPreviewItem[]) {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.itemType, (counts.get(item.itemType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([type, count]) => ({
      type,
      label: `${numberFormatter.format(count)} ${pluralFeedTypeLabel(type, count)}`,
    }));
}

function pluralFeedTypeLabel(type: string, count: number) {
  const labels: Record<string, [string, string]> = {
    achievement_unlock: ["achievement", "achievements"],
    challenge_completed: ["challenge completion", "challenge completions"],
    challenge_joined: ["challenge join", "challenge joins"],
    challenge_won: ["challenge win", "challenge wins"],
    import_summary: ["import", "imports"],
    level_up: ["level up", "level ups"],
    longest_drive: ["longest drive", "longest drives"],
    new_pb: ["PB", "PBs"],
    rivalry_win: ["rivalry win", "rivalry wins"],
    round_completed: ["round", "rounds"],
    squad_streak: ["squad streak", "squad streaks"],
    status_update: ["status update", "status updates"],
    weekly_pb: ["weekly PB", "weekly PBs"],
  };
  const fallback = feedTypeLabel(type).toLowerCase();
  const [single, plural] = labels[type] ?? [fallback, `${fallback}s`];

  return count === 1 ? single : plural;
}

function feedTypeLabel(value: string) {
  const labels: Record<string, string> = {
    rivalry_win: "Rivalry Win",
    squad_streak: "Squad Streak",
    weekly_pb: "Weekly PB",
  };

  if (labels[value]) {
    return labels[value];
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function xpFromFeedItem(metricValue: string | null) {
  const match = metricValue?.replace(/,/g, "").match(/^\+?(\d+(?:\.\d+)?)\s*XP$/i);
  return match ? Math.round(Number(match[1])) : 0;
}

function digestHeadline(group: RailDayGroup, achievementCount: number) {
  if (achievementCount > 0 && group.xpGained > 0) {
    return `${numberFormatter.format(achievementCount)} ${achievementNoun(achievementCount)} and ${numberFormatter.format(group.xpGained)} XP gained`;
  }

  if (achievementCount > 0) {
    return `${numberFormatter.format(achievementCount)} ${achievementNoun(achievementCount)} unlocked`;
  }

  if (group.xpGained > 0) {
    return `${numberFormatter.format(group.xpGained)} XP gained`;
  }

  return `${group.label} golf activity`;
}

function achievementNoun(count: number) {
  return count === 1 ? "achievement" : "achievements";
}

function countNewItems(items: SocialFeedPreviewItem[]) {
  const seenAt = readSeenAt();

  if (!seenAt) {
    return Math.min(items.length, 99);
  }

  return Math.min(items.filter((item) => Date.parse(item.createdAt) > seenAt).length, 99);
}

function markItemsSeen(items: SocialFeedPreviewItem[]) {
  const latest = Math.max(
    0,
    ...items.map((item) => Date.parse(item.createdAt)).filter(Number.isFinite),
  );

  if (!latest) {
    return;
  }

  try {
    window.localStorage.setItem(seenStorageKey, String(latest));
  } catch {}
}

function readSeenAt() {
  try {
    const value = Number(window.localStorage.getItem(seenStorageKey));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function isHiddenRoute(pathname: string) {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  return hiddenRoutePrefixes.some(
    (prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`),
  );
}
