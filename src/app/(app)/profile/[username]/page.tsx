import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, ExternalLink, ShieldCheck, Target, UserPlus, Users } from "lucide-react";

import { blockUserAction, sendFriendRequestAction } from "@/app/friends/actions";
import { AppEmptyState } from "@/components/app/app-empty-state";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { FeedCardList } from "@/components/social/feed-card-list";
import { SocialAvatar } from "@/components/social/social-avatar";
import { MobileAppShell, MobileStatusAction } from "@/components/mobile-sports";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
  type IOSDisclosureItem,
} from "@/components/app/ios-mobile";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

const TOUR_COVER_COUNT = 10;
const mobileProfileActivityLimit = 5;

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
  const [data, surface] = await Promise.all([getProfilePageData(username), getRequestAppSurface()]);

  if (!data) {
    notFound();
  }

  const profile = data.profile;
  const isSelf = profile.relationship === "self";
  const mobileProfileActivity = data.recentFeed.slice(0, mobileProfileActivityLimit);
  const mobileOlderActivity = data.recentFeed.slice(mobileProfileActivityLimit);
  const workbenchModule =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopWorkbenchLayout = workbenchModule?.DesktopWorkbenchLayout;

  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileAppShell>
          <MobilePublicProfileSummary profile={profile} stats={data.stats} isSelf={isSelf} />
          <MobileProfileActivity
            profile={profile}
            items={mobileProfileActivity}
            olderItems={mobileOlderActivity}
          />
          <MobileProfileDetails profile={profile} stats={data.stats} isSelf={isSelf} />
        </MobileAppShell>
      ) : null}

      {DesktopWorkbenchLayout ? (
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

          <article aria-label="Public profile summary">
            <Card className="gap-0 py-0">
              <div
                className="h-36 bg-cover bg-center"
                style={{
                  backgroundImage: profileHeaderBackground(
                    profileHeaderImageUrl(profile.headerImageUrl, profile.username),
                  ),
                }}
              />
              <CardContent className="flex flex-wrap items-start justify-between gap-3 px-5 pb-5 pt-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="-mt-12 rounded-full bg-card p-1 shadow-sm">
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
              </CardContent>
            </Card>
          </article>

          <section className="grid gap-4 lg:grid-cols-[0.35fr_0.65fr]">
            <aside aria-label="Public profile stats rail" className="min-w-0">
              <DataPanel>
                <SectionHeader
                  title="Visible stats"
                  description="Only profile-approved summary data appears here."
                  action={<Users className="size-5 text-primary" />}
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

            <section data-profile-recent-feed className="grid gap-3">
              <div className="grid gap-1">
                <h2 className="text-lg font-semibold tracking-normal text-foreground sm:text-xl">
                  Recent feed
                </h2>
                <p className="text-sm text-muted-foreground">
                  Generated PB, achievement, round, and challenge cards that this profile allows you
                  to see.
                </p>
              </div>
              <FeedCardList items={data.recentFeed} compact />
            </section>
          </section>

          <PublicProfileActivityLedger profile={profile} items={data.recentFeed} />

          <PublicProfileBagComparison profile={profile} rows={data.stats.gapLadder} />
        </DesktopWorkbenchLayout>
      ) : null}
    </PageShell>
  );
}

function MobilePublicProfileSummary({
  profile,
  stats,
  isSelf,
}: {
  profile: PublicProfileData["profile"];
  stats: PublicProfileData["stats"];
  isSelf: boolean;
}) {
  return (
    <>
      <header className="grid min-w-0 gap-3 pt-2" aria-label="Profile identity">
        <div className="flex min-w-0 items-center gap-3">
          <SocialAvatar
            displayName={profile.displayName}
            username={profile.username}
            avatarUrl={profile.avatarUrl}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="text-[1.75rem] font-bold leading-[1.08] tracking-[-0.028em] [overflow-wrap:anywhere] min-[360px]:text-[2rem]">
              {profile.displayName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
              @{profile.username}
            </p>
          </div>
        </div>
        {profile.bio ? (
          <p className="text-sm leading-6 text-muted-foreground">{profile.bio}</p>
        ) : null}
      </header>

      <MobileStatusAction
        label="Connection"
        value={titleCase(profile.relationship)}
        detail={profile.publicProfile ? "Public profile" : "Friend-scoped profile"}
        action={
          isSelf ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/profile" prefetch={false}>
                Edit
              </Link>
            </Button>
          ) : profile.relationship === "incoming" ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/friends" prefetch={false}>
                Review
              </Link>
            </Button>
          ) : profile.relationship === "outgoing" ? (
            <IOSInlineStatus label="Request sent" tone="attention" />
          ) : profile.relationship !== "friend" ? (
            <form action={sendFriendRequestAction}>
              <input type="hidden" name="recipientUserId" value={profile.userId} />
              <input type="hidden" name="next" value={`/profile/${profile.username}`} />
              <Button type="submit" className="min-h-11">
                <UserPlus className="size-4" />
                Add
              </Button>
            </form>
          ) : undefined
        }
      />

      <IOSGroupedList label="Visible profile summary">
        <IOSListRow label="Home" value={profile.homeCourse ?? "Not shared"} />
        <IOSListRow label="Launch monitor" value={profile.primaryLaunchMonitor ?? "Not shared"} />
        <IOSListRow label="Handicap band" value={stats.handicapBand ?? "Not shared"} />
        <IOSListRow label="Visible rounds" value={formatNullable(stats.rounds)} />
      </IOSGroupedList>
    </>
  );
}

function MobileProfileActivity({
  profile,
  items,
  olderItems,
}: {
  profile: PublicProfileData["profile"];
  items: ProfileActivityRow[];
  olderItems: ProfileActivityRow[];
}) {
  return (
    <section className="grid gap-2" aria-label="Visible profile activity">
      <IOSSectionHeader
        title="Recent activity"
        description={`${items.length + olderItems.length} privacy-approved ${items.length + olderItems.length === 1 ? "update" : "updates"}`}
      />
      <MobileProfileActivityRows profile={profile} items={items} />
      {olderItems.length > 0 ? (
        <IOSDisclosureGroup
          label="Older profile activity"
          items={[
            {
              value: "older-profile-activity",
              title: "Older activity",
              summary: olderItems.length,
              description: "More updates this golfer allows you to see",
              contentClassName: "px-0 pb-0 pt-0",
              content: <MobileProfileActivityRows profile={profile} items={olderItems} />,
            },
          ]}
        />
      ) : null}
    </section>
  );
}

function MobileProfileActivityRows({
  profile,
  items,
}: {
  profile: PublicProfileData["profile"];
  items: ProfileActivityRow[];
}) {
  return (
    <IOSGroupedList label="Profile activity updates">
      {items.length > 0 ? (
        items.map((item) => {
          const engagement = item.reactionCount + item.commentCount;

          return (
            <IOSListRow
              key={item.id}
              label={item.headline}
              value={item.metricValue ?? undefined}
              detail={`${dateFormatter.format(item.createdAt)} · ${item.verificationLabel}`}
              href={item.proofUrl ?? `/profile/${profile.username}`}
              status={
                engagement > 0 ? (
                  <IOSInlineStatus
                    label={`${item.reactionCount} kudos · ${item.commentCount} comments`}
                    tone="positive"
                  />
                ) : undefined
              }
            />
          );
        })
      ) : (
        <IOSListRow
          label="No visible activity"
          detail="This golfer has not shared any feed updates with you yet."
        />
      )}
    </IOSGroupedList>
  );
}

function MobileProfileDetails({
  profile,
  stats,
  isSelf,
}: {
  profile: PublicProfileData["profile"];
  stats: PublicProfileData["stats"];
  isSelf: boolean;
}) {
  const items: IOSDisclosureItem[] = [
    {
      value: "visible-bag",
      title: "Visible bag",
      summary: `${stats.gapLadder.length} ${stats.gapLadder.length === 1 ? "club" : "clubs"}`,
      description: "Trusted distances this golfer has chosen to share",
      contentClassName: "px-0 pb-0 pt-0",
      content: (
        <IOSGroupedList label="Visible bag distances" className="border-0">
          {stats.gapLadder.length > 0 ? (
            stats.gapLadder.map((row) => (
              <IOSListRow
                key={row.clubId}
                label={row.label}
                value={formatYards(row.carryMedianYd)}
                detail={`${formatYards(row.totalMedianYd)} total · ${integerFormatter.format(row.sampleSize)} shots · ${formatConfidence(row.confidenceScore)} confidence`}
                href="/compare"
              />
            ))
          ) : (
            <IOSListRow
              label="No trusted bag data shared"
              detail="Distances are private or do not have enough trusted shots yet."
            />
          )}
        </IOSGroupedList>
      ),
    },
  ];

  if (!isSelf) {
    items.push({
      value: "profile-safety",
      title: "Profile safety",
      summary: "Block",
      description: "Hide this golfer from friend-scoped activity",
      contentClassName: "px-0 pb-0 pt-0",
      content: (
        <IOSGroupedList label="Profile safety action" className="border-0">
          <IOSListRow
            label="Block this profile"
            detail="This removes friend visibility and returns you to Friends."
            destructive
            trailing={
              <form action={blockUserAction}>
                <input type="hidden" name="blockedUserId" value={profile.userId} />
                <input type="hidden" name="next" value="/friends?user=blocked" />
                <ConfirmSubmitButton
                  type="submit"
                  variant="destructive"
                  className="min-h-11"
                  confirmTitle="Block this golfer?"
                  confirmMessage="This removes friend visibility and hides their friend-scoped activity from your account."
                  confirmActionLabel="Block golfer"
                >
                  Block
                </ConfirmSubmitButton>
              </form>
            }
          />
        </IOSGroupedList>
      ),
    });
  }

  return <IOSDisclosureGroup label="Profile details" items={items} />;
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
        <ConfirmSubmitButton
          type="submit"
          variant="outline"
          confirmTitle="Block this golfer?"
          confirmMessage="This removes friend visibility and hides their friend-scoped activity from your account."
          confirmActionLabel="Block golfer"
        >
          <Ban className="size-4" />
          Block
        </ConfirmSubmitButton>
      </form>
    );
  }

  if (relationship === "outgoing") {
    return <Badge variant="secondary">Request sent</Badge>;
  }

  if (relationship === "incoming") {
    return (
      <Button asChild variant="outline">
        <Link href="/friends" prefetch={false}>
          Review request
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <form action={sendFriendRequestAction}>
        <input type="hidden" name="recipientUserId" value={userId} />
        <input type="hidden" name="next" value={next} />
        <Button type="submit">
          <UserPlus className="size-4" />
          Add friend
        </Button>
      </form>
      <form action={blockUserAction}>
        <input type="hidden" name="blockedUserId" value={userId} />
        <input type="hidden" name="next" value="/friends?user=blocked" />
        <ConfirmSubmitButton
          type="submit"
          variant="outline"
          confirmTitle="Block this golfer?"
          confirmMessage="This removes friend visibility and hides their friend-scoped activity from your account."
          confirmActionLabel="Block golfer"
        >
          <Ban className="size-4" />
          Block
        </ConfirmSubmitButton>
      </form>
    </div>
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

      <DataTableFrame label="Profile visible bag comparison table" stickyFirstColumn>
        <Table
          data-workbench-export-table="profile-bag-comparison"
          aria-describedby="profile-bag-comparison-summary"
        >
          <TableCaption id="profile-bag-comparison-summary" className="sr-only">
            Profile visible bag comparison table showing club, stock carry, stock total, confidence,
            sample size and compare action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
            <TableRow>
              <TableHead
                data-column="club"
                className="sticky left-0 z-20 min-w-64 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
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
                    className="sticky left-0 z-10 min-w-64 bg-card font-semibold shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
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
                <TableCell colSpan={6} className="p-4">
                  <AppEmptyState
                    icon={<Target className="size-5" />}
                    title="No shared bag evidence"
                    description="Bag numbers are private or do not have enough trusted measured shots yet."
                    primaryAction={
                      <Button asChild variant="outline" size="sm">
                        <Link href="/compare" prefetch={false}>
                          Open compare
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
