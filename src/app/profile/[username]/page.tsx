import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Ban,
  BarChart3,
  GitCompareArrows,
  ShieldCheck,
  Target,
  Trophy,
  UserCheck,
  UserPlus,
} from "lucide-react";

import { blockUserAction, followUserAction, sendFriendRequestAction, unfollowUserAction } from "@/app/friends/actions";
import { FeedCardList } from "@/components/social/feed-card-list";
import { SocialAvatar } from "@/components/social/social-avatar";
import {
  DataPanel,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { getProfilePageData, type ProfileGapRow, type SocialProfileSummary } from "@/lib/social";

export const dynamic = "force-dynamic";

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
  const coverImageUrl = profile.headerImageUrl ?? (profile.isTourPlayer ? tourCoverImageForUsername(profile.username) : null);
  const visibleClubCount = data.stats.gapLadder.length;
  const handicapLabel = data.stats.handicapBand ?? "--";
  const headerMetrics = profile.isTourPlayer
    ? [
        { label: "Home", value: profile.homeCourse ?? "--", detail: "Tour venue profile" },
        { label: "Shot source", value: "Tour rounds", detail: "Course-shot evidence" },
        { label: "Handicap band", value: profile.handicapBand ?? "--", detail: "Tour profile" },
      ]
    : [
        { label: "Home", value: profile.homeCourse ?? "--", detail: "Course or simulator venue" },
        { label: "Launch monitor", value: profile.primaryLaunchMonitor ?? "--", detail: "Primary setup" },
        { label: "Handicap band", value: data.stats.handicapBand ?? "--", detail: "Generated from Handicap page" },
      ];

  return (
    <PageShell size="6xl">
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
            {profile.isTourPlayer ? "Tour player" : profile.relationship === "friend" ? "Friend profile" : "Social profile"}
          </StatusPill>
        }
        title={profile.displayName}
        description={profile.bio ?? "ForeKingHell golfer"}
        actions={
          isSelf ? (
            <Button asChild variant="outline">
              <Link href="/profile" prefetch={false}>
                <ShieldCheck className="size-4" />
                Edit profile
              </Link>
            </Button>
          ) : (
            <ProfileActions profile={profile} viewerUserId={data.viewerProfile?.userId ?? null} next={`/profile/${profile.username}`} />
          )
        }
        metrics={headerMetrics}
      />

      <article className="premium-card overflow-hidden">
        <div
          className="relative h-36 bg-[linear-gradient(135deg,#0f172a,#047857_58%,#38bdf8)] bg-cover bg-center sm:h-44"
          style={coverImageUrl ? { backgroundImage: profileHeaderBackground(coverImageUrl) } : undefined}
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.2),rgba(15,23,42,0.62))]" />
          {profile.isTourPlayer ? (
            <Badge variant="secondary" className="absolute right-4 top-4 bg-white/90 text-emerald-800 shadow-sm">
              Tour player
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 px-4 pb-5 sm:px-5">
          <div className="flex min-w-0 items-end gap-3">
            <div className="-mt-10 shrink-0 rounded-full bg-white p-1 shadow-sm">
              <SocialAvatar
                displayName={profile.displayName}
                username={profile.username}
                avatarUrl={profile.avatarUrl}
                size="lg"
              />
            </div>
            <div className="min-w-0 pt-3">
              <h2 className="truncate text-2xl font-semibold tracking-normal">{profile.displayName}</h2>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-56">
            <MiniReadout label="Clubs" value={formatNullable(visibleClubCount)} />
            <MiniReadout label="Handicap" value={handicapLabel} />
          </div>
        </div>
      </article>

      <DataPanel>
        <SectionHeader
          title="Club gapping"
          description={
            profile.isTourPlayer
              ? "Tour stock yardages and comparison-ready bag context."
              : "Profile-approved stock yardages and useful bag context for comparison."
          }
          action={<BarChart3 className="size-5 text-sky-600" />}
        />
        <CardContent className="grid gap-5">
          <div className="grid gap-2 sm:grid-cols-3">
            <StatRow icon={<Trophy className="size-4" />} label="Rounds" value={formatNullable(data.stats.rounds)} />
            <StatRow icon={<BarChart3 className="size-4" />} label="Mapped clubs" value={formatNullable(visibleClubCount)} />
            <StatRow icon={<Target className="size-4" />} label="Handicap band" value={handicapLabel} />
          </div>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold tracking-normal">Gap ladder</p>
                <p className="text-sm text-muted-foreground">Stock yardages by club, ordered from longest carry down.</p>
              </div>
              <GitCompareArrows className="size-5 text-emerald-600" />
            </div>
            <GapLadder rows={data.stats.gapLadder} />
          </div>
        </CardContent>
      </DataPanel>

      <DataPanel>
        <SectionHeader
          title="Recent feed"
          description="Status updates, PBs, achievements, rounds and challenge cards that this profile allows you to see."
        />
        <CardContent className="bg-[#F7F8F6]">
          <div className="mx-auto w-full max-w-4xl">
            <FeedCardList items={data.recentFeed} compact />
          </div>
        </CardContent>
      </DataPanel>
    </PageShell>
  );
}

function ProfileActions({
  profile,
  viewerUserId,
  next,
}: {
  profile: SocialProfileSummary;
  viewerUserId: string | null;
  next: string;
}) {
  const compareHref = viewerUserId
    ? `/compare?playerAId=${encodeURIComponent(viewerUserId)}&playerBId=${encodeURIComponent(profile.userId)}`
    : `/compare?playerBId=${encodeURIComponent(profile.userId)}`;

  if (profile.isTourPlayer) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
          <Link href={compareHref} prefetch={false}>
            <GitCompareArrows className="size-4" />
            Compare with
          </Link>
        </Button>
        {profile.isFollowing ? (
          <form action={unfollowUserAction}>
            <input type="hidden" name="followedUserId" value={profile.userId} />
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline">
              <UserCheck className="size-4" />
              Following
            </Button>
          </form>
        ) : (
          <form action={followUserAction}>
            <input type="hidden" name="followedUserId" value={profile.userId} />
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline">
              <UserPlus className="size-4" />
              Follow
            </Button>
          </form>
        )}
      </div>
    );
  }

  if (profile.relationship === "friend") {
    return (
      <form action={blockUserAction}>
        <input type="hidden" name="blockedUserId" value={profile.userId} />
        <input type="hidden" name="next" value="/friends?user=blocked" />
        <Button type="submit" variant="outline">
          <Ban className="size-4" />
          Block
        </Button>
      </form>
    );
  }

  if (profile.relationship === "outgoing") {
    return <Badge variant="secondary">Request sent</Badge>;
  }

  if (!profile.canReceiveFriendRequests) {
    return <Badge variant="outline">Follow-only</Badge>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <form action={sendFriendRequestAction}>
        <input type="hidden" name="recipientUserId" value={profile.userId} />
        <input type="hidden" name="next" value={next} />
        <Button type="submit" className="bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
          <UserPlus className="size-4" />
          Add friend
        </Button>
      </form>
      <form action={blockUserAction}>
        <input type="hidden" name="blockedUserId" value={profile.userId} />
        <input type="hidden" name="next" value="/friends?user=blocked" />
        <Button type="submit" variant="outline">
          <Ban className="size-4" />
          Block
        </Button>
      </form>
    </div>
  );
}

function GapLadder({ rows }: { rows: ProfileGapRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No visible stock yardages yet.</p>;
  }

  const longestCarry = Math.max(...rows.map((row) => row.carryMedianYd ?? 0), 1);

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.clubId} className="grid gap-3 rounded-lg border bg-white px-3 py-3 shadow-sm md:grid-cols-[minmax(14rem,1fr)_minmax(8rem,13rem)_minmax(12rem,auto)] md:items-center">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{row.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatStockSampleCount(row.sampleSize)} · {formatConfidence(row.confidenceScore)} confidence
            </p>
          </div>
          <div className="grid gap-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0B7A3B]"
                style={{ width: `${Math.max(8, ((row.carryMedianYd ?? 0) / longestCarry) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Carry distance profile</p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:min-w-52">
            <MiniReadout label="Carry" value={formatYards(row.carryMedianYd)} />
            <MiniReadout label="Total" value={formatYards(row.totalMedianYd)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2">
      <p className="truncate text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-slate-50 px-3 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-emerald-700 ring-1 ring-slate-200">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-muted-foreground">{label}</span>
        <span className="block truncate text-base font-semibold tabular-nums">{value}</span>
      </span>
    </div>
  );
}

function formatYards(value: number | null) {
  return typeof value === "number" ? `${value.toFixed(1)} yd` : "--";
}

function formatConfidence(value: number | null) {
  return typeof value === "number" ? `${Math.round(value)}%` : "--";
}

function formatStockSampleCount(value: number) {
  return `${new Intl.NumberFormat("en-GB").format(value)} stock ${value === 1 ? "sample" : "samples"}`;
}

function formatNullable(value: number | null) {
  return typeof value === "number" ? new Intl.NumberFormat("en-GB").format(value) : "--";
}

const TOUR_COVER_IMAGE_URLS = [
  "/assets/tour-covers/tour-cover-01.webp",
  "/assets/tour-covers/tour-cover-02.webp",
  "/assets/tour-covers/tour-cover-03.webp",
  "/assets/tour-covers/tour-cover-04.webp",
  "/assets/tour-covers/tour-cover-05.webp",
  "/assets/tour-covers/tour-cover-06.webp",
  "/assets/tour-covers/tour-cover-07.webp",
  "/assets/tour-covers/tour-cover-08.webp",
  "/assets/tour-covers/tour-cover-09.webp",
  "/assets/tour-covers/tour-cover-10.webp",
];

function tourCoverImageForUsername(username: string) {
  let hash = 0;

  for (const char of username) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return TOUR_COVER_IMAGE_URLS[hash % TOUR_COVER_IMAGE_URLS.length];
}

function profileHeaderBackground(imageUrl: string) {
  return `linear-gradient(90deg, rgba(15, 23, 42, 0.56), rgba(6, 78, 59, 0.18)), url("${imageUrl.replace(/"/g, "%22")}")`;
}
