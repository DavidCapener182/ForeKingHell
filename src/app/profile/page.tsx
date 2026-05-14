import Link from "next/link";
import type { ComponentProps } from "react";
import { headers } from "next/headers";
import { ArrowLeft, Copy, QrCode, ShieldCheck, UserRound } from "lucide-react";

import { updateSocialProfileAction } from "@/app/profile/actions";
import {
  DataPanel,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [params, requestHeaders, profile] = await Promise.all([
    searchParams,
    headers(),
    ensureCurrentSocialProfile(),
  ]);
  const origin = getRequestOrigin(requestHeaders);
  const profileUrl = `${origin}/profile/${profile.username}`;
  const visibility = {
    ...defaultProfileVisibilitySettings(),
    ...profile.visibilitySettingsJson,
  };

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

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getRequestOrigin(requestHeaders: Headers) {
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
