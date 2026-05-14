import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, ShieldCheck, UserPlus, Users } from "lucide-react";

import { blockUserAction, sendFriendRequestAction } from "@/app/friends/actions";
import { FeedCardList } from "@/components/social/feed-card-list";
import {
  DataPair,
  DataPanel,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { getProfilePageData } from "@/lib/social";

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
        eyebrow={<StatusPill tone={profile.publicProfile ? "green" : "sky"}>{profile.relationship === "friend" ? "Friend profile" : "Social profile"}</StatusPill>}
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
            <ProfileActions userId={profile.userId} relationship={profile.relationship} next={`/profile/${profile.username}`} />
          )
        }
        metrics={[
          { label: "Home", value: profile.homeCourse ?? "--", detail: "Course or simulator venue" },
          { label: "Launch monitor", value: profile.primaryLaunchMonitor ?? "--", detail: "Primary setup" },
          { label: "Handicap band", value: profile.handicapBand ?? "--", detail: "Self-selected" },
          { label: "Connection", value: titleCase(profile.relationship), detail: profile.publicProfile ? "Public opt-in" : "Friend scoped" },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[0.35fr_0.65fr]">
        <DataPanel>
          <SectionHeader
            title="Visible stats"
            description="Only profile-approved summary data appears here."
            action={<Users className="size-5 text-sky-600" />}
          />
          <CardContent className="grid gap-3">
            <DataPair label="Rounds" value={formatNullable(data.stats.rounds)} />
            <DataPair label="Practice shots" value={formatNullable(data.stats.shots)} />
            <DataPair
              label="Best shot"
              value={data.stats.bestShot?.totalYd ? `${data.stats.bestShot.clubType} ${data.stats.bestShot.totalYd.toFixed(1)} yd` : "--"}
            />
          </CardContent>
        </DataPanel>

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
        <Button type="submit" className="bg-[#111827] text-white">
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

function formatNullable(value: number | null) {
  return typeof value === "number" ? new Intl.NumberFormat("en-GB").format(value) : "--";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
