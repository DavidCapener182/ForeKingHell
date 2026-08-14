import Link from "next/link";
import {
  Award,
  CircleDot,
  Flag,
  Globe2,
  Goal,
  Lock,
  MapPin,
  Medal,
  MessageCircle,
  Radio,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  ThumbsUp,
  Trophy,
  Users,
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
import { AppEmptyState } from "@/components/app/app-empty-state";
import { CopyShareImageButton } from "@/components/social/copy-share-image-button";
import { FeedItemControls } from "@/components/social/feed-item-controls";
import { ReelExportButton } from "@/components/social/reel-export-button";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { type FeedItemView } from "@/lib/social";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/London",
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/London",
});

type ActivityKind =
  | "round"
  | "practice"
  | "pb"
  | "achievement"
  | "challenge"
  | "course-record"
  | "goal"
  | "status";

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
        title="No activity in this view"
        description="Rounds, practice, PBs and golf updates will appear here in the order they happened."
        primaryAction={
          <Button asChild variant="outline">
            <Link href="/import" prefetch={false}>
              Import activity
            </Link>
          </Button>
        }
      />
    );
  }

  if (compact) {
    return (
      <div className="grid gap-3">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden py-0">
            <FeedActivityRow item={item} compact />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden py-0 shadow-sm" data-feed-activity-timeline>
      {groupItemsByDay(items).map((group) => (
        <section key={group.key} aria-labelledby={`feed-day-${group.key}`}>
          <div className="flex items-center gap-3 border-b bg-muted/35 px-4 py-2.5 sm:px-5">
            <span className="grid size-6 place-items-center rounded-full border bg-card text-primary">
              <Radio className="size-3" aria-hidden />
            </span>
            <h3
              id={`feed-day-${group.key}`}
              className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              {group.label}
            </h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {group.items.length} {group.items.length === 1 ? "activity" : "activities"}
            </span>
          </div>
          <div className="divide-y">
            {group.items.map((item) => (
              <FeedActivityRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </Card>
  );
}

function FeedActivityRow({ item, compact = false }: { item: FeedItemView; compact?: boolean }) {
  const kind = activityKind(item.itemType);

  return (
    <article
      className={cn(
        "relative grid grid-cols-[auto_minmax(0,1fr)] gap-3 bg-card px-4 py-4 transition-colors hover:bg-muted/15 sm:px-5",
        compact && "px-3 py-3 sm:px-3",
      )}
      data-feed-item-id={item.id}
      data-activity-template={kind}
    >
      <SocialAvatar
        displayName={item.profile.displayName}
        username={item.profile.username}
        avatarUrl={item.profile.avatarUrl}
        href={`/profile/${item.profile.username}`}
        size={compact ? "sm" : "md"}
      />

      <div className="min-w-0">
        <header className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={`/profile/${item.profile.username}`}
                prefetch={false}
                className="truncate text-sm font-semibold hover:underline"
              >
                {item.profile.displayName}
              </Link>
              <span className="text-xs text-muted-foreground">@{item.profile.username}</span>
              <span aria-hidden className="text-xs text-muted-foreground">
                ·
              </span>
              <span className="text-xs text-muted-foreground">
                {dateFormatter.format(item.createdAt)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ActivityLabel kind={kind} />
              <span className="inline-flex items-center gap-1 text-[0.72rem] text-muted-foreground">
                <VisibilityIcon visibility={item.visibility} />
                {titleCase(item.visibility)}
              </span>
            </div>
          </div>
          <FeedItemControls
            feedItemId={item.id}
            visibility={item.visibility}
            isOwnItem={item.profile.relationship === "self"}
            compact
          />
        </header>

        <ActivityTemplate item={item} kind={kind} compact={compact} />
        <ActivityEngagement item={item} compact={compact} />
      </div>
    </article>
  );
}

function ActivityTemplate({
  item,
  kind,
  compact,
}: {
  item: FeedItemView;
  kind: ActivityKind;
  compact: boolean;
}) {
  if (kind === "round") {
    return (
      <div className="mt-3 grid overflow-hidden rounded-xl border bg-muted/15 sm:grid-cols-[7rem_minmax(10rem,0.8fr)_minmax(12rem,1.2fr)]">
        <ActivityFact label="Score" value={item.metricValue ?? "Logged"} strong />
        <ActivityFact label="Course" value={item.metricLabel ?? "Course not set"} />
        <ActivityFact
          label="Highlight"
          value={roundHighlight(item)}
          className="border-t sm:border-l sm:border-t-0"
        />
      </div>
    );
  }

  if (kind === "practice") {
    return (
      <div className="mt-3 grid gap-3 rounded-xl border bg-muted/15 p-3 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
        <div className="grid content-center gap-2 sm:grid-cols-2">
          <ActivityFact label="Focus" value={item.context ?? item.headline} borderless />
          <ActivityFact
            label="Result"
            value={item.metricValue ?? item.verificationLabel}
            borderless
          />
        </div>
        <DispersionThumbnail href={item.proofUrl} />
      </div>
    );
  }

  if (kind === "pb") {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border bg-primary/5 px-3 py-3">
        <div className="min-w-[7rem]">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {pbClub(item)}
          </p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {item.metricValue ?? "New best"}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{item.headline}</p>
          {item.context ? (
            <p className="mt-1 text-xs text-muted-foreground">{item.context}</p>
          ) : null}
        </div>
        <VerificationLabel label={item.verificationLabel} />
      </div>
    );
  }

  if (kind === "achievement") {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border bg-muted/15 p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border bg-card text-primary">
          <Medal className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{achievementTitle(item)}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {item.context ?? item.headline}
          </p>
        </div>
        {item.metricValue ? <Badge variant="secondary">{item.metricValue}</Badge> : null}
      </div>
    );
  }

  if (kind === "challenge") {
    return (
      <div className="mt-3 grid gap-2 rounded-xl border bg-muted/15 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{item.headline}</p>
          {item.context ? (
            <p className="mt-1 text-xs text-muted-foreground">{item.context}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {item.metricValue ? <Badge variant="secondary">{item.metricValue}</Badge> : null}
          <VerificationLabel label={item.verificationLabel} />
        </div>
      </div>
    );
  }

  if (kind === "course-record") {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/15 p-3">
        <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
          <Flag className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{item.headline}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" aria-hidden />
            {item.context ?? item.metricLabel ?? "Course record"}
          </p>
        </div>
        {item.metricValue ? (
          <span className="text-lg font-semibold tabular-nums">{item.metricValue}</span>
        ) : null}
      </div>
    );
  }

  if (kind === "goal") {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border bg-muted/15 p-3">
        <Goal className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{item.headline}</p>
          {item.context ? (
            <p className="mt-1 text-xs text-muted-foreground">{item.context}</p>
          ) : null}
        </div>
        {item.metricValue ? <Badge variant="outline">{item.metricValue}</Badge> : null}
      </div>
    );
  }

  const statusImage = isStatusImage(item.proofUrl) ? item.proofUrl : null;

  return (
    <div
      className={cn(
        "mt-3",
        statusImage && !compact && "grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium leading-6">{item.context ?? item.headline}</p>
        {item.context && item.headline !== "Shared a golf update" ? (
          <p className="mt-1 text-xs text-muted-foreground">{item.headline}</p>
        ) : null}
      </div>
      {statusImage && !compact ? (
        // Status images are kept intentionally small so the activity stays readable in the stream.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={statusImage}
          alt="Attached golf update"
          className="h-20 w-full rounded-lg border object-cover sm:h-20"
        />
      ) : null}
    </div>
  );
}

function ActivityFact({
  label,
  value,
  strong = false,
  borderless = false,
  className,
}: {
  label: string;
  value: string;
  strong?: boolean;
  borderless?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 px-3 py-2.5",
        !borderless && "sm:border-l first:sm:border-l-0",
        className,
      )}
    >
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 truncate text-sm font-medium", strong && "text-xl tabular-nums")}>
        {value}
      </p>
    </div>
  );
}

function DispersionThumbnail({ href }: { href: string | null }) {
  const content = (
    <div
      className="relative h-16 overflow-hidden rounded-lg border bg-card"
      aria-label="Dispersion thumbnail"
    >
      <span className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary/35" />
      <span className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/35" />
      <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
      <span className="absolute bottom-1.5 left-2 text-[0.62rem] font-medium text-muted-foreground">
        Open session plot
      </span>
    </div>
  );

  return href ? (
    <Link href={href} prefetch={false} className="focus-aaa rounded-lg">
      {content}
    </Link>
  ) : (
    content
  );
}

function ActivityEngagement({ item, compact }: { item: FeedItemView; compact: boolean }) {
  return (
    <div className="mt-3 border-t pt-2">
      <div className="flex flex-wrap items-center gap-1">
        <form action={item.viewerReacted ? removeFeedReactionAction : addFeedReactionAction}>
          <input type="hidden" name="feedItemId" value={item.id} />
          <Button type="submit" variant={item.viewerReacted ? "secondary" : "ghost"} size="xs">
            <ThumbsUp className="size-3.5" />
            Kudos{item.reactionCount > 0 ? ` ${item.reactionCount}` : ""}
          </Button>
        </form>

        {!compact ? (
          <Collapsible className="contents">
            <CollapsibleTrigger
              type="button"
              className={buttonVariants({ variant: "ghost", size: "xs" })}
            >
              <MessageCircle className="size-3.5" />
              Comments{item.commentCount > 0 ? ` ${item.commentCount}` : ""}
            </CollapsibleTrigger>
            <CollapsibleContent className="order-last mt-2 w-full rounded-lg border bg-muted/25 p-2.5">
              {item.comments.length > 0 ? (
                <div className="mb-2 grid gap-2">
                  {item.comments.map((comment) => (
                    <CommentRow key={comment.id} comment={comment} />
                  ))}
                </div>
              ) : null}
              <form action={addFeedCommentAction}>
                <input type="hidden" name="feedItemId" value={item.id} />
                <InputGroup className="bg-card">
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
          <span className="inline-flex h-7 items-center gap-1 px-2 text-xs text-muted-foreground">
            <MessageCircle className="size-3.5" />
            {item.commentCount}
          </span>
        )}

        <Button asChild variant="ghost" size="xs">
          <Link href={`/api/share-cards/feed/${item.id}`} target="_blank" prefetch={false}>
            <Share2 className="size-3.5" />
            Share
          </Link>
        </Button>
        {!compact ? <CopyShareImageButton href={`/api/share-cards/feed/${item.id}`} /> : null}
        {item.viewerCanManage ? <ReelExportButton feedItemId={item.id} /> : null}
        {item.proofUrl && !isStatusImage(item.proofUrl) ? (
          <Button asChild variant="ghost" size="xs" className="ml-auto">
            <Link href={item.proofUrl} prefetch={false}>
              Open activity
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CommentRow({ comment }: { comment: FeedItemView["comments"][number] }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg bg-card p-2 text-xs">
      <SocialAvatar
        displayName={comment.profile.displayName}
        username={comment.profile.username}
        avatarUrl={comment.profile.avatarUrl}
        href={`/profile/${comment.profile.username}`}
        size="sm"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{comment.profile.displayName}</span>
          <form
            action={
              comment.viewerLiked ? removeFeedCommentReactionAction : addFeedCommentReactionAction
            }
          >
            <input type="hidden" name="commentId" value={comment.id} />
            <Button type="submit" variant={comment.viewerLiked ? "secondary" : "ghost"} size="xs">
              <ThumbsUp className="size-3" />
              {comment.likeCount > 0 ? comment.likeCount : "Like"}
            </Button>
          </form>
          {comment.viewerCanDelete ? (
            <form action={deleteFeedCommentAction}>
              <input type="hidden" name="commentId" value={comment.id} />
              <ConfirmSubmitButton
                confirmMessage="Delete this feed comment? This removes it from the conversation."
                variant="ghost"
                size="xs"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>
        <p className="mt-0.5 leading-5 text-muted-foreground">{comment.body}</p>
      </div>
    </div>
  );
}

function ActivityLabel({ kind }: { kind: ActivityKind }) {
  const config = activityLabelConfig[kind];
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className="h-5 gap-1 rounded-md px-1.5 text-[0.68rem]">
      <Icon className="size-3" aria-hidden />
      {config.label}
    </Badge>
  );
}

const activityLabelConfig = {
  round: { label: "Round", icon: Flag },
  practice: { label: "Practice", icon: Target },
  pb: { label: "PB", icon: Sparkles },
  achievement: { label: "Achievement", icon: Award },
  challenge: { label: "Challenge", icon: Trophy },
  "course-record": { label: "Course record", icon: Medal },
  goal: { label: "Goal", icon: Goal },
  status: { label: "Status update", icon: CircleDot },
} satisfies Record<ActivityKind, { label: string; icon: typeof Award }>;

function VerificationLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-muted-foreground">
      <ShieldCheck className="size-3" aria-hidden />
      {label}
    </span>
  );
}

function VisibilityIcon({ visibility }: { visibility: FeedItemView["visibility"] }) {
  if (visibility === "public") {
    return <Globe2 className="size-3" aria-hidden />;
  }

  if (visibility === "friends") {
    return <Users className="size-3" aria-hidden />;
  }

  return <Lock className="size-3" aria-hidden />;
}

function activityKind(itemType: string): ActivityKind {
  if (itemType.includes("round") || itemType === "post_round_recap") return "round";
  if (itemType.includes("practice") || itemType === "session_roast") return "practice";
  if (["new_pb", "longest_drive", "weekly_pb"].includes(itemType)) return "pb";
  if (itemType === "achievement_unlock" || itemType === "level_up") return "achievement";
  if (
    itemType.startsWith("challenge_") ||
    itemType.startsWith("tournament_") ||
    itemType === "rivalry_win" ||
    itemType === "squad_streak"
  ) {
    return "challenge";
  }
  if (itemType.startsWith("course_record")) return "course-record";
  if (itemType.startsWith("goal_")) return "goal";
  return "status";
}

function groupItemsByDay(items: FeedItemView[]) {
  const groups = new Map<string, FeedItemView[]>();

  for (const item of [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    const key = dayKeyFormatter.format(item.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()].map(([key, groupItems]) => ({
    key,
    label: dayFormatter.format(groupItems[0]?.createdAt ?? new Date()),
    items: groupItems,
  }));
}

function roundHighlight(item: FeedItemView) {
  const context = item.context?.trim();
  const course = item.metricLabel?.trim();

  if (!context || context === course) return "Round logged";
  return context;
}

function pbClub(item: FeedItemView) {
  if (item.itemType === "longest_drive") return item.metricLabel ?? "Driver";

  const match = item.headline.match(/new\s+(.+?)\s+PB/i);
  return match?.[1] ?? "Club best";
}

function achievementTitle(item: FeedItemView) {
  const match = item.headline.match(/unlocked\s+[“\"](.+?)[”\"]/i);
  return match?.[1] ?? item.headline;
}

function isStatusImage(value: string | null): value is string {
  return Boolean(value?.startsWith("data:image/"));
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
