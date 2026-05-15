import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { headers } from "next/headers";
import { ArrowLeft, Award, Copy, QrCode, ShieldCheck, Target, Trophy, UserRound } from "lucide-react";
import { desc, eq } from "drizzle-orm";

import { updateSocialProfileAction } from "@/app/profile/actions";
import {
  DataPanel,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getDb } from "@/db/client";
import { courseRecordCategories, courseRecordResults, courseRecords, courses, tournamentStandings, tournaments } from "@/db/schema";
import { getChallengesPageData } from "@/lib/challenges";
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
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [params, requestHeaders, profile, challenges] = await Promise.all([
    searchParams,
    headers(),
    ensureCurrentSocialProfile(),
    getChallengesPageData(),
  ]);
  const honours = await getProfileHonoursData(profile.userId);
  const origin = getRequestOrigin(requestHeaders);
  const profileUrl = `${origin}/profile/${profile.username}`;
  const visibility = {
    ...defaultProfileVisibilitySettings(),
    ...profile.visibilitySettingsJson,
  };
  const completion = profileCompletion(profile);
  const pbShowcase = profile.pbShowcaseJson.slice(0, 3);
  const achievementShowcase = profile.achievementShowcaseJson.slice(0, 4);

  return (
    <PageShell size="6xl">
      <div className="flex items-center justify-between gap-3">
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

      <PageHeader
        eyebrow={<StatusPill tone="sky">Social profile</StatusPill>}
        title="Profile"
        description="Set your public identity, default feed visibility, and friend-safe privacy choices before joining leaderboards or challenges."
        metrics={[
          { label: "Username", value: `@${profile.username}`, detail: profile.publicProfile ? "Public search enabled" : "Hidden from public search" },
          { label: "Feed default", value: titleCase(profile.feedVisibilityDefault), detail: "Used for generated PB and achievement cards" },
          { label: "Leaderboard", value: titleCase(profile.leaderboardVisibility), detail: "Still respects account leaderboard opt-in" },
          { label: "Profile", value: profile.friendProfile ? "Friends" : profile.publicProfile ? "Public" : "Private", detail: "Private by default" },
        ]}
      />

      {params?.saved ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Profile saved</AlertTitle>
          <AlertDescription>Your social profile and privacy defaults are active.</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.62fr)_minmax(280px,0.38fr)]">
        <article className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="h-24 bg-[linear-gradient(135deg,#111827,#047857_55%,#38bdf8)]" />
          <div className="grid gap-4 p-5 pt-0">
            <div className="-mt-9 flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-end gap-3">
                <SocialAvatar
                  displayName={profile.displayName}
                  username={profile.username}
                  avatarUrl={profile.avatarUrl}
                  href={`/profile/${profile.username}`}
                  size="lg"
                />
                <div className="pb-1">
                  <h2 className="text-2xl font-semibold tracking-normal">{profile.displayName}</h2>
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link href={`/profile/${profile.username}`} prefetch={false}>Preview public page</Link>
              </Button>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {profile.bio ?? "Add a short goal, home setup or favourite club so friends understand what you are working on."}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <PreviewStat icon={<Target className="size-4 text-emerald-600" />} label="Home setup" value={profile.primaryLaunchMonitor ?? "Add device"} />
              <PreviewStat icon={<Trophy className="size-4 text-amber-600" />} label="Course champions" value={honours.championCount} />
              <PreviewStat icon={<ShieldCheck className="size-4 text-sky-600" />} label="Default share" value={titleCase(profile.feedVisibilityDefault)} />
            </div>
          </div>
        </article>

        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Profile completion</p>
            <Badge variant="secondary">{completion}%</Badge>
          </div>
          <Progress value={completion} className="mt-3" />
          <div className="mt-4 grid gap-2 text-sm">
            <ShowcaseRow icon={<Award className="size-4 text-emerald-600" />} label="PB showcase" value={pbShowcase.length ? pbShowcase.map(pbLabel).join(" · ") : "Choose PBs to feature"} />
            <ShowcaseRow icon={<Trophy className="size-4 text-amber-600" />} label="Achievements" value={achievementShowcase.length ? achievementShowcase.join(" · ") : "Unlock and pin badges"} />
            <ShowcaseRow icon={<Target className="size-4 text-sky-600" />} label="Entries" value={`${challenges.mine.length} challenges · ${honours.tournaments.length} tournaments`} />
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.58fr)_minmax(280px,0.42fr)]">
        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Honours board</p>
              <p className="mt-1 text-sm text-muted-foreground">Course champions, current records and tournament history define your golf identity.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/course-records" prefetch={false}>Records</Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {honours.records.map((record) => (
              <Link
                key={record.id}
                href={`/course-records/${record.recordId}`}
                prefetch={false}
                className={record.rank === 1 ? "rounded-xl border border-amber-200 bg-amber-50 p-4" : "rounded-xl border bg-slate-50 p-4"}
              >
                <Badge variant={record.rank === 1 ? "default" : "outline"}>{record.rank === 1 ? "Champion" : `#${record.rank}`}</Badge>
                <p className="mt-3 font-semibold tracking-normal">{record.courseName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{record.categoryName} · {record.scoreLabel}</p>
              </Link>
            ))}
            {honours.records.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground md:col-span-2">No course records yet.</p>
            ) : null}
          </div>
        </article>

        <article className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Tournament history</p>
              <p className="mt-1 text-sm text-muted-foreground">Major-style and open event finishes.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/tournaments" prefetch={false}>Events</Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-2">
            {honours.tournaments.map((event) => (
              <Link key={event.id} href={`/tournaments/${event.tournamentId}`} prefetch={false} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium">{event.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  #{event.rank ?? "--"} · {event.grossTotal} gross · {event.roundsCompleted} rounds
                </p>
              </Link>
            ))}
            {honours.tournaments.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No tournament standings yet.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.66fr)_minmax(280px,0.34fr)]">
        <DataPanel>
          <SectionHeader
            title="Identity and privacy"
            description="Detailed shot data stays private unless you explicitly change the visibility for generated cards."
            action={<UserRound className="size-5 text-sky-600" />}
          />
          <CardContent>
            <form action={updateSocialProfileAction} className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Username" name="username" defaultValue={profile.username} required />
                <FormField label="Display name" name="displayName" defaultValue={profile.displayName} required />
                <FormField label="Avatar URL" name="avatarUrl" defaultValue={profile.avatarUrl ?? ""} />
                <FormField label="Home course or venue" name="homeCourse" defaultValue={profile.homeCourse ?? ""} />
                <FormField label="Primary launch monitor" name="primaryLaunchMonitor" defaultValue={profile.primaryLaunchMonitor ?? ""} />
                <FormField label="Handicap band" name="handicapBand" defaultValue={profile.handicapBand ?? ""} placeholder="10-14, beginner, scratch" />
              </div>

              <label className="grid gap-2 text-sm font-medium">
                <span>Bio</span>
                <textarea
                  name="bio"
                  defaultValue={profile.bio ?? ""}
                  rows={4}
                  className="rounded-xl border bg-white px-3 py-2 text-sm"
                />
              </label>

              <fieldset className="grid gap-3 rounded-xl border bg-white/70 p-4">
                <legend className="px-1 text-sm font-semibold">Discovery</legend>
                <CheckboxField name="publicProfile" label="Show my profile in public username search" defaultChecked={profile.publicProfile} />
                <CheckboxField name="friendProfile" label="Let friends view my profile details" defaultChecked={profile.friendProfile} />
              </fieldset>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="Generated feed cards" name="feedVisibilityDefault" defaultValue={parseVisibility(profile.feedVisibilityDefault)} />
                <SelectField label="Leaderboard visibility" name="leaderboardVisibility" defaultValue={parseVisibility(profile.leaderboardVisibility)} />
              </div>

              <fieldset className="grid gap-4 rounded-xl border bg-white/70 p-4">
                <legend className="px-1 text-sm font-semibold">What others can see</legend>
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField label="Rounds" name="roundsVisibility" defaultValue={parseVisibility(visibility.rounds)} />
                  <SelectField label="PBs" name="pbsVisibility" defaultValue={parseVisibility(visibility.pbs, "friends")} />
                  <SelectField label="Bag" name="bagVisibility" defaultValue={parseVisibility(visibility.bag)} />
                  <SelectField label="Achievements" name="achievementsVisibility" defaultValue={parseVisibility(visibility.achievements, "friends")} />
                  <SelectField label="Handicap estimate" name="handicapVisibility" defaultValue={parseVisibility(visibility.handicap)} />
                  <SelectField label="Practice activity" name="practiceVisibility" defaultValue={parseVisibility(visibility.practice, "friends")} />
                  <SelectField label="Exact shot data" name="exactShotsVisibility" defaultValue={parseVisibility(visibility.exactShots)} />
                </div>
              </fieldset>

              <Button type="submit" className="w-full rounded-xl bg-[#111827] text-white sm:w-fit">
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
            <div className="rounded-xl border bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/friends/qr/${profile.username}`}
                alt={`QR invite for @${profile.username}`}
                className="mx-auto aspect-square w-full max-w-56"
              />
            </div>
            <div className="rounded-xl border bg-muted/50 p-3 text-sm">
              <p className="font-medium">Invite URL</p>
              <code className="mt-1 block break-all text-xs text-muted-foreground">{profileUrl}</code>
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
    <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="size-4 rounded border-input accent-[#111827]" />
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
      <select name={name} defaultValue={defaultValue} className="h-10 rounded-xl border bg-white px-3 text-sm">
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
    <div className="rounded-lg border bg-slate-50 px-3 py-2">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function ShowcaseRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</p>
      <p className="mt-1 line-clamp-2">{value}</p>
    </div>
  );
}

function profileCompletion(profile: Awaited<ReturnType<typeof ensureCurrentSocialProfile>>) {
  const fields = [
    profile.username,
    profile.displayName,
    profile.avatarUrl,
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
      .where(eq(courseRecordResults.userId, userId))
      .orderBy(desc(courseRecordResults.calculatedAt))
      .limit(6),
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

  return {
    championCount: records.filter((row) => row.result.rank === 1).length,
    records: records.map((row) => ({
      id: row.result.id,
      recordId: row.record.id,
      courseName: row.course.name,
      categoryName: row.category.name,
      scoreLabel: row.result.scoreLabel,
      rank: row.result.rank,
    })),
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
  const label = typeof value.label === "string" ? value.label : typeof value.club === "string" ? value.club : "PB";
  const metric = typeof value.value === "string" || typeof value.value === "number" ? String(value.value) : null;

  return metric ? `${label} ${metric}` : label;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getRequestOrigin(requestHeaders: Headers) {
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
