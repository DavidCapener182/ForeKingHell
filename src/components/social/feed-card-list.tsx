import Link from "next/link";
import {
  Award,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Globe2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Radio,
  Share2,
  ShieldCheck,
  ThumbsUp,
  Users,
  Zap,
} from "lucide-react";

import {
  addFeedCommentAction,
  addFeedCommentReactionAction,
  addFeedReactionAction,
  deleteFeedCommentAction,
  removeFeedCommentReactionAction,
  removeFeedReactionAction,
} from "@/app/feed/actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Item } from "@/components/ui/item";
import { CopyShareImageButton } from "@/components/social/copy-share-image-button";
import { ReelExportButton } from "@/components/social/reel-export-button";
import { SocialAvatar } from "@/components/social/social-avatar";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { type FeedItemView } from "@/lib/social";
import { FeedItemControls } from "@/components/social/feed-item-controls";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

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

const numberFormatter = new Intl.NumberFormat("en-GB");

export function FeedCardList({
  items,
  compact = false,
}: {
  items: FeedItemView[];
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <AppEmptyState
        title="No activity yet"
        description="Import a session, set a course record, enter an event, unlock an achievement, or join a challenge to start the feed."
        primaryAction={
          <Button asChild variant="outline">
            <Link href="/import" prefetch={false}>
              Import a session
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div
      className={
        compact
          ? "grid gap-3"
          : "relative grid gap-4 before:absolute before:inset-y-3 before:left-3 before:w-px before:bg-border"
      }
      data-feed-activity-timeline={!compact || undefined}
    >
      {compact
        ? items.map((item) => <FeedItemCard key={item.id} item={item} compact />)
        : groupItemsByDayAndUser(items).map((group) => (
            <div key={group.key} className="relative pl-8">
              <span
                className="absolute left-0 top-5 z-10 grid size-6 place-items-center rounded-full border bg-card text-primary"
                aria-hidden
              >
                <Radio className="size-3" />
              </span>
              <FeedDayDigestCard group={group} />
            </div>
          ))}
    </div>
  );
}

function FeedDayDigestCard({ group }: { group: FeedDayGroup }) {
  const firstItem = group.items[0];

  if (!firstItem) {
    return null;
  }

  const achievements = group.items.filter((item) => item.itemType === "achievement_unlock");
  const nonAchievementHighlights = group.items.filter(
    (item) => item.itemType !== "achievement_unlock",
  );
  const highlights = nonAchievementHighlights.slice(0, 2);
  const multipleProfiles = new Set(group.items.map((item) => item.userId)).size > 1;
  const visibility = groupedVisibility(group.items);
  const hasXp = group.xpGained > 0;

  return (
    <Card role="article" className="premium-card">
      <CardContent className="grid gap-4">
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
          <SocialAvatar
            displayName={firstItem.profile.displayName}
            username={firstItem.profile.username}
            avatarUrl={firstItem.profile.avatarUrl}
            href={`/profile/${firstItem.profile.username}`}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <CalendarDays className="size-3" />
                {group.label}
              </Badge>
              <Link
                href={`/profile/${firstItem.profile.username}`}
                prefetch={false}
                className="text-sm font-semibold hover:underline"
              >
                {firstItem.profile.displayName}
              </Link>
              <span className="text-xs text-muted-foreground">@{firstItem.profile.username}</span>
              <span className="text-xs text-muted-foreground">Daily activity digest</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold leading-6">
              {digestHeadline(group, achievements.length)}
            </h2>
          </div>
          <Badge variant="outline" className="h-fit gap-1">
            {visibility === "mixed" ? (
              <Users className="size-3" />
            ) : (
              <VisibilityIcon visibility={visibility} />
            )}
            {visibility === "mixed" ? "Mixed" : titleCase(visibility)}
          </Badge>
        </header>

        <div className={hasXp ? "grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]" : "grid gap-3"}>
          {hasXp ? (
            <Item variant="muted" className="block border-primary/20 bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-primary">
                <Zap className="size-3.5" />
                XP gained
              </p>
              <p className="text-3xl font-semibold tracking-normal text-foreground">
                +{numberFormatter.format(group.xpGained)} XP
              </p>
              <p className="text-xs text-muted-foreground">
                {group.reactionCount} kudos · {group.commentCount} comments
              </p>
            </Item>
          ) : null}

          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {group.typeSummaries.map((summary) => (
                <Badge key={summary.type} variant="outline">
                  {summary.label}
                </Badge>
              ))}
            </div>
            {!hasXp ? (
              <p className="text-xs text-muted-foreground">
                {group.reactionCount} kudos · {group.commentCount} comments
              </p>
            ) : null}
            {highlights.length > 0 ? (
              <div className="grid gap-2">
                {highlights.map((item) => (
                  <HighlightRow key={item.id} item={item} showProfile={multipleProfiles} />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DigestComments items={group.items} />

        {achievements.length > 0 ? (
          <Collapsible className="rounded-lg border bg-muted/45">
            <CollapsibleTrigger
              type="button"
              className={buttonVariants({
                variant: "ghost",
                className: "group w-full min-h-12 justify-between rounded-lg px-3",
              })}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Award className="size-4 text-primary" />
                Achievements unlocked
              </span>
              <span className="flex items-center gap-2">
                <Badge variant="secondary">{achievements.length} total</Badge>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-2 border-t p-3 sm:grid-cols-2">
              {achievements.map((item) => (
                <Item key={item.id} className="block px-3 py-2 text-sm">
                  <p className="line-clamp-1 font-medium">{achievementTitle(item)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.metricValue ?? "Achievement"} · {item.context ?? "Verified activity"}
                  </p>
                  <ActivityActions item={item} showCommentThread={false} />
                </Item>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : null}

        <Collapsible className="rounded-lg border bg-muted/45">
          <CollapsibleTrigger
            type="button"
            className={buttonVariants({
              variant: "ghost",
              className: "group w-full min-h-12 justify-between rounded-lg px-3",
            })}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <MoreHorizontal className="size-4 text-muted-foreground" />
              Individual cards
            </span>
            <span className="flex items-center gap-2">
              <Badge variant="outline">{group.items.length} posts</Badge>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-3 border-t p-3">
            {group.items.map((item) => (
              <FeedDigestItemRow key={item.id} item={item} />
            ))}
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/api/share-cards/feed/${firstItem.id}`} target="_blank" prefetch={false}>
              <Share2 className="size-4" />
              Share latest
            </Link>
          </Button>
          {firstItem.viewerCanManage ? <ReelExportButton feedItemId={firstItem.id} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function FeedItemCard({ item, compact = false }: { item: FeedItemView; compact?: boolean }) {
  return (
    <Card
      role="article"
      className="premium-card transition hover:border-emerald-200"
      data-feed-item-id={item.id}
    >
      <CardContent className={compact ? "grid gap-3" : "grid gap-4"}>
        <FeedItemContent item={item} compact={compact} />
      </CardContent>
    </Card>
  );
}

function FeedDigestItemRow({ item }: { item: FeedItemView }) {
  return (
    <Item
      role="article"
      variant="outline"
      className="block p-3"
      data-feed-item-id={item.id}
      data-feed-digest-item-row
    >
      <div className="grid gap-4">
        <FeedItemContent item={item} />
      </div>
    </Item>
  );
}

function FeedItemContent({ item, compact = false }: { item: FeedItemView; compact?: boolean }) {
  return (
    <>
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
            <span className="text-xs text-muted-foreground">
              {dateFormatter.format(item.createdAt)}
            </span>
          </div>
          <h2
            className={
              compact
                ? "mt-1 text-sm font-medium leading-5"
                : "mt-1 text-lg font-semibold leading-6"
            }
          >
            {item.headline}
          </h2>
        </div>
        <Badge variant="outline" className="h-fit gap-1">
          <VisibilityIcon visibility={item.visibility} />
          {titleCase(item.visibility)}
        </Badge>
      </header>

      <div className="grid gap-3">
        {item.metricValue ? (
          <Item variant="muted" className="block p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <BarChart3 className="size-3.5" />
              {item.metricLabel ?? "Metric"}
            </p>
            <p className="text-3xl font-semibold tracking-normal text-foreground">
              {item.metricValue}
            </p>
          </Item>
        ) : null}
        {!compact && isPbFeedType(item.itemType) ? (
          <PageArtwork
            variant="feedPb"
            alt=""
            className="block h-24 min-h-0 md:h-28"
            sizes="(min-width: 768px) 680px, 100vw"
          />
        ) : null}
        {item.context ? (
          <p className="text-sm leading-6 text-muted-foreground">{item.context}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="size-3" />
            {item.verificationLabel}
          </Badge>
          <Badge variant="outline">{feedTypeLabel(item.itemType)}</Badge>
        </div>
      </div>

      <div className="grid gap-3 border-t border-border pt-3">
        <ButtonGroup className="flex-wrap">
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
          {item.viewerCanManage ? <ReelExportButton feedItemId={item.id} /> : null}
          {item.proofUrl ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={item.proofUrl} prefetch={false}>
                Open related
              </Link>
            </Button>
          ) : null}
        </ButtonGroup>

        {!compact ? (
          <>
            {item.comments.length > 0 ? (
              <div className="grid gap-2">
                {item.comments.map((comment) => (
                  <CommentCard key={comment.id} comment={comment} />
                ))}
              </div>
            ) : null}
            <form action={addFeedCommentAction}>
              <input type="hidden" name="feedItemId" value={item.id} />
              <InputGroup className="h-auto min-h-10 bg-card">
                <InputGroupTextarea name="body" placeholder="Write a comment" rows={2} />
                <InputGroupAddon align="block-end" className="justify-end border-t">
                  <InputGroupButton type="submit" variant="outline" size="sm">
                    <MessageCircle className="size-4" />
                    Post
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
          </>
        ) : null}
        <FeedItemControls
          feedItemId={item.id}
          visibility={item.visibility}
          isOwnItem={item.profile.relationship === "self"}
          compact={compact}
        />
      </div>
    </>
  );
}

function HighlightRow({ item, showProfile }: { item: FeedItemView; showProfile: boolean }) {
  return (
    <Item className="block px-3 py-2 text-sm">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium">
            {showProfile ? `${item.profile.displayName}: ` : ""}
            {item.headline}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {item.metricValue
              ? `${item.metricLabel ?? "Metric"} ${item.metricValue}`
              : feedTypeLabel(item.itemType)}
            {item.context ? ` · ${item.context}` : ""}
          </p>
        </div>
      </div>
      <ActivityActions item={item} showCommentThread={false} />
    </Item>
  );
}

function DigestComments({ items }: { items: FeedItemView[] }) {
  const commentedItems = items.filter((item) => item.comments.length > 0);
  const commentCount = commentedItems.reduce((total, item) => total + item.comments.length, 0);

  if (commentedItems.length === 0) {
    return null;
  }

  return (
    <Item variant="muted" className="block p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="size-4 text-primary" />
          Comments
        </p>
        <Badge variant="secondary">{commentCount} total</Badge>
      </div>
      <div className="mt-3 grid gap-3">
        {commentedItems.map((item) => (
          <Item key={item.id} variant="outline" className="block p-3">
            <p className="line-clamp-2 text-sm font-medium">{item.headline}</p>
            <div className="mt-2 grid gap-2">
              {item.comments.map((comment) => (
                <CommentCard key={comment.id} comment={comment} />
              ))}
            </div>
            <form action={addFeedCommentAction} className="mt-2">
              <input type="hidden" name="feedItemId" value={item.id} />
              <InputGroup className="h-auto min-h-10 bg-card">
                <InputGroupTextarea name="body" placeholder="Write a comment" rows={2} />
                <InputGroupAddon align="block-end" className="justify-end border-t">
                  <InputGroupButton type="submit" variant="outline" size="sm">
                    <MessageCircle className="size-4" />
                    Post
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
          </Item>
        ))}
      </div>
    </Item>
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
    <Item
      variant="outline"
      className={`grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg bg-card ${compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"}`}
    >
      <SocialAvatar
        displayName={comment.profile.displayName}
        username={comment.profile.username}
        avatarUrl={comment.profile.avatarUrl}
        href={`/profile/${comment.profile.username}`}
        size="sm"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-medium">{comment.profile.displayName}</p>
          <form
            action={
              comment.viewerLiked ? removeFeedCommentReactionAction : addFeedCommentReactionAction
            }
          >
            <input type="hidden" name="commentId" value={comment.id} />
            <Button type="submit" variant={comment.viewerLiked ? "secondary" : "ghost"} size="xs">
              <ThumbsUp className="size-3" />
              Like {comment.likeCount > 0 ? comment.likeCount : ""}
            </Button>
          </form>
          {comment.viewerCanDelete ? (
            <form action={deleteFeedCommentAction}>
              <input type="hidden" name="commentId" value={comment.id} />
              <ConfirmSubmitButton
                confirmMessage="Delete this feed comment? This removes it from the conversation."
                variant="destructive"
                size="xs"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>
        <p className="mt-0.5 text-muted-foreground">{comment.body}</p>
      </div>
    </Item>
  );
}

function ActivityActions({
  item,
  showCommentThread = true,
}: {
  item: FeedItemView;
  showCommentThread?: boolean;
}) {
  return (
    <div className="mt-2 grid gap-2 border-t border-border pt-2">
      <ButtonGroup className="flex-wrap">
        <form action={item.viewerReacted ? removeFeedReactionAction : addFeedReactionAction}>
          <input type="hidden" name="feedItemId" value={item.id} />
          <Button type="submit" variant={item.viewerReacted ? "default" : "ghost"} size="sm">
            <ThumbsUp className="size-4" />
            Kudos {item.reactionCount > 0 ? item.reactionCount : ""}
          </Button>
        </form>
        {showCommentThread ? (
          <Collapsible defaultOpen={item.commentCount > 0} className="w-full sm:w-auto">
            <CollapsibleTrigger
              type="button"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <MessageCircle className="size-4" />
              Comments {item.commentCount > 0 ? item.commentCount : ""}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 grid min-w-72 gap-2 rounded-lg border bg-muted/45 p-2">
              {item.comments.length > 0 ? (
                <div className="grid gap-2">
                  {item.comments.map((comment) => (
                    <CommentCard key={comment.id} comment={comment} compact />
                  ))}
                </div>
              ) : null}
              <form action={addFeedCommentAction}>
                <input type="hidden" name="feedItemId" value={item.id} />
                <InputGroup>
                  <InputGroupInput name="body" placeholder="Write a comment" />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton type="submit" variant="outline">
                      Post
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </form>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <span className="inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[0.8rem] font-medium text-muted-foreground">
            <MessageCircle className="size-4" />
            Comments {item.commentCount > 0 ? item.commentCount : ""}
          </span>
        )}
        <Button asChild variant="ghost" size="sm">
          <Link href={`/api/share-cards/feed/${item.id}`} target="_blank" prefetch={false}>
            <Share2 className="size-4" />
            Share card
          </Link>
        </Button>
        <CopyShareImageButton href={`/api/share-cards/feed/${item.id}`} />
      </ButtonGroup>
      <FeedItemControls
        feedItemId={item.id}
        visibility={item.visibility}
        isOwnItem={item.profile.relationship === "self"}
        compact
      />
    </div>
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
    .map((part) => titleCase(part))
    .join(" ");
}

function isPbFeedType(type: string) {
  return type === "new_pb" || type === "longest_drive" || type === "weekly_pb";
}

type FeedDayGroup = {
  key: string;
  label: string;
  items: FeedItemView[];
  xpGained: number;
  reactionCount: number;
  commentCount: number;
  typeSummaries: Array<{ type: string; label: string }>;
};

function groupItemsByDayAndUser(items: FeedItemView[]): FeedDayGroup[] {
  const grouped = new Map<string, FeedItemView[]>();

  for (const item of items) {
    const key = `${dayKeyFormatter.format(item.createdAt)}:${item.userId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return [...grouped.entries()]
    .map(([key, groupItems]) => {
      const sortedItems = [...groupItems].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      const firstItem = sortedItems[0];

      return {
        key,
        label: firstItem ? dayFormatter.format(firstItem.createdAt) : key,
        items: sortedItems,
        xpGained: sortedItems.reduce((total, item) => total + xpFromFeedItem(item.metricValue), 0),
        reactionCount: sortedItems.reduce((total, item) => total + item.reactionCount, 0),
        commentCount: sortedItems.reduce((total, item) => total + item.commentCount, 0),
        typeSummaries: summarizeItemTypes(sortedItems),
      };
    })
    .sort(
      (left, right) =>
        (right.items[0]?.createdAt.getTime() ?? 0) - (left.items[0]?.createdAt.getTime() ?? 0),
    );
}

function summarizeItemTypes(items: FeedItemView[]) {
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
    course_record_set: ["course record", "course records"],
    course_record_beaten: ["record beat", "record beats"],
    course_record_defended: ["record defence", "record defences"],
    import_summary: ["import", "imports"],
    level_up: ["level up", "level ups"],
    longest_drive: ["longest drive", "longest drives"],
    new_pb: ["PB", "PBs"],
    rivalry_win: ["rivalry win", "rivalry wins"],
    round_completed: ["round", "rounds"],
    squad_streak: ["squad streak", "squad streaks"],
    tournament_created: ["tournament", "tournaments"],
    tournament_joined: ["tournament entry", "tournament entries"],
    tournament_round_submitted: ["tournament round", "tournament rounds"],
    weekly_pb: ["weekly PB", "weekly PBs"],
  };
  const fallback = feedTypeLabel(type).toLowerCase();
  const [single, plural] = labels[type] ?? [fallback, `${fallback}s`];

  return count === 1 ? single : plural;
}

function xpFromFeedItem(metricValue: string | null) {
  const match = metricValue?.replace(/,/g, "").match(/^\+?(\d+(?:\.\d+)?)\s*XP$/i);
  return match ? Math.round(Number(match[1])) : 0;
}

function groupedVisibility(items: FeedItemView[]) {
  const firstVisibility = items[0]?.visibility ?? "private";

  return items.every((item) => item.visibility === firstVisibility) ? firstVisibility : "mixed";
}

function digestHeadline(group: FeedDayGroup, achievementCount: number) {
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

function achievementTitle(item: FeedItemView) {
  const match = item.headline.match(/unlocked\s+"(.+)"$/i);

  return match?.[1] ?? item.headline;
}

function achievementNoun(count: number) {
  return count === 1 ? "achievement" : "achievements";
}
