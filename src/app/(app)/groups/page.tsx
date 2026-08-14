import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Clock3,
  Globe2,
  Lock,
  MessageCircle,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";

import {
  acceptGroupInviteAction,
  declineGroupInviteAction,
  joinGroupAction,
  joinGroupByInviteCodeAction,
} from "@/app/groups/actions";
import { GroupCreateSheet } from "@/app/groups/group-create-sheet";
import { GroupDirectoryTabs, type GroupDirectoryTab } from "@/app/groups/group-directory-tabs";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { PageShell, StatusPill } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { getGroupsPageData, type GroupInviteItem, type GroupListItem } from "@/lib/groups";

export const dynamic = "force-dynamic";

type GroupsPageProps = {
  searchParams?: Promise<{
    created?: string;
    joined?: string;
    invite?: string;
    tab?: string;
    left?: string;
    deleted?: string;
    declined?: string;
  }>;
};

const activityDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const data = await getGroupsPageData(params?.invite);
  const activeTab = parseDirectoryTab(params?.tab, Boolean(params?.invite));

  return (
    <PageShell>
      <header className="premium-hero overflow-hidden" aria-labelledby="groups-heading">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.38fr)]">
          <div className="flex flex-col justify-center p-5 sm:p-7 lg:p-8">
            <StatusPill tone="green">Your golf circle</StatusPill>
            <h1
              id="groups-heading"
              className="mt-4 text-3xl font-semibold tracking-normal sm:text-4xl"
            >
              Play better together.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Keep up with your regular fourball, club crew, society or coaching group — and see
              what everyone is playing for next.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <GroupCreateSheet groupTypes={data.groupTypes} />
              <span className="text-sm text-muted-foreground">
                {data.mine.length} {data.mine.length === 1 ? "membership" : "memberships"}
              </span>
            </div>
          </div>
          <PageArtwork
            variant="groups"
            alt=""
            className="hidden min-h-64 rounded-none border-0 ring-0 lg:block"
            sizes="(min-width: 1024px) 38vw, 0px"
            priority
          />
        </div>
      </header>

      {params?.created || params?.joined || params?.left || params?.deleted || params?.declined ? (
        <Alert>
          <AlertDescription>
            {params?.created
              ? "Your new group is ready."
              : params?.joined
                ? "You’re in — welcome to the group."
                : params?.left
                  ? "You’ve left the group."
                  : params?.deleted
                    ? "The group has been deleted."
                    : "Invite declined."}
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4" aria-labelledby="group-directory-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Clubhouse</p>
            <h2
              id="group-directory-heading"
              className="mt-1 text-2xl font-semibold tracking-normal"
            >
              {activeTab === "mine"
                ? "My groups"
                : activeTab === "discover"
                  ? "Find your next crew"
                  : "Group invites"}
            </h2>
          </div>
          <GroupDirectoryTabs activeTab={activeTab} inviteCount={data.invites.length} />
        </div>

        {activeTab === "mine" ? (
          <GroupClubList
            groups={data.mine}
            emptyTitle="Your clubhouse is quiet"
            emptyDescription="Create a group for your regular game or discover an existing crew."
            emptyAction={
              <Button asChild variant="outline">
                <Link href="/groups?tab=discover" prefetch={false}>
                  Discover groups
                </Link>
              </Button>
            }
          />
        ) : activeTab === "discover" ? (
          <GroupClubList
            groups={data.discoverable}
            discover
            emptyTitle="No open groups right now"
            emptyDescription="Public clubs and crews will appear here when they are open to new members."
          />
        ) : (
          <GroupInvites invites={data.invites} invitePreview={data.invitePreview} />
        )}
      </section>
    </PageShell>
  );
}

function GroupClubList({
  groups,
  discover = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  groups: GroupListItem[];
  discover?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
}) {
  if (groups.length === 0) {
    return (
      <Card className="p-5">
        <AppEmptyState
          icon={<Users className="size-5" />}
          title={emptyTitle}
          description={emptyDescription}
          primaryAction={emptyAction}
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-3" aria-label={discover ? "Groups to discover" : "My groups"}>
      {groups.map((group) => (
        <GroupClubRow key={group.id} group={group} discover={discover} />
      ))}
    </div>
  );
}

function GroupClubRow({ group, discover }: { group: GroupListItem; discover: boolean }) {
  return (
    <Card className="gap-0 p-0 transition-colors hover:bg-muted/20">
      <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.6fr)_auto] xl:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <SocialAvatar displayName={group.name} avatarUrl={group.avatarUrl} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/groups/${group.slug}`}
                prefetch={false}
                className="truncate text-lg font-semibold hover:text-primary hover:underline"
              >
                {group.name}
              </Link>
              {group.viewerRole ? (
                <Badge variant="secondary">{label(group.viewerRole)}</Badge>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
              {group.description ?? label(group.groupType)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <GroupFact
            icon={<Users className="size-4" />}
            label="Members"
            value={`${group.memberCount}`}
          />
          <GroupFact
            icon={<MessageCircle className="size-4" />}
            label="Latest activity"
            value={
              group.latestActivity
                ? `${trimLabel(group.latestActivity.label)} · ${activityDateFormatter.format(group.latestActivity.createdAt)}`
                : "No posts yet"
            }
          />
          <GroupFact
            icon={<Trophy className="size-4" />}
            label="Current challenge"
            value={group.currentChallenge?.title ?? "No live challenge"}
          />
          <GroupFact
            icon={
              group.visibility === "public" ? (
                <Globe2 className="size-4" />
              ) : (
                <Lock className="size-4" />
              )
            }
            label="Privacy"
            value={label(group.visibility)}
          />
        </div>

        <div className="flex gap-2 xl:justify-end">
          {discover ? (
            <form action={joinGroupAction}>
              <input type="hidden" name="groupId" value={group.id} />
              <Button type="submit">Join crew</Button>
            </form>
          ) : null}
          <Button asChild variant={discover ? "outline" : "default"}>
            <Link href={`/groups/${group.slug}`} prefetch={false}>
              Open
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function GroupFact({
  icon,
  label: factLabel,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-l-2 border-primary/20 pl-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {factLabel}
      </p>
      <p className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
  );
}

function GroupInvites({
  invites,
  invitePreview,
}: {
  invites: GroupInviteItem[];
  invitePreview: Awaited<ReturnType<typeof getGroupsPageData>>["invitePreview"];
}) {
  const remainingInvites = invitePreview
    ? invites.filter((invite) => invite.group.id !== invitePreview.id)
    : invites;

  if (!invitePreview && remainingInvites.length === 0) {
    return (
      <Card className="p-5">
        <AppEmptyState
          icon={<ShieldCheck className="size-5" />}
          title="No invites waiting"
          description="When a club or crew asks you to join, the invitation will appear here."
          primaryAction={null}
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {invitePreview ? (
        <Card className="border-primary/30 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <SocialAvatar displayName={invitePreview.name} avatarUrl={null} size="lg" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Invite link
                </p>
                <p className="mt-1 text-lg font-semibold">{invitePreview.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {invitePreview.memberCount} members · {label(invitePreview.visibility)}
                </p>
              </div>
            </div>
            {invitePreview.viewerRole ? (
              <Button asChild>
                <Link href={`/groups/${invitePreview.slug}`} prefetch={false}>
                  Open group
                </Link>
              </Button>
            ) : (
              <form action={joinGroupByInviteCodeAction}>
                <input type="hidden" name="inviteCode" value={invitePreview.inviteCode} />
                <Button type="submit">Accept invite</Button>
              </form>
            )}
          </div>
        </Card>
      ) : null}

      {remainingInvites.map((invite) => (
        <Card key={invite.id} className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <SocialAvatar
                displayName={invite.group.name}
                avatarUrl={invite.group.avatarUrl}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{invite.group.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{invite.group.memberCount} members</span>
                  <span aria-hidden="true">·</span>
                  <span>{label(invite.group.visibility)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3" />
                    {activityDateFormatter.format(invite.createdAt)}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <form action={declineGroupInviteAction}>
                <input type="hidden" name="inviteId" value={invite.id} />
                <Button type="submit" variant="outline">
                  Decline
                </Button>
              </form>
              <form action={acceptGroupInviteAction}>
                <input type="hidden" name="inviteId" value={invite.id} />
                <Button type="submit">Accept</Button>
              </form>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function parseDirectoryTab(value?: string, hasInvite = false): GroupDirectoryTab {
  if (hasInvite) return "invites";
  return value === "discover" || value === "invites" ? value : "mine";
}

function trimLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 46 ? `${normalized.slice(0, 43)}…` : normalized;
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
