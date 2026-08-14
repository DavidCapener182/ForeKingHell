import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  ArrowLeft,
  Award,
  ExternalLink,
  Plus,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";
import { and, desc, eq } from "drizzle-orm";

import { updateSocialProfileAction } from "@/app/profile/actions";
import { ProfileEditSheet } from "@/app/profile/profile-edit-sheet";
import { ProfileMediaEditor } from "@/app/profile/profile-media-editor";
import { ProfileSectionTabs } from "@/app/profile/profile-section-tabs";
import { ProfileShareDialog } from "@/app/profile/profile-share-dialog";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { IOSDisclosureGroup, IOSGroupedList, IOSListRow } from "@/components/app/ios-mobile";
import {
  MobileAppShell,
  MobileIconButton,
  MobileStatusAction,
  MobileTopBar,
  NativeListSection,
} from "@/components/mobile-sports";
import { DataTableFrame, PageHeader, PageShell, StatusPill } from "@/components/premium";
import { PublicSharePreviewPanel } from "@/components/product-polish";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
import { buildProfileHonoursRecords } from "@/lib/profile-honours";
import { getSiteOrigin } from "@/lib/site-origin";
import { getRequestAppSurface } from "@/lib/app-surface-server";
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

const profileEvidenceColumns: DesktopWorkbenchColumn[] = [
  { id: "evidence", label: "Evidence", locked: true },
  { id: "type", label: "Type" },
  { id: "result", label: "Result" },
  { id: "visibility", label: "Visibility" },
  { id: "proof", label: "Proof" },
  { id: "action", label: "Action", locked: true },
];

const profileEvidenceSavedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Public preview",
    href: "#profile-evidence-ledger",
    detail: "Records and tournament rows that can shape the public profile.",
  },
  {
    title: "Course records",
    href: "/course-records",
    detail: "Open the full records board behind the profile honours.",
  },
  {
    title: "Tournament history",
    href: "/tournaments",
    detail: "Review event standings and multi-round context.",
  },
  {
    title: "Privacy settings",
    href: "#identity-privacy",
    detail: "Control which profile evidence friends or public viewers can see.",
  },
];

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [params, profile, surface] = await Promise.all([
    searchParams,
    ensureCurrentSocialProfile(),
    getRequestAppSurface(),
  ]);
  const workbench =
    surface === "workbench" ? await import("@/components/app/desktop-workbench") : null;
  const DesktopWorkbenchLayout = workbench?.DesktopWorkbenchLayout;
  const desktopData =
    surface === "workbench"
      ? await Promise.all([getChallengesPageData(), getProfileHonoursData(profile.userId)]).then(
          ([challenges, honours]) => ({ challenges, honours }),
        )
      : null;
  const challenges = desktopData?.challenges;
  const honours = desktopData?.honours;
  const origin = getSiteOrigin();
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
    <PageShell>
      {surface === "companion" ? (
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
          <NativeListSection title="Profile controls">
            <IOSDisclosureGroup
              label="Profile controls and evidence"
              items={[
                {
                  value: "sharing",
                  title: "Sharing preview",
                  summary: profile.publicProfile ? "Public" : "Private",
                  description: "What public visitors, friends and coaches can see",
                  content: (
                    <PublicSharePreviewPanel audiences={shareAudiences} actionHref="/settings" />
                  ),
                },
              ]}
            />
          </NativeListSection>
          <NativeListSection title="Golf workspaces">
            <IOSGroupedList label="Profile workspace links">
              <IOSListRow
                label="Progress"
                detail="Open your full progress workspace"
                href="/progress"
              />
              <IOSListRow label="Bag" detail="Review clubs and gapping" href="/bag" />
              <IOSListRow label="Goals" detail="Manage golf goals" href="/goals" />
            </IOSGroupedList>
          </NativeListSection>
        </MobileAppShell>
      ) : DesktopWorkbenchLayout && challenges && honours ? (
        <DesktopWorkbenchLayout scope="profile">
          <div className="hidden items-center justify-between gap-3 lg:flex">
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
              {
                label: "Username",
                value: `@${profile.username}`,
                detail: profile.publicProfile
                  ? "Public search enabled"
                  : "Hidden from public search",
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

          <ProfileSectionTabs />

          {params?.saved ? (
            <Alert>
              <ShieldCheck className="size-4" />
              <AlertTitle>Profile saved</AlertTitle>
              <AlertDescription>
                Your social profile and privacy defaults are active.
              </AlertDescription>
            </Alert>
          ) : null}

          <section
            id="overview"
            className="grid scroll-mt-28 gap-4 lg:grid-cols-[minmax(0,0.62fr)_minmax(280px,0.38fr)]"
          >
            <Card className="gap-0 overflow-hidden">
              <ProfileMediaEditor
                displayName={profile.displayName}
                username={profile.username}
                initialAvatarUrl={profile.avatarUrl}
                initialHeaderImageUrl={profile.headerImageUrl}
                publicHref={`/profile/${profile.username}`}
                formId={profileFormId}
              />
              <CardContent className="grid gap-4 p-5 pt-1">
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {profile.bio ??
                    "Add a short goal, home setup or favourite club so friends understand what you are working on."}
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <PreviewStat
                    icon={<Target className="size-4 text-primary" />}
                    label="Home setup"
                    value={profile.primaryLaunchMonitor ?? "Add device"}
                  />
                  <PreviewStat
                    icon={<Trophy className="size-4 text-primary" />}
                    label="Course champions"
                    value={honours.championCount}
                  />
                  <PreviewStat
                    icon={<ShieldCheck className="size-4 text-primary" />}
                    label="Default share"
                    value={titleCase(profile.feedVisibilityDefault)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card aria-label="Profile completion rail" className="p-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Profile completion</p>
                <Badge variant="secondary">{completion}%</Badge>
              </div>
              <Progress value={completion} className="mt-3" />
              <div className="mt-4 grid gap-2 text-sm">
                <ShowcaseRow
                  icon={<Award className="size-4 text-primary" />}
                  label="PB showcase"
                  value={
                    pbShowcase.length
                      ? pbShowcase.map(pbLabel).join(" · ")
                      : "Choose PBs to feature"
                  }
                />
                <ShowcaseRow
                  icon={<Trophy className="size-4 text-primary" />}
                  label="Achievements"
                  value={
                    achievementShowcase.length
                      ? achievementShowcase.join(" · ")
                      : "Unlock and pin badges"
                  }
                />
                <ShowcaseRow
                  icon={<Target className="size-4 text-primary" />}
                  label="Entries"
                  value={`${challenges.mine.length} challenges · ${honours.tournaments.length} tournaments`}
                />
              </div>
            </Card>
          </section>

          <section id="sharing" className="scroll-mt-28">
            <PublicSharePreviewPanel audiences={shareAudiences} actionHref="/settings" />
          </section>
          <ProfileWorkspaceLinks />

          <div id="records" className="scroll-mt-28">
            <ProfileEvidenceLedger
              username={profile.username}
              records={honours.records}
              tournaments={honours.tournaments}
            />
          </div>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.66fr)_minmax(280px,0.34fr)]">
            <Card id="identity-privacy">
              <CardHeader>
                <CardTitle>Identity and privacy</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Detailed shot data stays private unless you explicitly change the visibility for
                  generated cards.
                </p>
              </CardHeader>
              <CardContent>
                <ProfileEditSheet>
                  <form
                    id={profileFormId}
                    action={updateSocialProfileAction}
                    aria-label="Identity and privacy settings"
                    className="grid gap-5"
                  >
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
                      <Textarea name="bio" defaultValue={profile.bio ?? ""} rows={4} />
                    </label>

                    <fieldset className="grid gap-3 rounded-lg border bg-muted/35 p-4">
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
                      <CheckboxField
                        name="allowCompare"
                        label="Allow eligible golfers to compare with my shared analysis"
                        defaultChecked={profile.visibilitySettingsJson?.allowCompare === true}
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

                    <fieldset className="grid gap-4 rounded-lg border bg-muted/35 p-4">
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

                    <Button type="submit" className="w-full rounded-lg sm:w-fit">
                      <ShieldCheck className="size-4" />
                      Save profile
                    </Button>
                  </form>
                </ProfileEditSheet>
              </CardContent>
            </Card>

            <aside aria-label="Profile invite rail" className="min-w-0">
              <Card id="profile-invite">
                <CardHeader>
                  <CardTitle>Share your profile</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Open a focused QR and copy-link Dialog when you are ready to invite someone.
                  </p>
                </CardHeader>
                <CardFooter>
                  <ProfileShareDialog username={profile.username} profileUrl={profileUrl} />
                </CardFooter>
              </Card>
            </aside>
          </section>
        </DesktopWorkbenchLayout>
      ) : null}
    </PageShell>
  );
}

type ProfileHonoursData = Awaited<ReturnType<typeof getProfileHonoursData>>;
type ProfileEvidenceRecord = ProfileHonoursData["records"][number];
type ProfileEvidenceTournament = ProfileHonoursData["tournaments"][number];

type ProfileEvidenceRow = {
  id: string;
  type: "Course record" | "Tournament";
  title: string;
  detail: string;
  result: string;
  visibility: string;
  proof: string;
  href: string;
  actionLabel: string;
};

async function ProfileEvidenceLedger({
  username,
  records,
  tournaments,
}: {
  username: string;
  records: ProfileEvidenceRecord[];
  tournaments: ProfileEvidenceTournament[];
}) {
  const { DesktopTableWorkbenchControls } = await import("@/components/app/desktop-workbench");
  const rows = buildProfileEvidenceRows(records, tournaments);

  return (
    <section
      id="profile-evidence-ledger"
      className="grid gap-3"
      data-workbench-scope="profile-evidence"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Profile evidence ledger</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Course records and tournament rows that shape your public preview before you adjust
            privacy.
          </p>
        </div>
        <StatusPill tone={rows.length > 0 ? "green" : "slate"}>{rows.length} rows</StatusPill>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`profile-evidence-${username}`}
        scope="profile-evidence"
        currentViewLabel={`@${username} profile evidence`}
        resultLabel={`${rows.length} evidence rows`}
        columns={profileEvidenceColumns}
        suggestedViews={profileEvidenceSavedViews}
        exportTableId="profile-evidence-ledger"
        exportFileName={`forekinghell-profile-${username}-evidence.csv`}
      />

      <DataTableFrame mainTable mainTableLabel="Profile evidence ledger table" stickyFirstColumn>
        <Table
          data-workbench-export-table="profile-evidence-ledger"
          aria-describedby="profile-evidence-ledger-summary"
        >
          <TableCaption id="profile-evidence-ledger-summary" className="sr-only">
            Profile evidence ledger showing record or tournament evidence, type, result, visibility,
            proof context and action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
            <TableRow>
              <TableHead
                data-column="evidence"
                className="sticky left-0 z-20 min-w-72 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
              >
                Evidence
              </TableHead>
              <TableHead data-column="type">Type</TableHead>
              <TableHead data-column="result">Result</TableHead>
              <TableHead data-column="visibility">Visibility</TableHead>
              <TableHead data-column="proof">Proof</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="evidence"
                    className="sticky left-0 z-10 min-w-72 bg-card shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  >
                    <p className="font-semibold">{row.title}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{row.detail}</p>
                  </TableCell>
                  <TableCell data-column="type">
                    <Badge variant={row.type === "Course record" ? "secondary" : "outline"}>
                      {row.type}
                    </Badge>
                  </TableCell>
                  <TableCell data-column="result">{row.result}</TableCell>
                  <TableCell data-column="visibility">{row.visibility}</TableCell>
                  <TableCell data-column="proof">{row.proof}</TableCell>
                  <TableCell data-column="action" className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={row.href} prefetch={false}>
                        <ExternalLink className="size-4" />
                        {row.actionLabel}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="p-4">
                  <AppEmptyState
                    icon={<Award className="size-5" />}
                    title="No profile evidence yet"
                    description="Import measured golf activity or record a tournament result before publishing proof here."
                    primaryAction={
                      <Button asChild size="sm">
                        <Link href="/import" prefetch={false}>
                          Import activity
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

function buildProfileEvidenceRows(
  records: ProfileEvidenceRecord[],
  tournaments: ProfileEvidenceTournament[],
): ProfileEvidenceRow[] {
  return [
    ...records.map(
      (record): ProfileEvidenceRow => ({
        id: `record-${record.id}`,
        type: "Course record",
        title: record.courseName,
        detail: record.categoryName,
        result: record.scoreLabel,
        visibility: "Public all-time board",
        proof: record.rank === 1 ? "Champion" : `Rank #${record.rank ?? "--"}`,
        href: `/course-records/${record.recordId}`,
        actionLabel: "Open record",
      }),
    ),
    ...tournaments.map(
      (event): ProfileEvidenceRow => ({
        id: `tournament-${event.id}`,
        type: "Tournament",
        title: event.title,
        detail: `${event.roundsCompleted} rounds completed`,
        result: `#${event.rank ?? "--"} - ${event.grossTotal ?? "--"} gross`,
        visibility: "Event board",
        proof: `${event.roundsCompleted} scored rounds`,
        href: `/tournaments/${event.tournamentId}`,
        actionLabel: "Open event",
      }),
    ),
  ];
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
    <label className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
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

function PreviewStat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/55 px-3 py-2">
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
    <div className="rounded-lg bg-muted/55 px-3 py-2">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 line-clamp-2">{value}</p>
    </div>
  );
}

function ProfileWorkspaceLinks() {
  const workspaces = [
    { label: "Progress", detail: "Club trust and training trend", href: "/progress" },
    { label: "Bag", detail: "Stock yardages and gapping", href: "/bag" },
    { label: "Goals", detail: "Season plan and measurable targets", href: "/goals" },
  ];

  return (
    <Card id="workspaces" className="scroll-mt-28">
      <CardHeader>
        <CardTitle>Your golf workspaces</CardTitle>
        <p className="text-sm text-muted-foreground">
          Profile stays focused on identity and evidence; use the dedicated workspaces for detail.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3">
        {workspaces.map((workspace) => (
          <Button
            key={workspace.href}
            asChild
            variant="outline"
            className="h-auto justify-start p-3"
          >
            <Link href={workspace.href} prefetch={false}>
              <span className="text-left">
                <span className="block font-medium">{workspace.label}</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {workspace.detail}
                </span>
              </span>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
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
