import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  Activity,
  Award,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  ExternalLink,
  Flag,
  Gauge,
  LockKeyhole,
  MapPin,
  Medal,
  Radio,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { and, desc, eq } from "drizzle-orm";

import { updateSocialProfileAction } from "@/app/profile/actions";
import { ProfileEditSheet } from "@/app/profile/profile-edit-sheet";
import { ProfileMediaEditor } from "@/app/profile/profile-media-editor";
import { ProfileSectionTabs } from "@/app/profile/profile-section-tabs";
import { ProfileShareDialog } from "@/app/profile/profile-share-dialog";
import { MobileAppShell } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db/client";
import { courseRecordCategories, courseRecordResults, courseRecords, courses } from "@/db/schema";
import { getAchievementPageData, type AchievementView } from "@/lib/achievements/service";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { getProfileInitials } from "@/lib/profile-initials";
import { buildProfileHonoursRecords } from "@/lib/profile-honours";
import { getSiteOrigin } from "@/lib/site-origin";
import {
  defaultProfileVisibilitySettings,
  ensureCurrentSocialProfile,
  getProfilePageData,
  parseVisibility,
  socialVisibilityOptions,
  type FeedItemView,
} from "@/lib/social";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ProfilePageProps = {
  searchParams?: Promise<{
    saved?: string;
  }>;
};

const TOUR_COVER_COUNT = 10;
const profileFormId = "profile-settings-form";

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [params, profile, surface] = await Promise.all([
    searchParams,
    ensureCurrentSocialProfile(),
    getRequestAppSurface(),
  ]);
  const [achievements, honours, publicData] = await Promise.all([
    getAchievementPageData(profile.userId),
    getProfileHonoursData(profile.userId),
    getProfilePageData(profile.username),
  ]);
  const workbench =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopWorkbenchLayout = workbench?.DesktopWorkbenchLayout;
  const origin = getSiteOrigin();
  const profileUrl = `${origin}/profile/${profile.username}`;
  const visibility = {
    ...defaultProfileVisibilitySettings(),
    ...profile.visibilitySettingsJson,
  };
  const profileVisibility = profile.publicProfile
    ? "Public"
    : profile.friendProfile
      ? "Friends"
      : "Private";
  const recentFeed = publicData?.recentFeed ?? [];
  const handicapValue =
    publicData?.stats.handicapEstimate ?? publicData?.stats.handicapBand ?? profile.handicapBand;
  const handicap = formatHandicap(handicapValue);
  const featuredAchievements = selectProfileAchievements(achievements.achievements);

  const experience = (
    <div className="grid min-w-0 gap-5 pb-6" data-profile-identity-page>
      {params?.saved ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Profile saved</AlertTitle>
          <AlertDescription>
            Your golf identity and sharing choices are up to date.
          </AlertDescription>
        </Alert>
      ) : null}

      <ProfileIdentityHero
        profile={profile}
        handicap={handicap}
        visibilityLabel={profileVisibility}
        profileUrl={profileUrl}
        editSheet={
          <ProfileEditSheet>
            <ProfileEditForm profile={profile} visibility={visibility} />
          </ProfileEditSheet>
        }
      />

      <ProfileSectionTabs
        overview={
          <ProfileOverview
            profile={profile}
            handicap={handicap}
            recentFeed={recentFeed}
            recentAchievement={achievements.recentUnlocks[0] ?? null}
            recentRecord={honours.records[0] ?? null}
          />
        }
        achievements={
          <ProfileAchievements
            achievements={featuredAchievements}
            unlockedCount={achievements.unlockedCount}
            totalCount={achievements.totalCount}
            totalXp={achievements.totalXp}
          />
        }
        records={
          <ProfileRecords records={honours.records} launchRecords={profile.pbShowcaseJson} />
        }
        sharing={
          <ProfileSharing
            profile={profile}
            profileUrl={profileUrl}
            visibility={visibility}
            visibilityLabel={profileVisibility}
          />
        }
      />
    </div>
  );

  return (
    <PageShell>
      {surface === "companion" ? (
        <MobileAppShell>{experience}</MobileAppShell>
      ) : DesktopWorkbenchLayout ? (
        <DesktopWorkbenchLayout scope="profile">{experience}</DesktopWorkbenchLayout>
      ) : null}
    </PageShell>
  );
}

type SocialProfile = Awaited<ReturnType<typeof ensureCurrentSocialProfile>>;
type ProfileVisibility = NonNullable<SocialProfile["visibilitySettingsJson"]>;
type ProfileHonoursData = Awaited<ReturnType<typeof getProfileHonoursData>>;
type ProfileRecord = ProfileHonoursData["records"][number];

function ProfileIdentityHero({
  profile,
  handicap,
  visibilityLabel,
  profileUrl,
  editSheet,
}: {
  profile: SocialProfile;
  handicap: string | null | undefined;
  visibilityLabel: string;
  profileUrl: string;
  editSheet: ReactNode;
}) {
  return (
    <header
      className="overflow-hidden rounded-[1.65rem] border bg-card shadow-[0_18px_60px_-34px_rgba(2,44,24,0.65)]"
      aria-label="Golf identity"
    >
      <div
        className="relative min-h-44 bg-cover bg-center sm:min-h-56 lg:min-h-64"
        style={{
          backgroundImage: profileHeaderBackground(
            profileHeaderImageUrl(profile.headerImageUrl, profile.username),
          ),
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,20,12,0.04)_5%,rgba(2,20,12,0.14)_48%,rgba(2,20,12,0.78)_100%)]" />
        <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
          <Badge className="border-white/25 bg-black/32 text-white shadow-sm backdrop-blur-md hover:bg-black/38">
            <Flag className="size-3.5" /> Golf identity
          </Badge>
        </div>
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
          <ProfileShareDialog username={profile.username} profileUrl={profileUrl} />
        </div>
      </div>

      <div className="relative grid gap-4 px-4 pb-5 sm:px-6 sm:pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex min-w-0 items-end gap-4">
          <Avatar className="-mt-12 size-24 border-[5px] border-card bg-card shadow-xl sm:-mt-16 sm:size-32">
            {profile.avatarUrl ? (
              <AvatarImage src={profile.avatarUrl} alt={`${profile.displayName} profile photo`} />
            ) : null}
            <AvatarFallback className="bg-[linear-gradient(145deg,#0d7a3d,#073b25)] text-2xl font-bold text-white sm:text-3xl">
              {getProfileInitials(profile.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 pb-1">
            <h1 className="truncate text-[1.85rem] font-bold leading-none tracking-[-0.035em] sm:text-[2.35rem]">
              {profile.displayName}
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground sm:text-base">
              @{profile.username}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">{editSheet}</div>

        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <IdentityChip icon={<MapPin className="size-3.5" />}>
            {profile.homeCourse ?? "Add home course"}
          </IdentityChip>
          <IdentityChip icon={<Gauge className="size-3.5" />}>
            {handicap ? `HCP ${handicap}` : "Handicap not set"}
          </IdentityChip>
          <IdentityChip icon={<CircleUserRound className="size-3.5" />}>
            {visibilityLabel}
          </IdentityChip>
        </div>
      </div>
    </header>
  );
}

function IdentityChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-muted/45 px-3 text-xs font-medium text-foreground sm:text-sm">
      <span className="text-primary">{icon}</span>
      {children}
    </span>
  );
}

function ProfileOverview({
  profile,
  handicap,
  recentFeed,
  recentAchievement,
  recentRecord,
}: {
  profile: SocialProfile;
  handicap: string | null | undefined;
  recentFeed: FeedItemView[];
  recentAchievement: AchievementView | null;
  recentRecord: ProfileRecord | null;
}) {
  const highlight = buildRecentHighlight(recentFeed[0], recentAchievement, recentRecord);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(280px,0.78fr)]">
      <div className="grid min-w-0 gap-4">
        <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--card)_94%,var(--primary)_6%),var(--card))]">
          <CardHeader className="pb-0">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
              Golf profile
            </p>
            <CardTitle className="text-xl sm:text-2xl">This is your game</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-w-3xl text-[0.98rem] leading-7 text-muted-foreground">
              {profile.bio ??
                "Add a short profile that tells golfers and coaches where you play and what kind of game you are building."}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-amber-500/20 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_42%),var(--card)]">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-amber-500/14 text-amber-700 dark:text-amber-300">
              <Sparkles className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Recent highlight
              </p>
              <p className="mt-1 text-lg font-semibold leading-6">{highlight.title}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{highlight.detail}</p>
            </div>
            {highlight.href ? (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="justify-self-start sm:justify-self-end"
              >
                <Link href={highlight.href} prefetch={false}>
                  View <ChevronRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <RecentMeaningfulActivity items={recentFeed.slice(0, 4)} />
      </div>

      <aside className="grid content-start gap-3" aria-label="Current golf identity details">
        <OverviewFact
          icon={<Gauge className="size-5" />}
          label="Current handicap"
          value={handicap ?? "Not available"}
          detail={
            handicap
              ? "Current ForeKingHell handicap view"
              : "Complete scored rounds to establish it"
          }
        />
        <OverviewFact
          icon={<MapPin className="size-5" />}
          label="Favourite / home course"
          value={profile.homeCourse ?? "Not set"}
          detail="The course at the centre of your golf identity"
        />
        <OverviewFact
          icon={<Radio className="size-5" />}
          label="Launch monitor"
          value={profile.primaryLaunchMonitor ?? "Not connected"}
          detail="Your primary measured-data source"
        />
      </aside>
    </div>
  );
}

function OverviewFact({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-base font-semibold">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentMeaningfulActivity({ items }: { items: FeedItemView[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="size-5 text-primary" /> Recent meaningful activity
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1">
        {items.length > 0 ? (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.proofUrl ?? "/feed"}
              prefetch={false}
              className="group flex min-w-0 items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-primary">
                <Target className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.headline}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {item.metricValue ? `${item.metricValue} · ` : ""}
                  {item.verificationLabel} · {dateFormatter.format(item.createdAt)}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))
        ) : (
          <div className="grid justify-items-center gap-2 py-8 text-center">
            <Activity className="size-7 text-muted-foreground" />
            <p className="font-medium">No meaningful activity yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Verified PBs, achievements, rounds and challenges will appear here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileAchievements({
  achievements,
  unlockedCount,
  totalCount,
  totalXp,
}: {
  achievements: AchievementView[];
  unlockedCount: number;
  totalCount: number;
  totalXp: number;
}) {
  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border bg-muted/24 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Achievement cabinet
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {unlockedCount} unlocked <span className="text-muted-foreground">of {totalCount}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalXp.toLocaleString("en-GB")} XP earned from measured golf.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/achievements" prefetch={false}>
            Full achievement cabinet <ExternalLink className="size-4" />
          </Link>
        </Button>
      </section>

      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
        aria-label="Achievement grid"
      >
        {achievements.map((achievement) => (
          <AchievementIdentityCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </div>
  );
}

function AchievementIdentityCard({ achievement }: { achievement: AchievementView }) {
  const locked = !achievement.unlocked;
  const color = achievementTierColor(achievement.tier);

  return (
    <Card
      className={cn(
        "relative min-h-52 overflow-hidden py-0 transition-transform hover:-translate-y-0.5 motion-reduce:transform-none",
        achievement.unlocked
          ? "border-emerald-500/35 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_46%),var(--card)]"
          : "border-dashed bg-muted/25 text-muted-foreground",
      )}
    >
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "grid size-12 place-items-center rounded-2xl border bg-background shadow-sm",
              locked && "grayscale opacity-65",
            )}
            style={{ color }}
          >
            {locked ? <LockKeyhole className="size-5" /> : <Medal className="size-6" />}
          </div>
          <Badge variant={achievement.unlocked ? "secondary" : "outline"} className="capitalize">
            {achievement.unlocked ? "Unlocked" : achievement.tier}
          </Badge>
        </div>
        <div className="mt-5 flex-1">
          <p className="font-semibold leading-5 text-foreground">{achievement.displayName}</p>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
            {achievement.displayDescription}
          </p>
        </div>
        {achievement.unlocked ? (
          <div className="mt-4 flex items-center justify-between text-xs font-medium text-[var(--status-success-foreground)]">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> Earned
            </span>
            <span>{achievement.xpAwarded.toLocaleString("en-GB")} XP</span>
          </div>
        ) : achievement.progressPercent !== null ? (
          <div className="mt-4 grid gap-1.5">
            <div className="flex justify-between text-[0.68rem]">
              <span>{achievement.progressLabel ?? "In progress"}</span>
              <span>{achievement.progressPercent}%</span>
            </div>
            <Progress value={achievement.progressPercent} className="h-1.5" />
          </div>
        ) : (
          <p className="mt-4 text-xs font-medium">Locked · {achievement.xp} XP</p>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileRecords({
  records,
  launchRecords,
}: {
  records: ProfileRecord[];
  launchRecords: Array<Record<string, unknown>>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <RecordCollection
        icon={<Flag className="size-5" />}
        eyebrow="On course"
        title="Personal course records"
        empty="No personal course records yet. Completed record attempts will appear here."
      >
        {records.map((record) => (
          <Link
            key={record.id}
            href={`/course-records/${record.recordId}`}
            prefetch={false}
            className="group flex items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:border-primary/35 hover:bg-muted/28"
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500/12 text-amber-700 dark:text-amber-300">
              {record.rank === 1 ? <Trophy className="size-5" /> : <Award className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{record.courseName}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {record.categoryName} ·{" "}
                {record.rank === 1 ? "Course champion" : `Rank #${record.rank ?? "--"}`}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold">{record.scoreLabel}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </RecordCollection>

      <RecordCollection
        icon={<Radio className="size-5" />}
        eyebrow="Measured"
        title="Launch-monitor records"
        empty="No launch-monitor records pinned yet. New verified PBs can be featured here."
      >
        {launchRecords.map((record, index) => {
          const display = launchRecordDisplay(record);

          return (
            <div
              key={`${display.title}-${index}`}
              className="flex items-center gap-3 rounded-xl border bg-background p-3"
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Target className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{display.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{display.detail}</p>
              </div>
              {display.value ? (
                <span className="shrink-0 text-sm font-semibold">{display.value}</span>
              ) : null}
            </div>
          );
        })}
      </RecordCollection>
    </div>
  );
}

function RecordCollection({
  icon,
  eyebrow,
  title,
  empty,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  empty: string;
  children: ReactNode[];
}) {
  const hasRecords = children.length > 0;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </p>
            <CardTitle className="mt-1 text-lg">{title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {hasRecords ? (
          children
        ) : (
          <div className="grid justify-items-center gap-2 py-10 text-center">
            <Award className="size-7 text-muted-foreground" />
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">{empty}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileSharing({
  profile,
  profileUrl,
  visibility,
  visibilityLabel,
}: {
  profile: SocialProfile;
  profileUrl: string;
  visibility: ProfileVisibility;
  visibilityLabel: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
      <div className="grid min-w-0 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Share2 className="size-5 text-primary" /> Profile sharing
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Your share link always respects the visibility choices attached to this golf identity.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            <SharingScope
              icon={<CircleUserRound className="size-5" />}
              label="Profile visibility"
              value={visibilityLabel}
              detail={
                profile.publicProfile
                  ? "Anyone with the link can open your public golf identity."
                  : profile.friendProfile
                    ? "Profile detail is limited to accepted friends."
                    : "Only you can see the full profile."
              }
            />
            <SharingScope
              icon={<UserRound className="size-5" />}
              label="Coach sharing"
              value={titleCase(parseVisibility(visibility.exactShots))}
              detail="Exact shot data follows this scope; summary profile data stays separate."
            />
            <SharingScope
              icon={<Users className="size-5" />}
              label="Friend scope"
              value={profile.friendProfile ? "Enabled" : "Limited"}
              detail={`PBs ${titleCase(parseVisibility(visibility.pbs, "friends"))} · rounds ${titleCase(parseVisibility(visibility.rounds))} · achievements ${titleCase(parseVisibility(visibility.achievements, "friends"))}.`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Share link</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <code className="min-w-0 break-all rounded-xl bg-muted px-3 py-3 text-xs">
              {profileUrl}
            </code>
            <ProfileShareDialog username={profile.username} profileUrl={profileUrl} />
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">Scan to view @{profile.username}</CardTitle>
          <p className="text-sm text-muted-foreground">
            A direct QR for your current profile link.
          </p>
        </CardHeader>
        <CardContent className="grid justify-items-center gap-3">
          <div className="rounded-2xl border bg-background p-3 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/friends/qr/${profile.username}`}
              alt={`QR code for @${profile.username}`}
              className="aspect-square w-full max-w-64"
            />
          </div>
          <Badge variant="secondary">
            <ShieldCheck className="size-3.5" /> Visibility protected
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function SharingScope({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-primary shadow-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{label}</p>
          <Badge variant="outline">{value}</Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function ProfileEditForm({
  profile,
  visibility,
}: {
  profile: SocialProfile;
  visibility: ProfileVisibility;
}) {
  return (
    <form
      id={profileFormId}
      action={updateSocialProfileAction}
      aria-label="Edit profile and privacy"
      className="grid gap-5 pt-4"
    >
      <ProfileMediaEditor
        displayName={profile.displayName}
        username={profile.username}
        initialAvatarUrl={profile.avatarUrl}
        initialHeaderImageUrl={profile.headerImageUrl}
        publicHref={`/profile/${profile.username}`}
        formId={profileFormId}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Username" name="username" defaultValue={profile.username} required />
        <FormField
          label="Display name"
          name="displayName"
          defaultValue={profile.displayName}
          required
        />
        <FormField
          label="Home course or venue"
          name="homeCourse"
          defaultValue={profile.homeCourse ?? ""}
        />
        <FormField
          label="Primary launch monitor"
          name="primaryLaunchMonitor"
          defaultValue={profile.primaryLaunchMonitor ?? ""}
        />
      </div>

      <label className="grid gap-2 text-sm font-medium">
        <span>Short golf profile</span>
        <Textarea name="bio" defaultValue={profile.bio ?? ""} rows={4} />
      </label>

      <fieldset className="grid gap-3 rounded-xl border bg-muted/25 p-4">
        <legend className="px-1 text-sm font-semibold">Profile visibility</legend>
        <CheckboxField
          name="publicProfile"
          label="Show my profile in public username search"
          defaultChecked={profile.publicProfile}
        />
        <CheckboxField
          name="friendProfile"
          label="Let accepted friends view my profile details"
          defaultChecked={profile.friendProfile}
        />
        <CheckboxField
          name="allowCompare"
          label="Allow eligible golfers to compare shared analysis"
          defaultChecked={profile.visibilitySettingsJson?.allowCompare === true}
        />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Generated feed cards"
          name="feedVisibilityDefault"
          defaultValue={parseVisibility(profile.feedVisibilityDefault)}
        />
        <SelectField
          label="Leaderboard visibility"
          name="leaderboardVisibility"
          defaultValue={parseVisibility(profile.leaderboardVisibility)}
        />
        <SelectField
          label="Rounds"
          name="roundsVisibility"
          defaultValue={parseVisibility(visibility.rounds)}
        />
        <SelectField
          label="PBs"
          name="pbsVisibility"
          defaultValue={parseVisibility(visibility.pbs, "friends")}
        />
        <SelectField
          label="Bag"
          name="bagVisibility"
          defaultValue={parseVisibility(visibility.bag)}
        />
        <SelectField
          label="Achievements"
          name="achievementsVisibility"
          defaultValue={parseVisibility(visibility.achievements, "friends")}
        />
        <SelectField
          label="Handicap"
          name="handicapVisibility"
          defaultValue={parseVisibility(visibility.handicap)}
        />
        <SelectField
          label="Practice activity"
          name="practiceVisibility"
          defaultValue={parseVisibility(visibility.practice, "friends")}
        />
        <SelectField
          label="Exact shot data / coach sharing"
          name="exactShotsVisibility"
          defaultValue={parseVisibility(visibility.exactShots)}
        />
      </div>

      <Button type="submit" className="w-full sm:w-fit">
        <ShieldCheck className="size-4" /> Save profile
      </Button>
    </form>
  );
}

function FormField({
  label,
  name,
  ...props
}: {
  label: string;
  name: string;
} & ComponentProps<typeof Input>) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <Input name={name} className="h-10 rounded-xl bg-background" {...props} />
    </label>
  );
}

function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch name={name} defaultChecked={defaultChecked} aria-label={label} />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger className="w-full bg-background">
          <SelectValue placeholder="Choose visibility" />
        </SelectTrigger>
        <SelectContent>
          {socialVisibilityOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {titleCase(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function selectProfileAchievements(achievements: AchievementView[]) {
  const unlocked = achievements
    .filter((achievement) => achievement.unlocked)
    .sort((left, right) => dateValue(right.unlockedAt) - dateValue(left.unlockedAt))
    .slice(0, 8);
  const locked = achievements
    .filter((achievement) => !achievement.unlocked)
    .sort((left, right) => (right.progressPercent ?? -1) - (left.progressPercent ?? -1))
    .slice(0, Math.max(4, 12 - unlocked.length));

  return [...unlocked, ...locked].slice(0, 12);
}

function buildRecentHighlight(
  feedItem: FeedItemView | undefined,
  achievement: AchievementView | null,
  record: ProfileRecord | null,
) {
  if (feedItem) {
    return {
      title: feedItem.headline,
      detail: [
        feedItem.metricValue,
        feedItem.verificationLabel,
        dateFormatter.format(feedItem.createdAt),
      ]
        .filter(Boolean)
        .join(" · "),
      href: feedItem.proofUrl ?? "/feed",
    };
  }

  if (achievement) {
    return {
      title: achievement.displayName,
      detail: `${achievement.displayDescription} · ${achievement.xpAwarded.toLocaleString("en-GB")} XP`,
      href: `/achievements?achievement=${encodeURIComponent(achievement.id)}`,
    };
  }

  if (record) {
    return {
      title: `${record.courseName} · ${record.scoreLabel}`,
      detail: `${record.categoryName} · ${record.rank === 1 ? "Course champion" : `Rank #${record.rank ?? "--"}`}`,
      href: `/course-records/${record.recordId}`,
    };
  }

  return {
    title: "Your next golf moment starts here",
    detail: "Import a measured session or complete a scored round to create a verified highlight.",
    href: "/import",
  };
}

function launchRecordDisplay(record: Record<string, unknown>) {
  const title = stringValue(record.label) ?? stringValue(record.club) ?? "Launch-monitor PB";
  const value = stringValue(record.value) ?? stringValue(record.metricValue);
  const detail =
    stringValue(record.metric) ??
    stringValue(record.metricLabel) ??
    stringValue(record.source) ??
    "Verified personal best";

  return { title, value, detail };
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function formatHandicap(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return handicapFormatter.format(value);
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? handicapFormatter.format(numericValue) : value.trim();
  }

  return null;
}

function achievementTierColor(tier: AchievementView["tier"]) {
  return {
    bronze: "#b45309",
    silver: "#64748b",
    gold: "#d97706",
    platinum: "#0891b2",
    diamond: "#4f46e5",
    hidden: "#71717a",
  }[tier];
}

function dateValue(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}

async function getProfileHonoursData(userId: string) {
  const rows = await getDb()
    .select({
      result: courseRecordResults,
      record: courseRecords,
      category: courseRecordCategories,
      course: courses,
    })
    .from(courseRecordResults)
    .innerJoin(courseRecords, eq(courseRecordResults.recordId, courseRecords.id))
    .innerJoin(courseRecordCategories, eq(courseRecords.categoryId, courseRecordCategories.id))
    .innerJoin(courses, eq(courseRecords.courseId, courses.id))
    .where(
      and(
        eq(courseRecordResults.userId, userId),
        eq(courseRecords.scope, "public"),
        eq(courseRecords.period, "all_time"),
      ),
    )
    .orderBy(desc(courseRecordResults.calculatedAt))
    .limit(24);

  return { records: buildProfileHonoursRecords(rows).slice(0, 12) };
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function profileHeaderBackground(imageUrl: string) {
  return `url("${imageUrl.replace(/"/g, "%22")}")`;
}

function profileHeaderImageUrl(headerImageUrl: string | null | undefined, username: string) {
  return headerImageUrl || tourCoverForKey(username);
}

function tourCoverForKey(key: string) {
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % TOUR_COVER_COUNT;
  }

  return `/assets/tour-covers/tour-cover-${String(hash + 1).padStart(2, "0")}.webp`;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const handicapFormatter = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
