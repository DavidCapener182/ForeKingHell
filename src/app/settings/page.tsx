import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { headers } from "next/headers";
import {
  ChevronDown,
  Download,
  Link2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import { desc, eq, inArray } from "drizzle-orm";

import {
  cancelInvitationAction,
  createInvitationAction,
  deleteAccountDataAction,
  removeMembershipAction,
  updateUserSettingsAction,
} from "@/app/settings/actions";
import { OfflineStoragePanel } from "@/app/settings/offline-storage-panel";
import { DataHealthFeaturePanel, SocialFeaturePanel } from "@/components/features/feature-panels";
import { DataPanel, PageHeader, PageShell, SectionHeader, StatusPill } from "@/components/premium";
import { MobileRouteHeader } from "@/components/mobile-sports";
import { PlausibleEventOnMount } from "@/components/plausible-event-on-mount";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { accountInvitations, accountMemberships, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { collaborationRoles } from "@/lib/collaboration";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import {
  dashboardPinOptions,
  preferredUnitOptions,
  tableDensityOptions,
  type PrivacySettings,
} from "@/lib/user-settings";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<{
    saved?: string;
    deleted?: string;
    deleteError?: string;
    invite?: string;
    inviteAccepted?: string;
    inviteCancelled?: string;
    inviteError?: string;
    memberRemoved?: string;
  }>;
};

const dashboardPinLabels: Record<(typeof dashboardPinOptions)[number], string> = {
  shots: "Shots",
  clubs: "Clubs",
  sessions: "Sessions",
  handicap: "Handicap",
  bag: "Bag",
  rounds: "Rounds",
  coach: "Coach",
  achievements: "Achievements",
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const [settingsData, featureData] = await Promise.all([getSettingsData(), getFeatureIdeasData()]);
  const { profile, ownedInvitations, ownedMemberships, receivedMemberships, relatedUsersById } =
    settingsData;
  const privacy = normalizePrivacy(profile.privacySettingsJson);
  const inviteUrl = params?.invite
    ? `${getRequestOrigin(requestHeaders)}/settings/invitations/${encodeURIComponent(params.invite)}`
    : null;

  return (
    <PageShell size="6xl">
      {params?.inviteAccepted ? <PlausibleEventOnMount eventName="Invite Accepted" /> : null}
      <MobileRouteHeader title="Improve" group="improve" activeKey="settings" />

      <PageHeader
        eyebrow={<StatusPill tone="sky">Account</StatusPill>}
        title="Settings"
        description="Manage profile preferences, privacy defaults, and data portability for your LM World Tour account."
        actions={
          <Button
            asChild
            size="sm"
            className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
          >
            <a href="#profile-settings">
              <UserCog className="size-4" />
              Profile
            </a>
          </Button>
        }
      />

      {params?.saved ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Settings saved</AlertTitle>
          <AlertDescription>
            Your profile and preference changes are active for this account.
          </AlertDescription>
        </Alert>
      ) : null}

      {params?.deleted ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Account data deleted</AlertTitle>
          <AlertDescription>
            Your app data was removed. Signing in again recreates an empty profile.
          </AlertDescription>
        </Alert>
      ) : null}

      {params?.deleteError === "confirmation" ? (
        <Alert variant="destructive">
          <Trash2 className="size-4" />
          <AlertTitle>Deletion was not run</AlertTitle>
          <AlertDescription>
            Type your account email exactly before deleting app data.
          </AlertDescription>
        </Alert>
      ) : null}

      {params?.inviteAccepted ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Invite accepted</AlertTitle>
          <AlertDescription>The shared account is now available to this login.</AlertDescription>
        </Alert>
      ) : null}

      {params?.inviteCancelled ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Invite cancelled</AlertTitle>
          <AlertDescription>The pending invite link can no longer be accepted.</AlertDescription>
        </Alert>
      ) : null}

      {params?.memberRemoved ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Access removed</AlertTitle>
          <AlertDescription>The collaborator can no longer access shared data.</AlertDescription>
        </Alert>
      ) : null}

      {params?.inviteError ? (
        <Alert variant="destructive">
          <X className="size-4" />
          <AlertTitle>Invite not completed</AlertTitle>
          <AlertDescription>{formatInviteError(params.inviteError)}</AlertDescription>
        </Alert>
      ) : null}

      {inviteUrl ? (
        <Alert>
          <Link2 className="size-4" />
          <AlertTitle>Invite link ready</AlertTitle>
          <AlertDescription>
            Share this link with the invited user:{" "}
            <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">{inviteUrl}</code>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="hidden gap-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_280px] lg:items-start">
        <section className="premium-card sticky top-28 p-3">
          <p className="px-2 text-sm font-semibold">Settings</p>
          <nav className="mt-2 grid gap-1 text-sm">
            <a
              href="#profile-settings"
              className="rounded-lg px-2 py-2 font-medium hover:bg-[#F5F6F4]"
            >
              Profile
            </a>
            <a
              href="#sharing-settings"
              className="rounded-lg px-2 py-2 font-medium hover:bg-[#F5F6F4]"
            >
              Sharing
            </a>
            <a
              href="#visibility-simulator"
              className="rounded-lg px-2 py-2 font-medium hover:bg-[#F5F6F4]"
            >
              Visibility
            </a>
            <a href="#data-export" className="rounded-lg px-2 py-2 font-medium hover:bg-[#F5F6F4]">
              Data export
            </a>
            <a
              href="#offline-storage"
              className="rounded-lg px-2 py-2 font-medium hover:bg-[#F5F6F4]"
            >
              Offline storage
            </a>
            <a
              href="#danger-zone"
              className="rounded-lg px-2 py-2 font-medium text-destructive hover:bg-red-50"
            >
              Danger zone
            </a>
          </nav>
        </section>

        <section className="premium-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-emerald-600" />
            Privacy preview
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <SettingsPreviewRow
              label="Public profile"
              value={privacy.publicProfile ? "Allowed" : "Hidden"}
            />
            <SettingsPreviewRow
              label="Leaderboard"
              value={privacy.allowLeaderboard ? "Enabled" : "Off"}
            />
            <SettingsPreviewRow
              label="Coach access"
              value={privacy.allowCoachAccess ? "Allowed" : "Invite only"}
            />
          </div>
        </section>

        <section className="premium-card sticky top-28 min-w-0 p-4">
          <p className="text-sm font-semibold">Account panel</p>
          <div className="mt-3 grid gap-2 text-sm">
            <SettingsPreviewRow label="Email" value={profile.email ?? "No email"} />
            <SettingsPreviewRow label="Units" value={profile.preferredUnits} />
            <SettingsPreviewRow label="Tables" value={profile.tableDensity} />
          </div>
        </section>
      </section>

      <DataHealthFeaturePanel data={featureData} />
      <VisibilitySimulatorPanel
        privacy={privacy}
        ownedMembershipCount={ownedMemberships.length}
        receivedMembershipCount={receivedMemberships.length}
      />
      <OfflineStoragePanel />
      <DataControlStatusPanel
        profile={profile}
        ownedInvitationCount={ownedInvitations.length}
        ownedMembershipCount={ownedMemberships.length}
        receivedMembershipCount={receivedMemberships.length}
      />

      <SettingsMobileDisclosure
        id="profile-settings"
        title="Profile"
        description={`${profile.preferredUnits}, ${profile.tableDensity} tables`}
        defaultOpen
      >
        <DataPanel>
          <SectionHeader
            title="Profile and preferences"
            description="These settings are stored with your user profile and control dashboard pins, units, and table density."
            action={<SlidersHorizontal className="size-5 text-sky-600" />}
          />
          <CardContent>
            <form action={updateUserSettingsAction} className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Display name" name="name" defaultValue={profile.name ?? ""} />
                <ReadonlyField label="Email" value={profile.email ?? "No email on profile"} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Preferred units"
                  name="preferredUnits"
                  defaultValue={profile.preferredUnits}
                  values={preferredUnitOptions}
                />
                <SelectField
                  label="Table density"
                  name="tableDensity"
                  defaultValue={profile.tableDensity}
                  values={tableDensityOptions}
                />
              </div>

              <fieldset className="grid gap-3 rounded-lg border bg-[#F5F6F4] p-4">
                <legend className="px-1 text-sm font-semibold">Dashboard pins</legend>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {dashboardPinOptions.map((pin) => (
                    <CheckboxField
                      key={pin}
                      name="dashboardPins"
                      value={pin}
                      label={dashboardPinLabels[pin]}
                      defaultChecked={profile.dashboardPins.includes(pin)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="grid gap-3 rounded-lg border bg-[#F5F6F4] p-4">
                <legend className="px-1 text-sm font-semibold">Privacy defaults</legend>
                <div className="grid gap-2">
                  <CheckboxField
                    name="allowCoachAccess"
                    label="Allow invited coaches to read my golf data"
                    defaultChecked={privacy.allowCoachAccess}
                  />
                  <CheckboxField
                    name="allowLeaderboard"
                    label="Include my profile in friend leaderboards"
                    defaultChecked={privacy.allowLeaderboard}
                  />
                  <CheckboxField
                    name="publicProfile"
                    label="Allow a public profile if sharing is enabled later"
                    defaultChecked={privacy.publicProfile}
                  />
                </div>
              </fieldset>

              <Button
                type="submit"
                className="w-full rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B] sm:w-fit"
              >
                <UserCog className="size-4" />
                Save settings
              </Button>
            </form>
          </CardContent>
        </DataPanel>
      </SettingsMobileDisclosure>

      <SettingsMobileDisclosure
        id="sharing-settings"
        title="Sharing"
        description="Invites, coaches and shared accounts."
      >
        <DataPanel>
          <SectionHeader
            title="Sharing and collaboration"
            description="Invite a coach, viewer, or editor. Invitations create role-scoped memberships before social and team features are enabled."
            action={<UserPlus className="size-5 text-emerald-600" />}
          />
          <CardContent className="grid gap-5">
            <form
              action={createInvitationAction}
              className="grid gap-3 rounded-lg border bg-[#F5F6F4] p-4 md:grid-cols-[1fr_180px_auto] md:items-end"
            >
              <FormField
                label="Invite email"
                name="invitedEmail"
                type="email"
                placeholder="coach@example.com"
                required
              />
              <SelectField
                label="Role"
                name="role"
                defaultValue="viewer"
                values={collaborationRoles}
              />
              <Button
                type="submit"
                className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]"
              >
                <UserPlus className="size-4" />
                Create invite
              </Button>
            </form>

            <section className="grid gap-3 lg:grid-cols-3">
              <CollaborationList
                title="Pending invites"
                empty="No pending invites."
                rows={ownedInvitations.map((invitation) => ({
                  id: invitation.id,
                  primary: invitation.invitedEmail,
                  secondary: `${titleCase(invitation.role)} access, expires ${formatDate(invitation.expiresAt)}`,
                  action: (
                    <form action={cancelInvitationAction}>
                      <input type="hidden" name="invitationId" value={invitation.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Cancel
                      </Button>
                    </form>
                  ),
                }))}
              />
              <CollaborationList
                title="Shared by me"
                empty="No accepted collaborators."
                rows={ownedMemberships.map((membership) => {
                  const member = relatedUsersById.get(membership.memberUserId);
                  return {
                    id: membership.id,
                    primary: member?.email ?? member?.name ?? membership.memberUserId,
                    secondary: `${titleCase(membership.role)} access`,
                    action: (
                      <form action={removeMembershipAction}>
                        <input type="hidden" name="membershipId" value={membership.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Remove
                        </Button>
                      </form>
                    ),
                  };
                })}
              />
              <CollaborationList
                title="Shared with me"
                empty="No accounts shared with this login."
                rows={receivedMemberships.map((membership) => {
                  const owner = relatedUsersById.get(membership.ownerUserId);
                  return {
                    id: membership.id,
                    primary: owner?.email ?? owner?.name ?? membership.ownerUserId,
                    secondary: `${titleCase(membership.role)} access`,
                    action: (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/shared/${membership.ownerUserId}`} prefetch={false}>
                          Open
                        </Link>
                      </Button>
                    ),
                  };
                })}
              />
            </section>
          </CardContent>
        </DataPanel>
      </SettingsMobileDisclosure>

      <SocialFeaturePanel data={featureData} />

      <section className="grid gap-4 lg:grid-cols-2">
        <SettingsMobileDisclosure
          id="data-export"
          title="Data export"
          description="Download a JSON copy."
        >
          <DataPanel>
            <SectionHeader
              title="Data export"
              description="Download a JSON copy of your user-owned data, including shots, rounds, clubs, achievements, and private courses."
              action={<Download className="size-5 text-emerald-600" />}
            />
            <CardContent>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/api/settings/export" prefetch={false}>
                  <Download className="size-4" />
                  Export my data
                </Link>
              </Button>
            </CardContent>
          </DataPanel>
        </SettingsMobileDisclosure>

        <SettingsMobileDisclosure
          id="danger-zone"
          title="Danger zone"
          description="Delete app data."
        >
          <DataPanel>
            <SectionHeader
              title="Delete app data"
              description="This removes LM World Tour data for the signed-in account. It does not delete the Supabase Auth login itself."
              action={<Trash2 className="size-5 text-destructive" />}
            />
            <CardContent>
              <form action={deleteAccountDataAction} className="grid gap-3">
                <FormField
                  label={`Type ${profile.email ?? profile.id} to confirm`}
                  name="confirmation"
                  autoComplete="off"
                />
                <Button type="submit" variant="destructive" className="w-full rounded-xl sm:w-fit">
                  <Trash2 className="size-4" />
                  Delete my app data
                </Button>
              </form>
            </CardContent>
          </DataPanel>
        </SettingsMobileDisclosure>
      </section>
    </PageShell>
  );
}

function VisibilitySimulatorPanel({
  privacy,
  ownedMembershipCount,
  receivedMembershipCount,
}: {
  privacy: PrivacySettings;
  ownedMembershipCount: number;
  receivedMembershipCount: number;
}) {
  const rows = [
    {
      label: "Public visitor",
      value: privacy.publicProfile ? "Profile preview" : "Hidden",
      detail: privacy.publicProfile
        ? "Public visitors can see the profile shell you choose to expose."
        : "Public visitors cannot browse your profile by default.",
    },
    {
      label: "Friend",
      value: privacy.allowLeaderboard ? "Leaderboard allowed" : "No leaderboard",
      detail: "Friends can see only friend-visible profile, feed and leaderboard surfaces.",
    },
    {
      label: "Coach/viewer/editor",
      value: privacy.allowCoachAccess ? `${ownedMembershipCount} shared` : "Invite only",
      detail: "Account access is controlled by explicit memberships, not friendship.",
    },
    {
      label: "Shared with me",
      value: receivedMembershipCount,
      detail: "Accounts you can open because an owner granted role-scoped access.",
    },
  ];

  return (
    <SettingsMobileDisclosure
      id="visibility-simulator"
      title="Visibility simulator"
      description="Public, friend and coach views."
    >
      <DataPanel>
        <SectionHeader
          title="Visibility simulator"
          description="Preview what each audience can access before sharing profile, feed, leaderboard or account data."
          action={
            <StatusPill
              tone={privacy.publicProfile || privacy.allowLeaderboard ? "amber" : "green"}
            >
              {privacy.publicProfile || privacy.allowLeaderboard ? "Sharing on" : "Private"}
            </StatusPill>
          }
        />
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rows.map((row) => (
            <div key={row.label} className="rounded-lg border bg-[#F5F6F4] p-3">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="mt-1 text-sm font-semibold">{row.value}</p>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </CardContent>
        <div className="border-t border-slate-200 px-4 py-3 text-sm leading-6 text-muted-foreground">
          Private by default. Friends do not get account access. Coach, viewer and editor access is
          separate from social friendship.
        </div>
      </DataPanel>
    </SettingsMobileDisclosure>
  );
}

function DataControlStatusPanel({
  profile,
  ownedInvitationCount,
  ownedMembershipCount,
  receivedMembershipCount,
}: {
  profile: Awaited<ReturnType<typeof getSettingsData>>["profile"];
  ownedInvitationCount: number;
  ownedMembershipCount: number;
  receivedMembershipCount: number;
}) {
  const rows = [
    {
      label: "Export status",
      value: "Available",
      detail: "JSON export includes user-owned golf data from the current account.",
    },
    {
      label: "Delete status",
      value: "Confirmation required",
      detail: `Deletion requires typing ${profile.email ?? "your user id"} exactly.`,
    },
    {
      label: "Shared by me",
      value: ownedMembershipCount,
      detail: `${ownedInvitationCount} pending invitations.`,
    },
    {
      label: "Shared with me",
      value: receivedMembershipCount,
      detail: "Role-scoped collaborator accounts linked to this login.",
    },
  ];

  return (
    <SettingsMobileDisclosure
      id="data-control-status"
      title="Data export/delete status"
      description="Export, delete and shared-account state."
    >
      <DataPanel>
        <SectionHeader
          title="Data export/delete status"
          description="Shows whether account data can be exported, what deletion requires, and whether shared account access exists."
          action={<StatusPill tone="sky">Control centre</StatusPill>}
        />
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rows.map((row) => (
            <div key={row.label} className="rounded-lg border bg-[#F5F6F4] p-3">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="mt-1 text-sm font-semibold">{row.value}</p>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </CardContent>
        <div className="flex flex-col gap-2 border-t border-slate-200 p-4 sm:flex-row">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/api/settings/export" prefetch={false}>
              <Download className="size-4" />
              Export my data
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <a href="#danger-zone">
              <Trash2 className="size-4" />
              Delete controls
            </a>
          </Button>
        </div>
      </DataPanel>
    </SettingsMobileDisclosure>
  );
}

function SettingsPreviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border bg-[#F5F6F4] px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 min-w-0 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function SettingsMobileDisclosure({
  id,
  title,
  description,
  children,
  defaultOpen = false,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details id={id} className="group scroll-mt-28 sm:contents" open={defaultOpen}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/92 px-3 py-2 text-sm shadow-sm sm:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block truncate font-semibold tracking-normal">{title}</span>
          {description ? (
            <span className="block truncate text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="hidden group-open:block sm:contents">{children}</div>
    </details>
  );
}

async function getSettingsData() {
  const userId = await requireCurrentUserId();
  const db = getDb();
  const [profileRows, ownedInvitations, ownedMemberships, receivedMemberships] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db
      .select()
      .from(accountInvitations)
      .where(eq(accountInvitations.ownerUserId, userId))
      .orderBy(desc(accountInvitations.createdAt)),
    db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.ownerUserId, userId))
      .orderBy(desc(accountMemberships.createdAt)),
    db
      .select()
      .from(accountMemberships)
      .where(eq(accountMemberships.memberUserId, userId))
      .orderBy(desc(accountMemberships.createdAt)),
  ]);
  const profile = profileRows[0];

  if (!profile) {
    throw new Error("Current user profile was not created.");
  }

  const relatedUserIds = Array.from(
    new Set([
      ...ownedMemberships.map((membership) => membership.memberUserId),
      ...receivedMemberships.map((membership) => membership.ownerUserId),
    ]),
  );
  const relatedUsers =
    relatedUserIds.length > 0
      ? await db
          .select({ id: users.id, email: users.email, name: users.name })
          .from(users)
          .where(inArray(users.id, relatedUserIds))
      : [];

  return {
    profile,
    ownedInvitations: ownedInvitations.filter((invitation) => invitation.status === "pending"),
    ownedMemberships,
    receivedMemberships,
    relatedUsersById: new Map(relatedUsers.map((user) => [user.id, user])),
  };
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

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <div className="flex h-10 items-center rounded-xl border bg-muted/50 px-3 text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

function SelectField<T extends string>({
  label,
  name,
  defaultValue,
  values,
}: {
  label: string;
  name: string;
  defaultValue: string;
  values: readonly T[];
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-10 rounded-xl border bg-white px-3 text-sm"
      >
        {values.map((value) => (
          <option key={value} value={value}>
            {titleCase(value)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({
  label,
  name,
  value,
  defaultChecked,
}: {
  label: string;
  name: string;
  value?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="size-4 rounded border-input accent-[#0B7A3B]"
      />
      <span>{label}</span>
    </label>
  );
}

function CollaborationList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{
    id: string;
    primary: string;
    secondary: string;
    action?: ReactNode;
  }>;
}) {
  return (
    <div className="rounded-lg border bg-[#F5F6F4] p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 grid gap-2">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.primary}</p>
                <p className="text-xs text-muted-foreground">{row.secondary}</p>
              </div>
              {row.action}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
            {empty}
          </p>
        )}
      </div>
    </div>
  );
}

function normalizePrivacy(value: unknown): PrivacySettings {
  if (!value || typeof value !== "object") {
    return { allowCoachAccess: false, allowLeaderboard: false, publicProfile: false };
  }

  const settings = value as Partial<PrivacySettings>;

  return {
    allowCoachAccess: settings.allowCoachAccess === true,
    allowLeaderboard: settings.allowLeaderboard === true,
    publicProfile: settings.publicProfile === true,
  };
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatInviteError(value: string) {
  switch (value) {
    case "self":
      return "You cannot invite your own account.";
    case "email":
      return "This invite was issued for a different email address.";
    case "invalid":
      return "This invite is invalid, expired, or has already been used.";
    default:
      return "The invite could not be completed.";
  }
}

function getRequestOrigin(requestHeaders: Headers) {
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
