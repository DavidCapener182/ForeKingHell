import { PublicProfileBag } from "@/app/profile/public-profile-bag";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck, Users } from "lucide-react";

import { PeopleActionMenu } from "@/app/friends/friend-action-menu";
import { AppEmptyState } from "@/components/app/app-empty-state";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { FeedCardList } from "@/components/social/feed-card-list";
import { SocialAvatar } from "@/components/social/social-avatar";
import {
  DataPair,
  DataPanel,
  DataTableFrame,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProfilePageData } from "@/lib/social";

export const dynamic = "force-dynamic";

type PublicProfileData = NonNullable<Awaited<ReturnType<typeof getProfilePageData>>>;
type ProfileActivityRow = PublicProfileData["recentFeed"][number];
type ProfileGapRow = PublicProfileData["stats"]["gapLadder"][number];

const profileActivityColumns: DesktopWorkbenchColumn[] = [
  { id: "activity", label: "Activity", locked: true },
  { id: "type", label: "Type" },
  { id: "metric", label: "Metric" },
  { id: "proof", label: "Proof" },
  { id: "privacy", label: "Privacy" },
  { id: "engagement", label: "Engagement" },
  { id: "date", label: "Date" },
  { id: "action", label: "Action", locked: true },
];

const profileBagColumns: DesktopWorkbenchColumn[] = [
  { id: "club", label: "Club", locked: true },
  { id: "carry", label: "Carry" },
  { id: "total", label: "Total" },
  { id: "confidence", label: "Confidence" },
  { id: "shots", label: "Shots" },
];

type PublicProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const data = await getProfilePageData(username);

  if (!data) {
    notFound();
  }

  const profile = data.profile;
  const isSelf = profile.relationship === "self";
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28" data-public-profile-workspace>
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/friends" prefetch={false}>
              <ArrowLeft className="size-4" />
              Friends
            </Link>
          </Button>
          <Badge variant="outline">@{profile.username}</Badge>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <SocialAvatar
            displayName={profile.displayName}
            username={profile.username}
            avatarUrl={profile.avatarUrl}
            size="lg"
          />
          <span className="break-all text-sm">@{profile.username}</span>
        </div>
        <PageHeader
          eyebrow={
            <StatusPill tone={profile.publicProfile ? "green" : "sky"}>
              {profile.relationship === "friend" ? "Friend profile" : "Social profile"}
            </StatusPill>
          }
          title={profile.displayName}
          description={profile.bio ?? "LM World Tour golfer"}
          actions={
            isSelf ? (
              <Button asChild variant="outline">
                <Link href="/profile" prefetch={false}>
                  <ShieldCheck className="size-4" />
                  Edit profile
                </Link>
              </Button>
            ) : data.viewerProfile ? (
              <PeopleActionMenu
                userId={profile.userId}
                relationship={profile.relationship}
                status="search"
                returnHref={`/profile/${profile.username}`}
                username={profile.username}
                displayName={profile.displayName}
                requestId={data.pendingRequestId ?? undefined}
              />
            ) : (
              <Button asChild variant="outline">
                <Link href="/login" prefetch={false}>
                  Sign in to connect
                </Link>
              </Button>
            )
          }
          metrics={[
            {
              label: "Home",
              value: profile.homeCourse ?? "--",
              detail: "Course or simulator venue",
            },
            {
              label: "Launch monitor",
              value: profile.primaryLaunchMonitor ?? "--",
              detail: "Primary setup",
            },
            {
              label: "Handicap band",
              value: profile.handicapBand ?? "--",
              detail: "Self-selected",
            },
            {
              label: "Connection",
              value: titleCase(profile.relationship),
              detail: profile.publicProfile ? "Public opt-in" : "Friend scoped",
            },
          ]}
        />

        <section className="grid gap-4 lg:grid-cols-[0.35fr_0.65fr]">
          <aside aria-label="Public profile stats rail" className="min-w-0">
            <DataPanel>
              <SectionHeader
                title="Visible stats"
                description="Only profile-approved summary data appears here; an unavailable value is not zero."
                action={<Users className="size-5 text-primary" />}
              />
              <CardContent className="grid gap-3">
                <DataPair label="Rounds" value={formatNullable(data.stats.rounds)} />
                <DataPair
                  label="Mapped clubs"
                  value={
                    data.stats.gapLadder.length
                      ? formatNullable(data.stats.gapLadder.length)
                      : "Not shared or unavailable"
                  }
                />
                <DataPair label="Handicap band" value={data.stats.handicapBand ?? "--"} />
              </CardContent>
            </DataPanel>
          </aside>

          <section data-profile-recent-feed className="grid gap-3">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold tracking-normal text-foreground sm:text-xl">
                Recent feed
              </h2>
              <p className="text-sm text-muted-foreground">
                Up to six latest activities this golfer allows you to see, with their original proof
                and verification labels.
              </p>
            </div>
            <FeedCardList items={data.recentFeed} compact />
          </section>
        </section>

        <PublicProfileActivityLedger profile={profile} items={data.recentFeed} />

        <PublicProfileBagComparison profile={profile} rows={data.stats.gapLadder} />
      </div>
    </PageShell>
  );
}

async function PublicProfileActivityLedger({
  profile,
  items,
}: {
  profile: PublicProfileData["profile"];
  items: ProfileActivityRow[];
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");
  const suggestedViews = profileActivitySuggestedViews(profile.username);

  return (
    <section
      id="profile-activity-ledger"
      className="grid gap-3"
      data-workbench-scope="profile-activity"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Visible activity ledger</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Privacy-filtered activity, proof and engagement for this golfer before opening the card
            stream.
          </p>
        </div>
        <StatusPill tone={items.length > 0 ? "green" : "slate"}>
          {items.length} visible items
        </StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`profile-activity-${profile.username}`}
        scope="profile-activity"
        currentViewLabel={`@${profile.username} activity`}
        resultLabel={`${items.length} visible activities`}
        columns={profileActivityColumns}
        suggestedViews={suggestedViews}
        exportTableId="profile-activity-ledger"
        exportFileName={`forekinghell-profile-${profile.username}-activity.csv`}
      />

      <DataTableFrame mainTable mainTableLabel="Profile activity ledger table" stickyFirstColumn>
        <Table
          data-workbench-export-table="profile-activity-ledger"
          aria-describedby="profile-activity-ledger-summary"
        >
          <TableCaption id="profile-activity-ledger-summary" className="sr-only">
            Profile activity ledger showing visible activity, type, metric, proof state, privacy,
            engagement, date and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
            <TableRow>
              <TableHead
                data-column="activity"
                className="sticky left-0 z-20 min-w-72 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
              >
                Activity
              </TableHead>
              <TableHead data-column="type">Type</TableHead>
              <TableHead data-column="metric">Metric</TableHead>
              <TableHead data-column="proof">Proof</TableHead>
              <TableHead data-column="privacy">Privacy</TableHead>
              <TableHead data-column="engagement">Engagement</TableHead>
              <TableHead data-column="date">Date</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="activity"
                    className="sticky left-0 z-10 min-w-72 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  >
                    <p className="font-semibold">{item.headline}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.context ?? feedTypeLabel(item.itemType)}
                    </p>
                  </TableCell>
                  <TableCell data-column="type">{feedTypeLabel(item.itemType)}</TableCell>
                  <TableCell data-column="metric">
                    {item.metricValue
                      ? `${item.metricLabel ?? "Metric"} - ${item.metricValue}`
                      : "--"}
                  </TableCell>
                  <TableCell data-column="proof">{item.verificationLabel}</TableCell>
                  <TableCell data-column="privacy">{titleCase(item.visibility)}</TableCell>
                  <TableCell data-column="engagement">
                    {item.reactionCount} kudos - {item.commentCount} comments
                  </TableCell>
                  <TableCell data-column="date">{dateFormatter.format(item.createdAt)}</TableCell>
                  <TableCell data-column="action" className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={item.proofUrl ?? `/profile/${profile.username}`} prefetch={false}>
                        <ExternalLink className="size-4" />
                        {item.proofUrl ? "Open proof" : "Open profile"}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="p-4">
                  <AppEmptyState
                    icon={<Users className="size-5" />}
                    title="No shared activity yet"
                    description="Public or friend-visible golf activity will appear here when this golfer chooses to share it."
                    primaryAction={
                      <Button asChild variant="outline" size="sm">
                        <Link href="/friends" prefetch={false}>
                          Open friends
                        </Link>
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

async function PublicProfileBagComparison({
  profile,
  rows,
}: {
  profile: PublicProfileData["profile"];
  rows: ProfileGapRow[];
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");
  const suggestedViews = profileBagSuggestedViews(profile.username);

  return (
    <section
      id="profile-bag-comparison"
      className="grid gap-3"
      data-workbench-scope="profile-bag-comparison"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Visible bag comparison</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Friend or public bag numbers that this profile allows, with enough sample and trust to
            compare responsibly.
          </p>
        </div>
        <StatusPill tone={rows.length > 0 ? "green" : "slate"}>{rows.length} clubs</StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`profile-bag-${profile.username}`}
        scope="profile-bag-comparison"
        currentViewLabel={`@${profile.username} bag`}
        resultLabel={`${rows.length} visible clubs`}
        columns={profileBagColumns}
        suggestedViews={suggestedViews}
        exportTableId="profile-bag-comparison"
        exportFileName={`forekinghell-profile-${profile.username}-bag.csv`}
      />

      <PublicProfileBag rows={rows} />
    </section>
  );
}

const integerFormatter = new Intl.NumberFormat("en-GB");
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatNullable(value: number | null) {
  return typeof value === "number" ? integerFormatter.format(value) : "--";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function profileActivitySuggestedViews(username: string): DesktopSavedViewSuggestion[] {
  return [
    {
      title: "Visible activity",
      href: `/profile/${username}`,
      detail: "All activity this profile allows you to review.",
    },
    {
      title: "Friend manager",
      href: "/friends",
      detail: "Requests, comparisons and blocked profiles.",
    },
    {
      title: "Social feed",
      href: "/feed",
      detail: "Open the wider feed with filters and proof controls.",
    },
  ];
}

function profileBagSuggestedViews(username: string): DesktopSavedViewSuggestion[] {
  return [
    {
      title: "Visible bag",
      href: `/profile/${username}`,
      detail: "Club distances and confidence this golfer makes visible.",
    },
    {
      title: "Compare workspace",
      href: "/compare",
      detail: "Build a side-by-side comparison from trusted metrics.",
    },
    {
      title: "Leaderboards",
      href: "/leaderboard",
      detail: "Check friend and global context where privacy allows.",
    },
  ];
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
