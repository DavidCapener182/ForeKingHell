import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { headers } from "next/headers";
import {
  ArrowLeft,
  Award,
  Copy,
  Plus,
  QrCode,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";
import { and, desc, eq } from "drizzle-orm";

import { updateSocialProfileAction } from "@/app/profile/actions";
import { ProfileMediaEditor } from "@/app/profile/profile-media-editor";
import { DataHealthFeaturePanel, ProfileFeaturePanel } from "@/components/features/feature-panels";
import {
  MobileAppShell,
  MobileIconButton,
  MobileRouteTabs,
  MobileStatusAction,
  MobileTabBar,
  MobileTopBar,
  NativeListSection,
  PBCard,
  ProgressCard,
} from "@/components/mobile-sports";
import { DataPanel, PageHeader, PageShell, SectionHeader, StatusPill } from "@/components/premium";
import { PublicSharePreviewPanel } from "@/components/product-polish";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getDb } from "@/db/client";
import {
  courseRecordCategories,
  courseRecordResults,
  courseRecords,
  courses,
  tournamentStandings,
  tournaments,
} from "@/db/schema";
import { getChallengesPageData } from "@/lib/challenges";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { buildProfileHonoursRecords } from "@/lib/profile-honours";
import { getProgressData } from "@/lib/progress-data";
import { buildProgressSummary } from "@/lib/progress-summary";
import {
  defaultProfileVisibilitySettings,
  ensureCurrentSocialProfile,
  parseVisibility,
  socialVisibilityOptions,
} from "@/lib/social";

export const dynamic = "force-dynamic";

type ProfilePageProps = {
  searchParams?: Promise<{
    saved?: string;
    tab?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [params, requestHeaders, profile, challenges, progressData, featureData] =
    await Promise.all([
      searchParams,
      headers(),
      ensureCurrentSocialProfile(),
      getChallengesPageData(),
      getProgressData(),
      getFeatureIdeasData(),
    ]);
  const honours = await getProfileHonoursData(profile.userId);
  const progressSummary = buildProgressSummary(progressData.clubs);
  const activeTab = parseYouTab(params?.tab);
  const origin = getRequestOrigin(requestHeaders);
  const profileUrl = `${origin}/profile/${profile.username}`;
  const visibility = {
    ...defaultProfileVisibilitySettings(),
    ...profile.visibilitySettingsJson,
  };
  const completion = profileCompletion(profile);
  const pbShowcase = profile.pbShowcaseJson.slice(0, 3);
  const achievementShowcase = profile.achievementShowcaseJson.slice(0, 4);
  const profileFormId = "profile-settings-form";
  const shareAudiences = [
    {
      label: "Public sees",
      value: profile.publicProfile ? `@${profile.username}` : "Hidden",
      detail: profile.publicProfile
        ? "Public profile search, display name and chosen highlights."
        : "Public search is off until you enable it.",
    },
    {
      label: "Friends see",
      value: profile.friendProfile ? "Profile details" : "Limited",
      detail: `PBs ${titleCase(parseVisibility(visibility.pbs, "friends"))}; rounds ${titleCase(parseVisibility(visibility.rounds))}.`,
    },
    {
      label: "Coaches see",
      value: titleCase(parseVisibility(visibility.exactShots)),
      detail: "Exact shot data follows the explicit shot-data privacy setting.",
    },
  ];

  return (
    <PageShell size="6xl">
      <MobileAppShell>
        <MobileTopBar
          title="You"
          actions={
            <>
              <MobileIconButton href="/import" label="Add activity" icon={Plus} />
              <MobileIconButton href="/settings" label="Settings" icon={Settings} />
            </>
          }
        />
        <MobileRouteTabs group="social" activeKey="profile" />
        <MobileStatusAction
          label={`@${profile.username}`}
          value={profile.displayName}
          detail={
            profile.bio ??
            "Build your golf profile with records, PBs, bag progress and event results."
          }
          action={
            <Button asChild variant="outline" className="rounded-full">
              <Link href={`/profile/${profile.username}`} prefetch={false}>
                Public
              </Link>
            </Button>
          }
        />
        <MobileTabBar
          activeKey={activeTab}
          className="-mt-4"
          tabs={[
            { key: "progress", label: "Progress", href: "/profile" },
            { key: "records", label: "Records", href: "/profile?tab=records" },
            { key: "bag", label: "Bag", href: "/profile?tab=bag" },
            { key: "activity", label: "Activity", href: "/profile?tab=activity" },
          ]}
        />
        <PublicSharePreviewPanel audiences={shareAudiences} actionHref="/settings" />
        <DataHealthFeaturePanel data={featureData} />
        {activeTab === "records" ? (
          <NativeListSection title="Records">
            <div className="grid grid-cols-2 gap-2">
              <PBCard
                title="Course champions"
                value={honours.championCount}
                detail="Verified boards"
                href="/course-records"
              />
              <PBCard
                title="Tournament starts"
                value={honours.tournaments.length}
                detail="Event history"
                href="/tournaments"
              />
            </div>
            {honours.records.map((record) => (
              <Link
                key={record.id}
                href={`/course-records/${record.recordId}`}
                prefetch={false}
                className={
                  record.rank === 1
                    ? "rounded-lg border border-[#C7972B]/30 bg-[#C7972B]/10 p-3"
                    : "rounded-lg border border-[#E5E7EB] bg-white p-3"
                }
              >
                <Badge variant={record.rank === 1 ? "default" : "outline"}>
                  {record.rank === 1 ? "Champion" : `#${record.rank}`}
                </Badge>
                <p className="mt-2 font-semibold">{record.courseName}</p>
                <p className="mt-1 text-sm text-[#6B7280]">
                  {record.categoryName} · {record.scoreLabel}
                </p>
              </Link>
            ))}
          </NativeListSection>
        ) : activeTab === "bag" ? (
          <NativeListSection title="Bag">
            <ProgressCard
              title="Bag trust"
              value={`${progressSummary.totals.averageTrust}%`}
              detail={`${progressSummary.totals.clubs} clubs · ${progressSummary.totals.trackedCleanShots} clean shots`}
            />
            <div className="grid grid-cols-2 gap-2">
              <PBCard
                title="Best club"
                value={
                  progressSummary.rankings.mostTrusted
                    ? progressSummary.rankings.mostTrusted.clubType
                    : "--"
                }
                detail="Most trusted"
                href="/bag"
              />
              <PBCard
                title="Weakest gap"
                value={
                  progressSummary.rankings.needsWork
                    ? progressSummary.rankings.needsWork.clubType
                    : "--"
                }
                detail="Needs work"
                href="/coach"
              />
            </div>
            <Button asChild className="rounded-full bg-[#0B7A3B] text-white">
              <Link href="/bag" prefetch={false}>
                Open bag
              </Link>
            </Button>
          </NativeListSection>
        ) : activeTab === "activity" ? (
          <NativeListSection title="Activity">
            <ProgressCard
              title="Active competitions"
              value={challenges.mine.length}
              detail={`${honours.tournaments.length} tournaments · ${honours.records.length} records`}
            />
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/feed?filter=me" prefetch={false}>
                View my feed
              </Link>
            </Button>
          </NativeListSection>
        ) : (
          <NativeListSection title="This week">
            <ProgressCard
              title="Sessions"
              value={Math.max(0, Math.ceil(progressSummary.totals.trackedCleanShots / 120))}
              detail={`${progressSummary.totals.shots} total shots · best club ${progressSummary.rankings.mostTrusted?.clubType ?? "--"}`}
            >
              <div className="h-16 rounded-lg bg-[linear-gradient(90deg,#0B7A3B_0_18%,#16A34A_18%_42%,#E5E7EB_42%_100%)]" />
            </ProgressCard>
            <div className="grid grid-cols-2 gap-2">
              <PBCard
                title="Shots"
                value={progressSummary.totals.shots}
                detail="All tracked"
                href="/progress"
              />
              <PBCard
                title="Trust"
                value={`${progressSummary.totals.averageTrust}%`}
                detail="Bag average"
                href="/coach"
              />
            </div>
          </NativeListSection>
        )}
        <ProfileFeaturePanel data={featureData} />
      </MobileAppShell>

      <div className="hidden items-center justify-between gap-3 sm:flex">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/profile/${profile.username}`} prefetch={false}>
            <UserRound className="size-4" />
            Public view
          </Link>
        </Button>
      </div>

      <div className="hidden sm:contents">
        <PageHeader
          eyebrow={<StatusPill tone="sky">Social profile</StatusPill>}
          title="Profile"
          description="Set your public identity, default feed visibility, and friend-safe privacy choices before joining leaderboards or challenges."
          metrics={[
            {
              label: "Username",
              value: `@${profile.username}`,
              detail: profile.publicProfile ? "Public search enabled" : "Hidden from public search",
            },
            {
              label: "Feed default",
              value: titleCase(profile.feedVisibilityDefault),
              detail: "Used for generated PB and achievement cards",
            },
            {
              label: "Leaderboard",
              value: titleCase(profile.leaderboardVisibility),
              detail: "Still respects account leaderboard opt-in",
            },
            {
              label: "Profile",
              value: profile.friendProfile
                ? "Friends"
                : profile.publicProfile
                  ? "Public"
                  : "Private",
              detail: "Private by default",
            },
          ]}
        />

        {params?.saved ? (
          <Alert>
            <ShieldCheck className="size-4" />
            <AlertTitle>Profile saved</AlertTitle>
            <AlertDescription>
              Your social profile and privacy defaults are active.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.62fr)_minmax(280px,0.38fr)]">
          <article className="premium-card overflow-hidden">
            <ProfileMediaEditor
              displayName={profile.displayName}
              username={profile.username}
              initialAvatarUrl={profile.avatarUrl}
              initialHeaderImageUrl={profile.headerImageUrl}
              publicHref={`/profile/${profile.username}`}
              formId={profileFormId}
            />
            <div className="grid gap-4 p-5 pt-1">
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {profile.bio ??
                  "Add a short goal, home setup or favourite club so friends understand what you are working on."}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <PreviewStat
                  icon={<Target className="size-4 text-emerald-600" />}
                  label="Home setup"
                  value={profile.primaryLaunchMonitor ?? "Add device"}
                />
                <PreviewStat
                  icon={<Trophy className="size-4 text-amber-600" />}
                  label="Course champions"
                  value={honours.championCount}
                />
                <PreviewStat
                  icon={<ShieldCheck className="size-4 text-sky-600" />}
                  label="Default share"
                  value={titleCase(profile.feedVisibilityDefault)}
                />
              </div>
            </div>
          </article>

          <article className="premium-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Profile completion</p>
              <Badge variant="secondary">{completion}%</Badge>
            </div>
            <Progress value={completion} className="mt-3" />
            <div className="mt-4 grid gap-2 text-sm">
              <ShowcaseRow
                icon={<Award className="size-4 text-emerald-600" />}
                label="PB showcase"
                value={
                  pbShowcase.length ? pbShowcase.map(pbLabel).join(" · ") : "Choose PBs to feature"
                }
              />
              <ShowcaseRow
                icon={<Trophy className="size-4 text-amber-600" />}
                label="Achievements"
                value={
                  achievementShowcase.length
                    ? achievementShowcase.join(" · ")
                    : "Unlock and pin badges"
                }
              />
              <ShowcaseRow
                icon={<Target className="size-4 text-sky-600" />}
                label="Entries"
                value={`${challenges.mine.length} challenges · ${honours.tournaments.length} tournaments`}
              />
            </div>
          </article>
        </section>

        <PublicSharePreviewPanel audiences={shareAudiences} actionHref="/settings" />
        <DataHealthFeaturePanel data={featureData} />

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.58fr)_minmax(280px,0.42fr)]">
          <article className="premium-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Honours board</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Course champions, current records and tournament history define your golf
                  identity.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/course-records" prefetch={false}>
                  Records
                </Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {honours.records.map((record) => (
                <Link
                  key={record.id}
                  href={`/course-records/${record.recordId}`}
                  prefetch={false}
                  className={
                    record.rank === 1
                      ? "rounded-xl border border-amber-200 bg-amber-50 p-4"
                      : "rounded-lg border bg-[#F5F6F4] p-4"
                  }
                >
                  <Badge variant={record.rank === 1 ? "default" : "outline"}>
                    {record.rank === 1 ? "Champion" : `#${record.rank}`}
                  </Badge>
                  <p className="mt-3 font-semibold tracking-normal">{record.courseName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {record.categoryName} · {record.scoreLabel}
                  </p>
                </Link>
              ))}
              {honours.records.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground md:col-span-2">
                  No course records yet.
                </p>
              ) : null}
            </div>
          </article>

          <article className="premium-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Tournament history</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Major-style and open event finishes.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/tournaments" prefetch={false}>
                  Events
                </Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-2">
              {honours.tournaments.map((event) => (
                <Link
                  key={event.id}
                  href={`/tournaments/${event.tournamentId}`}
                  prefetch={false}
                  className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm"
                >
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    #{event.rank ?? "--"} · {event.grossTotal} gross · {event.roundsCompleted}{" "}
                    rounds
                  </p>
                </Link>
              ))}
              {honours.tournaments.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No tournament standings yet.
                </p>
              ) : null}
            </div>
          </article>
        </section>

        <ProfileFeaturePanel data={featureData} />

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.66fr)_minmax(280px,0.34fr)]">
          <DataPanel>
            <SectionHeader
              title="Identity and privacy"
              description="Detailed shot data stays private unless you explicitly change the visibility for generated cards."
              action={<UserRound className="size-5 text-sky-600" />}
            />
            <CardContent>
              <form id={profileFormId} action={updateSocialProfileAction} className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    label="Username"
                    name="username"
                    defaultValue={profile.username}
                    required
                  />
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
                  <FormField
                    label="Handicap band"
                    name="handicapBand"
                    defaultValue={profile.handicapBand ?? ""}
                    placeholder="10-14, beginner, scratch"
                  />
                </div>

                <label className="grid gap-2 text-sm font-medium">
                  <span>Bio</span>
                  <textarea
                    name="bio"
                    defaultValue={profile.bio ?? ""}
                    rows={4}
                    className="rounded-lg border bg-white px-3 py-2 text-sm"
                  />
                </label>

                <fieldset className="grid gap-3 rounded-lg border bg-white p-4">
                  <legend className="px-1 text-sm font-semibold">Discovery</legend>
                  <CheckboxField
                    name="publicProfile"
                    label="Show my profile in public username search"
                    defaultChecked={profile.publicProfile}
                  />
                  <CheckboxField
                    name="friendProfile"
                    label="Let friends view my profile details"
                    defaultChecked={profile.friendProfile}
                  />
                </fieldset>

                <div className="grid gap-4 md:grid-cols-2">
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
                </div>

                <fieldset className="grid gap-4 rounded-lg border bg-white p-4">
                  <legend className="px-1 text-sm font-semibold">What others can see</legend>
                  <div className="grid gap-4 md:grid-cols-2">
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
                      label="Handicap estimate"
                      name="handicapVisibility"
                      defaultValue={parseVisibility(visibility.handicap)}
                    />
                    <SelectField
                      label="Practice activity"
                      name="practiceVisibility"
                      defaultValue={parseVisibility(visibility.practice, "friends")}
                    />
                    <SelectField
                      label="Exact shot data"
                      name="exactShotsVisibility"
                      defaultValue={parseVisibility(visibility.exactShots)}
                    />
                  </div>
                </fieldset>

                <Button
                  type="submit"
                  className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B] sm:w-fit"
                >
                  <ShieldCheck className="size-4" />
                  Save profile
                </Button>
              </form>
            </CardContent>
          </DataPanel>

          <DataPanel>
            <SectionHeader
              title="Invite link"
              description="Share your profile URL or QR code with Rapsodo friends."
              action={<QrCode className="size-5 text-emerald-600" />}
            />
            <CardContent className="grid gap-4">
              <div className="rounded-lg border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/friends/qr/${profile.username}`}
                  alt={`QR invite for @${profile.username}`}
                  className="mx-auto aspect-square w-full max-w-56"
                />
              </div>
              <div className="rounded-xl border bg-muted/50 p-3 text-sm">
                <p className="font-medium">Invite URL</p>
                <code className="mt-1 block break-all text-xs text-muted-foreground">
                  {profileUrl}
                </code>
              </div>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={profileUrl} prefetch={false}>
                  <Copy className="size-4" />
                  Open invite page
                </Link>
              </Button>
            </CardContent>
          </DataPanel>
        </section>
      </div>
    </PageShell>
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
      <Input name={name} className="h-10 rounded-xl bg-white" {...props} />
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
    <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-input accent-[#0B7A3B]"
      />
      <span>{label}</span>
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
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-10 rounded-lg border bg-white px-3 text-sm"
      >
        {socialVisibilityOptions.map((option) => (
          <option key={option} value={option}>
            {titleCase(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewStat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-[#F5F6F4] px-3 py-2">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function ShowcaseRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F5F6F4] px-3 py-2">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 line-clamp-2">{value}</p>
    </div>
  );
}

function profileCompletion(profile: Awaited<ReturnType<typeof ensureCurrentSocialProfile>>) {
  const fields = [
    profile.username,
    profile.displayName,
    profile.avatarUrl,
    profile.headerImageUrl,
    profile.bio,
    profile.homeCourse,
    profile.primaryLaunchMonitor,
    profile.handicapBand,
    profile.publicProfile || profile.friendProfile ? "visibility" : "",
  ];
  const completed = fields.filter(Boolean).length;

  return Math.round((completed / fields.length) * 100);
}

async function getProfileHonoursData(userId: string) {
  const [records, tournamentRows] = await Promise.all([
    getDb()
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
      .limit(24),
    getDb()
      .select({
        standing: tournamentStandings,
        tournament: tournaments,
      })
      .from(tournamentStandings)
      .innerJoin(tournaments, eq(tournamentStandings.tournamentId, tournaments.id))
      .where(eq(tournamentStandings.userId, userId))
      .orderBy(desc(tournamentStandings.calculatedAt))
      .limit(6),
  ]);

  const uniqueRecords = buildProfileHonoursRecords(records).slice(0, 6);

  return {
    championCount: uniqueRecords.filter((record) => record.rank === 1).length,
    records: uniqueRecords,
    tournaments: tournamentRows.map((row) => ({
      id: row.standing.id,
      tournamentId: row.tournament.id,
      title: row.tournament.title,
      grossTotal: row.standing.grossTotal,
      roundsCompleted: row.standing.roundsCompleted,
      rank: row.standing.rank,
    })),
  };
}

function pbLabel(value: Record<string, unknown>) {
  const label =
    typeof value.label === "string"
      ? value.label
      : typeof value.club === "string"
        ? value.club
        : "PB";
  const metric =
    typeof value.value === "string" || typeof value.value === "number" ? String(value.value) : null;

  return metric ? `${label} ${metric}` : label;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseYouTab(value?: string) {
  if (value === "records" || value === "bag" || value === "activity") {
    return value;
  }

  return "progress";
}

function getRequestOrigin(requestHeaders: Headers) {
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
