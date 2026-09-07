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

import { GroupDecision } from "@/app/groups/group-decision";
import { GroupCreateSheet } from "@/app/groups/group-create-sheet";
import { GroupDirectoryTabs, type GroupDirectoryTab } from "@/app/groups/group-directory-tabs";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { PageShell, PageHeader } from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <div className="grid min-w-0 gap-6" data-groups-workspace>
        <PageHeader
          eyebrow="Your golf circle"
          title="Groups"
          description="Find your crew, review invitations and manage your memberships."
          actions={<GroupCreateSheet groupTypes={data.groupTypes} />}
        />
        <section className="grid gap-4" aria-labelledby="group-directory-heading">
          <p className="text-sm text-muted-foreground">
            Showing up to 80 recent accessible groups and 40 pending invitations.
          </p>
          {params?.invite && !data.invitePreview ? (
            <p role="status">
              This invitation link is unavailable. Check the link or ask the group owner for a
              current invitation.
            </p>
          ) : null}
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
          </div>

          <GroupDirectoryTabs
            activeTab={activeTab}
            counts={{
              mine: data.mine.length,
              discover: data.discoverable.length,
              invites: data.invites.length,
            }}
          >
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
          </GroupDirectoryTabs>
        </section>
      </div>
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
                className="break-words text-lg font-semibold hover:text-primary hover:underline"
              >
                {group.name}
              </Link>
              <Badge variant="outline">{label(group.visibility)}</Badge>
              {group.viewerRole ? (
                <Badge variant="secondary">{label(group.viewerRole)}</Badge>
              ) : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground">
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
                ? `${group.latestActivity.label} · ${activityDateFormatter.format(group.latestActivity.createdAt)}`
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
            <GroupDecision
              name={group.name}
              visibility={label(group.visibility)}
              operation="join"
              identifier={group.id}
            />
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
      <p className="mt-1 break-words text-sm font-medium" title={value}>
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
              <GroupDecision
                name={invitePreview.name}
                visibility={label(invitePreview.visibility)}
                operation="code"
                identifier={invitePreview.inviteCode}
              />
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
                <p className="break-words text-lg font-semibold">{invite.group.name}</p>
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
              <GroupDecision
                name={invite.group.name}
                visibility={label(invite.group.visibility)}
                operation="decline"
                identifier={invite.id}
              />
              <GroupDecision
                name={invite.group.name}
                visibility={label(invite.group.visibility)}
                operation="accept"
                identifier={invite.id}
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function parseDirectoryTab(value?: string, hasInvite = false): GroupDirectoryTab {
  if (hasInvite && !value) return "invites";
  return value === "discover" || value === "invites" ? value : "mine";
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
