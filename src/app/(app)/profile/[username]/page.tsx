import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, ExternalLink, ShieldCheck, Target, UserPlus, Users } from "lucide-react";

import { blockUserAction, sendFriendRequestAction } from "@/app/friends/actions";
import {
  DesktopWorkbenchLayout,
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
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

const TOUR_COVER_COUNT = 10;

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
  { id: "action", label: "Action", locked: true },
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
      <DesktopWorkbenchLayout scope="public-profile">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" className="px-0">
            <Link href="/friends" prefetch={false}>
              <ArrowLeft className="size-4" />
              Friends
            </Link>
          </Button>
          <Badge variant="outline">@{profile.username}</Badge>
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
            ) : (
              <ProfileActions
                userId={profile.userId}
                relationship={profile.relationship}
                next={`/profile/${profile.username}`}
              />
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

        <article className="premium-card overflow-hidden" aria-label="Public profile summary">
          <div
            className="h-36 bg-cover bg-center"
            style={{
              backgroundImage: profileHeaderBackground(
                profileHeaderImageUrl(profile.headerImageUrl, profile.username),
              ),
            }}
          />
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-5 pt-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="-mt-12 rounded-full bg-white p-1 shadow-sm">
                <SocialAvatar
                  displayName={profile.displayName}
                  username={profile.username}
                  avatarUrl={profile.avatarUrl}
                  size="lg"
                />
              </div>
              <div className="min-w-0 pt-1">
                <h2 className="truncate text-2xl font-semibold tracking-normal">
                  {profile.displayName}
                </h2>
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              </div>
            </div>
            <Badge variant="secondary">{titleCase(profile.relationship)}</Badge>
          </div>
        </article>

        <section className="grid gap-4 lg:grid-cols-[0.35fr_0.65fr]">
          <aside aria-label="Public profile stats rail" className="min-w-0">
            <DataPanel>
              <SectionHeader
                title="Visible stats"
                description="Only profile-approved summary data appears here."
                action={<Users className="size-5 text-sky-600" />}
              />
              <CardContent className="grid gap-3">
                <DataPair label="Rounds" value={formatNullable(data.stats.rounds)} />
                <DataPair
                  label="Mapped clubs"
                  value={formatNullable(data.stats.gapLadder.length)}
                />
                <DataPair label="Handicap band" value={data.stats.handicapBand ?? "--"} />
              </CardContent>
            </DataPanel>
          </aside>

          <DataPanel>
            <SectionHeader
              title="Recent feed"
              description="Generated PB, achievement, round, and challenge cards that this profile allows you to see."
            />
            <CardContent>
              <FeedCardList items={data.recentFeed} compact />
            </CardContent>
          </DataPanel>
        </section>

        <PublicProfileActivityLedger profile={profile} items={data.recentFeed} />

        <PublicProfileBagComparison profile={profile} rows={data.stats.gapLadder} />
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function ProfileActions({
  userId,
  relationship,
  next,
}: {
  userId: string;
  relationship: string;
  next: string;
}) {
  if (relationship === "friend") {
    return (
      <form action={blockUserAction}>
        <input type="hidden" name="blockedUserId" value={userId} />
        <input type="hidden" name="next" value="/friends?user=blocked" />
        <Button type="submit" variant="outline">
          <Ban className="size-4" />
          Block
        </Button>
      </form>
    );
  }

  if (relationship === "outgoing") {
    return <Badge variant="secondary">Request sent</Badge>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <form action={sendFriendRequestAction}>
        <input type="hidden" name="recipientUserId" value={userId} />
        <input type="hidden" name="next" value={next} />
        <Button type="submit" className="bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
          <UserPlus className="size-4" />
          Add friend
        </Button>
      </form>
      <form action={blockUserAction}>
        <input type="hidden" name="blockedUserId" value={userId} />
        <input type="hidden" name="next" value="/friends?user=blocked" />
        <Button type="submit" variant="outline">
          <Ban className="size-4" />
          Block
        </Button>
      </form>
    </div>
  );
}

function PublicProfileActivityLedger({
  profile,
  items,
}: {
  profile: PublicProfileData["profile"];
  items: ProfileActivityRow[];
}) {
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
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="activity"
                className="sticky left-0 z-20 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
                    className="sticky left-0 z-10 min-w-72 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <p className="font-semibold">{item.headline}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
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
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No public or friend-visible activity is available for this profile yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function PublicProfileBagComparison({
  profile,
  rows,
}: {
  profile: PublicProfileData["profile"];
  rows: ProfileGapRow[];
}) {
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

      <DataTableFrame label="Profile visible bag comparison table" stickyFirstColumn>
        <Table
          data-workbench-export-table="profile-bag-comparison"
          aria-describedby="profile-bag-comparison-summary"
        >
          <TableCaption id="profile-bag-comparison-summary" className="sr-only">
            Profile visible bag comparison table showing club, stock carry, stock total, confidence,
            sample size and compare action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="club"
                className="sticky left-0 z-20 min-w-64 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Club
              </TableHead>
              <TableHead data-column="carry">Carry</TableHead>
              <TableHead data-column="total">Total</TableHead>
              <TableHead data-column="confidence">Confidence</TableHead>
              <TableHead data-column="shots">Shots</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.clubId} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="club"
                    className="sticky left-0 z-10 min-w-64 bg-white font-semibold shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    {row.label}
                  </TableCell>
                  <TableCell data-column="carry">{formatYards(row.carryMedianYd)}</TableCell>
                  <TableCell data-column="total">{formatYards(row.totalMedianYd)}</TableCell>
                  <TableCell data-column="confidence">
                    {formatConfidence(row.confidenceScore)}
                  </TableCell>
                  <TableCell data-column="shots">
                    {integerFormatter.format(row.sampleSize)} shots
                  </TableCell>
                  <TableCell data-column="action" className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/compare" prefetch={false}>
                        <Target className="size-4" />
                        Compare
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Bag numbers are private or do not have enough trusted shots yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

const integerFormatter = new Intl.NumberFormat("en-GB");
const yardFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const confidenceFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatNullable(value: number | null) {
  return typeof value === "number" ? integerFormatter.format(value) : "--";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatYards(value: number | null) {
  return typeof value === "number" ? `${yardFormatter.format(value)} yd` : "--";
}

function formatConfidence(value: number | null) {
  return typeof value === "number" ? `${confidenceFormatter.format(value)}%` : "--";
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

function profileHeaderBackground(imageUrl: string) {
  return `linear-gradient(90deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0)), url("${imageUrl.replace(/"/g, "%22")}")`;
}

function profileHeaderImageUrl(headerImageUrl: string | null | undefined, username: string) {
  return headerImageUrl ?? tourCoverForKey(username);
}

function tourCoverForKey(key: string) {
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % TOUR_COVER_COUNT;
  }

  return `/assets/tour-covers/tour-cover-${String(hash + 1).padStart(2, "0")}.webp`;
}
