import Link from "next/link";
import {
  BarChart3,
  EyeOff,
  Flag,
  Globe2,
  Lock,
  MessageCircle,
  Share2,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  Users,
} from "lucide-react";

import {
  addFeedCommentAction,
  addFeedCommentReactionAction,
  addFeedReactionAction,
  deleteFeedItemAction,
  hideFeedItemAction,
  hideFeedItemTypeAction,
  muteFeedItemUserAction,
  reportFeedItemAction,
  deleteFeedCommentAction,
  removeFeedCommentReactionAction,
  removeFeedReactionAction,
  updateFeedItemVisibilityAction,
} from "@/app/feed/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/app/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { CopyShareImageButton } from "@/components/social/copy-share-image-button";
import { SocialAvatar } from "@/components/social/social-avatar";
import { socialVisibilityOptions, type FeedItemView } from "@/lib/social";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function FeedCardList({
  items,
  compact = false,
}: {
  items: FeedItemView[];
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Import a session, set a course record, enter an event, unlock an achievement, or join a challenge to start the feed."
      />
    );
  }

  return (
    <div className={compact ? "grid gap-3" : "grid gap-4"}>
      {items.map((item) => (
        <FeedItemCard key={item.id} item={item} compact={compact} />
      ))}
    </div>
  );
}

function FeedItemCard({ item, compact = false }: { item: FeedItemView; compact?: boolean }) {
  const isStatusUpdate = item.itemType === "status_update";
  const imageUrl = imageProofUrl(item.proofUrl);

  return (
    <Card
      role="article"
      className="premium-card transition hover:border-emerald-200"
      data-feed-item-id={item.id}
    >
      <CardContent className={compact ? "grid gap-3" : "grid gap-4"}>
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
          <SocialAvatar
            displayName={item.profile.displayName}
            username={item.profile.username}
            avatarUrl={item.profile.avatarUrl}
            href={`/profile/${item.profile.username}`}
            size={compact ? "sm" : "md"}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={`/profile/${item.profile.username}`}
                prefetch={false}
                className="truncate text-sm font-semibold hover:underline"
              >
                {item.profile.displayName}
              </Link>
              <span className="text-xs text-muted-foreground">@{item.profile.username}</span>
              <span className="text-xs text-muted-foreground">{dateFormatter.format(item.createdAt)}</span>
            </div>
            {isStatusUpdate ? (
              <p className="mt-1 text-xs font-medium uppercase text-muted-foreground">Status update</p>
            ) : (
              <h2 className={compact ? "mt-1 text-sm font-medium leading-5" : "mt-1 text-lg font-semibold leading-6"}>
                {item.headline}
              </h2>
            )}
          </div>
          <Badge variant="outline" className="h-fit gap-1">
            <VisibilityIcon visibility={item.visibility} />
            {titleCase(item.visibility)}
          </Badge>
        </header>

        <div className="grid gap-3">
          {isStatusUpdate ? (
            <p className={compact ? "whitespace-pre-line text-sm leading-5" : "whitespace-pre-line text-base leading-7"}>
              {item.context ?? item.headline}
            </p>
          ) : item.metricValue ? (
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-[#F5F6F4] p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                <BarChart3 className="size-3.5" />
                {item.metricLabel ?? "Metric"}
              </p>
              <p className="text-3xl font-semibold tracking-normal text-[#050505]">{item.metricValue}</p>
            </div>
          ) : null}
          {!isStatusUpdate && item.context ? <p className="text-sm leading-6 text-muted-foreground">{item.context}</p> : null}
          {imageUrl ? <FeedItemImage src={imageUrl} alt={`Status image by ${item.profile.displayName}`} /> : null}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="size-3" />
              {item.verificationLabel}
            </Badge>
            <Badge variant="outline">{feedTypeLabel(item.itemType)}</Badge>
          </div>
        </div>

        <div className="grid gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <form action={item.viewerReacted ? removeFeedReactionAction : addFeedReactionAction}>
              <input type="hidden" name="feedItemId" value={item.id} />
              <Button type="submit" variant={item.viewerReacted ? "default" : "ghost"} size="sm">
                <ThumbsUp className="size-4" />
                Kudos {item.reactionCount > 0 ? item.reactionCount : ""}
              </Button>
            </form>
            {!compact ? (
              <Button variant="ghost" size="sm" type="button">
                <MessageCircle className="size-4" />
                Comments {item.commentCount > 0 ? item.commentCount : ""}
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/api/share-cards/feed/${item.id}`} target="_blank" prefetch={false}>
                <Share2 className="size-4" />
                Share card
              </Link>
            </Button>
            <CopyShareImageButton href={`/api/share-cards/feed/${item.id}`} />
            {item.proofUrl && !imageUrl ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={item.proofUrl} prefetch={false}>Open related</Link>
              </Button>
            ) : null}
          </div>

          {!compact ? (
            <>
              {item.comments.length > 0 ? (
                <div className="grid gap-2">
                  {item.comments.map((comment) => (
                    <CommentCard key={comment.id} comment={comment} />
                  ))}
                </div>
              ) : null}
              <form action={addFeedCommentAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="feedItemId" value={item.id} />
                <Textarea name="body" placeholder="Write a comment" rows={2} className="min-h-10 resize-none rounded-lg bg-white" />
                <Button type="submit" variant="outline">
                  <MessageCircle className="size-4" />
                  Post
                </Button>
              </form>
            </>
          ) : null}
          <FeedItemControls item={item} compact={compact} />
        </div>
      </CardContent>
    </Card>
  );
}

function FeedItemImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-[#F5F6F4]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-h-[520px] w-full object-cover" />
    </div>
  );
}

function CommentCard({
  comment,
  compact = false,
}: {
  comment: FeedItemView["comments"][number];
  compact?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg bg-white ${compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}>
      <SocialAvatar
        displayName={comment.profile.displayName}
        username={comment.profile.username}
        avatarUrl={comment.profile.avatarUrl}
        href={`/profile/${comment.profile.username}`}
        size="sm"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/profile/${comment.profile.username}`} prefetch={false} className="font-medium hover:underline">
            {comment.profile.displayName}
          </Link>
          <form action={comment.viewerLiked ? removeFeedCommentReactionAction : addFeedCommentReactionAction}>
            <input type="hidden" name="commentId" value={comment.id} />
            <Button type="submit" variant={comment.viewerLiked ? "secondary" : "ghost"} size="xs">
              <ThumbsUp className="size-3" />
              Like {comment.likeCount > 0 ? comment.likeCount : ""}
            </Button>
          </form>
          {comment.viewerCanDelete ? (
            <form action={deleteFeedCommentAction}>
              <input type="hidden" name="commentId" value={comment.id} />
              <Button type="submit" variant="destructive" size="xs">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
        <p className="mt-0.5 text-muted-foreground">{comment.body}</p>
      </div>
    </div>
  );
}

function FeedItemControls({ item, compact = false }: { item: FeedItemView; compact?: boolean }) {
  const isOwnItem = item.profile.relationship === "self";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? "xs" : "sm"}
          className="w-fit"
        >
          <ShieldCheck className="size-4 text-slate-600" />
          Controls
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={compact ? "w-72" : "w-80"}>
        <DropdownMenuLabel>Feed controls</DropdownMenuLabel>
        <div className={compact ? "grid gap-2 p-1" : "grid gap-3 p-1"}>
        {isOwnItem ? (
          <>
            <form action={updateFeedItemVisibilityAction} className="grid gap-2 rounded-lg bg-white p-2">
              <input type="hidden" name="feedItemId" value={item.id} />
              <label className="grid gap-1 text-xs font-medium">
                <span>Edit visibility</span>
                <select name="visibility" defaultValue={item.visibility} className="h-8 rounded-lg border bg-white px-2 text-xs">
                  {socialVisibilityOptions.map((option) => (
                    <option key={option} value={option}>
                      {titleCase(option)}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="outline" size="sm">Save visibility</Button>
            </form>
            <form action={deleteFeedItemAction} className="rounded-lg bg-white p-2">
              <input type="hidden" name="feedItemId" value={item.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="size-4" />
                Delete from feed
              </Button>
            </form>
          </>
        ) : (
          <>
            <form action={hideFeedItemAction} className="rounded-lg bg-white p-2">
              <input type="hidden" name="feedItemId" value={item.id} />
              <Button type="submit" variant="outline" size="sm">
                <EyeOff className="size-4" />
                Hide post
              </Button>
            </form>
            <form action={hideFeedItemTypeAction} className="rounded-lg bg-white p-2">
              <input type="hidden" name="feedItemId" value={item.id} />
              <Button type="submit" variant="outline" size="sm">
                <EyeOff className="size-4" />
                Hide this type
              </Button>
            </form>
            <form action={muteFeedItemUserAction} className="rounded-lg bg-white p-2">
              <input type="hidden" name="feedItemId" value={item.id} />
              <Button type="submit" variant="outline" size="sm">
                <Users className="size-4" />
                Mute user
              </Button>
            </form>
          </>
        )}
        <form action={reportFeedItemAction} className="grid gap-2 rounded-lg bg-white p-2" data-feed-report-form>
          <input type="hidden" name="feedItemId" value={item.id} />
          <select name="reason" defaultValue="feed_report" className="h-8 rounded-lg border bg-white px-2 text-xs">
            <option value="feed_report">Report post</option>
            <option value="suspicious_result">Suspicious result</option>
            <option value="spam">Spam</option>
            <option value="harassment">Harassment</option>
          </select>
          <Button type="submit" variant="outline" size="sm">
            <Flag className="size-4" />
            Report
          </Button>
        </form>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VisibilityIcon({ visibility }: { visibility: FeedItemView["visibility"] }) {
  if (visibility === "public") {
    return <Globe2 className="size-3" />;
  }

  if (visibility === "friends") {
    return <Users className="size-3" />;
  }

  return <Lock className="size-3" />;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function feedTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => titleCase(part))
    .join(" ");
}

function imageProofUrl(value: string | null) {
  if (!value) {
    return null;
  }

  return value.startsWith("data:image/") ? value : null;
}
