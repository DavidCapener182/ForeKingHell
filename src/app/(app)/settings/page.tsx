import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  Bell,
  CreditCard,
  Database,
  Download,
  Link2,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import { desc, eq, inArray } from "drizzle-orm";

import {
  deleteAccountDataAction,
  resetGolfDataAction,
  updateUserSettingsAction,
} from "@/app/settings/actions";
import {
  SettingsAccessRowAction,
  SettingsInvitationDialog,
} from "@/app/settings/settings-access-actions";
import { SettingsStatusToast } from "@/app/settings/settings-status-toast";
import { OfflineStoragePanel } from "@/app/settings/offline-storage-panel";
import { SettingsMobileDisclosure } from "@/app/settings/settings-mobile-disclosure";
import { SettingsDirtyForm } from "@/app/settings/settings-dirty-form";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import type {
  DesktopSavedViewSuggestion,
  DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataHealthFeaturePanel, SocialFeaturePanel } from "@/components/features/feature-panels";
import { IOSGroupedList, IOSListRow, IOSSectionHeader } from "@/components/app/ios-mobile";
import {
  DataPanel,
  DataTableFrame,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { PlausibleEventOnMount } from "@/components/plausible-event-on-mount";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageArtwork } from "@/components/visuals/page-artwork";
import { ThemePreferenceSelect } from "@/components/theme-preference-select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { accountInvitations, accountMemberships, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import { getSiteOrigin } from "@/lib/site-origin";
import {
  dashboardPinOptions,
  parseTheme,
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
    reset?: string;
    resetError?: string;
    invite?: string;
    inviteAccepted?: string;
    inviteCancelled?: string;
    inviteError?: string;
    memberRemoved?: string;
    section?: string;
  }>;
};

type SettingsSection =
  | "general"
  | "appearance"
  | "privacy"
  | "sharing"
  | "notifications"
  | "data"
  | "offline"
  | "billing"
  | "danger";

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

type SettingsAccessRow = {
  id: string;
  scope: string;
  party: string;
  role: string;
  status: string;
  detail: string;
  action?: ReactNode;
};

const settingsAccessColumns: DesktopWorkbenchColumn[] = [
  { id: "scope", label: "Scope", locked: true },
  { id: "party", label: "Person or account" },
  { id: "role", label: "Role" },
  { id: "status", label: "Status" },
  { id: "detail", label: "Detail" },
  { id: "action", label: "Action" },
];

const settingsAccessSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Pending invitations",
    href: "/settings?section=sharing#sharing-settings",
    detail: "Coach, viewer and editor invites that have not been accepted.",
  },
  {
    title: "Shared by me",
    href: "/settings?section=sharing#sharing-settings",
    detail: "Accepted collaborators who can access this account.",
  },
  {
    title: "Shared with me",
    href: "/settings?section=sharing#sharing-settings",
    detail: "Accounts this login can open through role-scoped access.",
  },
];

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const activeSection = parseSettingsSection(params?.section);
  const [settingsData, featureData, surface] = await Promise.all([
    getSettingsData(),
    getFeatureIdeasData(),
    getRequestAppSurface(),
  ]);
  const { profile, ownedInvitations, ownedMemberships, receivedMemberships, relatedUsersById } =
    settingsData;
  const privacy = normalizePrivacy(profile.privacySettingsJson);
  const inviteUrl = params?.invite
    ? `${getSiteOrigin()}/settings/invitations/${encodeURIComponent(params.invite)}`
    : null;
  const accessRows: SettingsAccessRow[] = [
    ...ownedInvitations.map((invitation) => ({
      id: `invite-${invitation.id}`,
      scope: "Pending invite",
      party: invitation.invitedEmail,
      role: titleCase(invitation.role),
      status: "Pending",
      detail: `Expires ${formatDate(invitation.expiresAt)}`,
      action: (
        <SettingsAccessRowAction
          targetId={invitation.id}
          targetType="invitation"
          party={invitation.invitedEmail}
        />
      ),
    })),
    ...ownedMemberships.map((membership) => {
      const member = relatedUsersById.get(membership.memberUserId);

      return {
        id: `owned-${membership.id}`,
        scope: "Shared by me",
        party: member?.email ?? member?.name ?? membership.memberUserId,
        role: titleCase(membership.role),
        status: "Accepted",
        detail: `Added ${formatDate(membership.createdAt)}`,
        action: (
          <SettingsAccessRowAction
            targetId={membership.id}
            targetType="membership"
            party={member?.email ?? member?.name ?? membership.memberUserId}
          />
        ),
      };
    }),
    ...receivedMemberships.map((membership) => {
      const owner = relatedUsersById.get(membership.ownerUserId);

      return {
        id: `received-${membership.id}`,
        scope: "Shared with me",
        party: owner?.email ?? owner?.name ?? membership.ownerUserId,
        role: titleCase(membership.role),
        status: "Accepted",
        detail: `Added ${formatDate(membership.createdAt)}`,
        action: (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/shared/${membership.ownerUserId}`} prefetch={false}>
              Open
            </Link>
          </Button>
        ),
      };
    }),
  ];

  return (
    <PageShell>
      {params?.inviteAccepted ? <PlausibleEventOnMount eventName="Invite Accepted" /> : null}

      <SettingsSurfaceLayout surface={surface}>
        {surface === "companion" ? (
          <div className="grid gap-5">
            <header className="px-1 pt-1">
              <p className="text-sm font-medium text-primary">Your account</p>
              <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-[-0.025em]">
                Settings
              </h1>
              <p className="mt-1 text-[15px] leading-5 text-muted-foreground">
                Account, preferences, privacy and golf data.
              </p>
            </header>

            <section className="grid gap-2" aria-label="Account settings">
              <IOSSectionHeader title="Account" />
              <IOSGroupedList label="Account">
                <IOSListRow
                  label="Profile"
                  value={profile.name ?? profile.email ?? "Golfer"}
                  detail="Name and public golf identity"
                  href="/profile"
                  icon={UserCog}
                />
                <IOSListRow
                  label="Membership"
                  value="Account"
                  detail="Plan, subscription and billing"
                  href="/billing"
                  icon={CreditCard}
                />
              </IOSGroupedList>
            </section>

            <section className="grid gap-2" aria-label="Preferences">
              <IOSSectionHeader title="Preferences" />
              <IOSGroupedList label="Preferences">
                <IOSListRow
                  label="Units"
                  value={titleCase(profile.preferredUnits)}
                  detail="Distance and speed display"
                  href="/settings?section=general"
                  icon={SlidersHorizontal}
                />
                <IOSListRow
                  label="Appearance"
                  value={titleCase(profile.theme)}
                  detail="Follow system or choose a desktop theme"
                  href="/settings?section=appearance"
                  icon={Palette}
                />
                <IOSListRow
                  label="Notifications"
                  detail="Email and in-app preferences"
                  href="/settings/notifications"
                  icon={Bell}
                />
              </IOSGroupedList>
            </section>

            <section className="grid gap-2" aria-label="Data settings">
              <IOSSectionHeader title="Data" />
              <IOSGroupedList label="Data">
                <IOSListRow
                  label="Connected data"
                  value="Providers"
                  detail="Launch monitors and import sources"
                  href="/providers"
                  icon={Database}
                />
                <IOSListRow
                  label="Import history"
                  detail="Upload or reconnect measured sessions"
                  href="/import"
                  icon={Download}
                />
                <IOSListRow
                  label="Shared access"
                  value={accessRows.length > 0 ? String(accessRows.length) : "None"}
                  detail="Coaches, viewers and editors"
                  href="/settings?section=sharing"
                  icon={ShieldCheck}
                />
              </IOSGroupedList>
            </section>

            <IOSSectionHeader
              title="Advanced settings"
              description="Open only the section you need."
            />
          </div>
        ) : null}

        {surface === "workbench" ? (
          <div>
            <PageHeader
              eyebrow={<StatusPill tone="sky">Account</StatusPill>}
              title="Settings"
              description="Manage profile preferences, privacy defaults, and data portability for your LM World Tour account."
              visual={
                <PageArtwork variant="settings" alt="" className="h-full min-h-36" priority />
              }
              actions={
                <Button asChild size="sm" className="rounded-lg">
                  <Link href="/settings?section=general">
                    <UserCog className="size-4" />
                    Profile
                  </Link>
                </Button>
              }
            />
          </div>
        ) : null}

        <SettingsStatusToast saved={Boolean(params?.saved)} />

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

        {params?.reset ? (
          <Alert>
            <ShieldCheck className="size-4" />
            <AlertTitle>Golf data reset</AlertTitle>
            <AlertDescription>
              Golf, practice and social activity was removed. Your login, preferences, providers and
              billing account remain available.
            </AlertDescription>
          </Alert>
        ) : null}

        {params?.resetError === "confirmation" ? (
          <Alert variant="destructive">
            <Trash2 className="size-4" />
            <AlertTitle>Reset was not run</AlertTitle>
            <AlertDescription>Type RESET exactly before clearing golf data.</AlertDescription>
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

        {surface === "workbench" ? (
          <section className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
            <SettingsSectionNavigation activeSection={activeSection} />
            <Card className="p-4 py-4" aria-label="Current account summary">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{settingsSectionLabel(activeSection)}</p>
                <StatusPill tone="sky">Current section</StatusPill>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <SettingsPreviewRow label="Email" value={profile.email ?? "No email"} />
                <SettingsPreviewRow label="Units" value={profile.preferredUnits} />
                <SettingsPreviewRow label="Theme" value={titleCase(profile.theme)} />
                <SettingsPreviewRow
                  label="Privacy"
                  value={privacy.publicProfile ? "Public" : "Private"}
                />
              </div>
            </Card>
          </section>
        ) : null}

        <div className={activeSection === "data" ? "contents" : "lg:hidden"}>
          <SettingsMobileDisclosure
            id="data-health"
            title="Data health"
            description="Coverage, quality and connection status."
          >
            <DataHealthFeaturePanel data={featureData} />
          </SettingsMobileDisclosure>
          <DataControlStatusPanel
            profile={profile}
            ownedInvitationCount={ownedInvitations.length}
            ownedMembershipCount={ownedMemberships.length}
            receivedMembershipCount={receivedMemberships.length}
          />
        </div>
        <div className={activeSection === "privacy" ? "contents" : "lg:hidden"}>
          <VisibilitySimulatorPanel
            privacy={privacy}
            ownedMembershipCount={ownedMemberships.length}
            receivedMembershipCount={receivedMemberships.length}
          />
        </div>
        <div className={activeSection === "offline" ? "contents" : "lg:hidden"}>
          <SettingsMobileDisclosure
            id="offline-storage"
            title="Offline storage"
            description="Saved device data and queued imports."
          >
            <OfflineStoragePanel />
          </SettingsMobileDisclosure>
        </div>

        <div
          className={
            activeSection === "general" ||
            activeSection === "appearance" ||
            activeSection === "privacy"
              ? "contents"
              : "lg:hidden"
          }
        >
          <SettingsMobileDisclosure
            id="profile-settings"
            title="Profile"
            description={`${profile.preferredUnits}, ${profile.tableDensity} tables`}
          >
            <DataPanel>
              <SectionHeader
                title="Profile and preferences"
                description="These settings are stored with your user profile and control appearance, dashboard pins, units, and table density."
                action={<SlidersHorizontal className="size-5 text-primary" />}
              />
              <CardContent>
                <SettingsDirtyForm action={updateUserSettingsAction} className="grid gap-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Display name" name="name" defaultValue={profile.name ?? ""} />
                    <ReadonlyField label="Email" value={profile.email ?? "No email on profile"} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
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
                    <ThemePreferenceSelect defaultValue={parseTheme(profile.theme)} />
                  </div>

                  <fieldset className="grid gap-3 rounded-lg border bg-muted/40 p-4">
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

                  <fieldset className="grid gap-3 rounded-lg border bg-muted/40 p-4">
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

                  <Button type="submit" className="w-full rounded-lg sm:w-fit">
                    <UserCog className="size-4" />
                    Save settings
                  </Button>
                </SettingsDirtyForm>
              </CardContent>
            </DataPanel>
          </SettingsMobileDisclosure>
        </div>

        <div className={activeSection === "sharing" ? "contents" : "lg:hidden"}>
          <SettingsMobileDisclosure
            id="sharing-settings"
            title="Sharing"
            description="Invites, coaches and shared accounts."
          >
            <DataPanel>
              <SectionHeader
                title="Sharing and collaboration"
                description="Invite a coach, viewer, or editor. Invitations create role-scoped memberships before social and team features are enabled."
                action={<UserPlus className="size-5 text-primary" />}
              />
              <CardContent className="grid gap-5">
                <div className="flex justify-end">
                  <SettingsInvitationDialog />
                </div>

                <AccessManagementTable rows={accessRows} workbench={surface === "workbench"} />
              </CardContent>
            </DataPanel>
          </SettingsMobileDisclosure>

          <SettingsMobileDisclosure
            id="social-settings"
            title="Community and social"
            description="Feed, friends and group feature status."
          >
            <SocialFeaturePanel data={featureData} />
          </SettingsMobileDisclosure>
        </div>

        {activeSection === "notifications" ? (
          <SettingsRoutePanel
            title="Notification preferences"
            description="Choose which account and practice updates reach you."
            href="/settings/notifications"
            action="Open notification settings"
            icon={<Bell className="size-5 text-primary" />}
          />
        ) : null}

        {activeSection === "billing" ? (
          <SettingsRoutePanel
            title="Membership and billing"
            description="Review the current plan, invoices and subscription controls."
            href="/billing"
            action="Open billing"
            icon={<CreditCard className="size-5 text-primary" />}
          />
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className={activeSection === "data" ? "contents" : "lg:hidden"}>
            <SettingsMobileDisclosure
              id="data-export"
              title="Data export"
              description="Download a JSON copy."
            >
              <DataPanel>
                <SectionHeader
                  title="Data export"
                  description="Download a JSON copy of your user-owned data, including shots, rounds, clubs, achievements, and private courses."
                  action={<Download className="size-5 text-primary" />}
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
          </div>

          <div className={activeSection === "danger" ? "contents" : "lg:hidden"}>
            <SettingsMobileDisclosure
              id="danger-zone"
              title="Danger zone"
              description="Delete app data."
            >
              <Card className="ring-destructive/35">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Reset or delete</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Reset golf activity while keeping the login, or permanently delete the
                        account and authentication identity. Export first if you want a copy.
                      </p>
                    </div>
                    <Trash2 className="size-5 shrink-0 text-destructive" />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <Alert variant="destructive">
                    <Trash2 className="size-4" />
                    <AlertTitle>Permanent account actions</AlertTitle>
                    <AlertDescription>
                      Export anything you need before resetting golf data or deleting the account.
                    </AlertDescription>
                  </Alert>
                  <section className="grid gap-3" aria-labelledby="reset-golf-data-title">
                    <div>
                      <h3 id="reset-golf-data-title" className="font-semibold">
                        Reset golf data
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Removes sessions, shots, bag history, plans, achievements and authored
                        social activity. Keeps your login, preferences, provider links and billing
                        account.
                      </p>
                    </div>
                    <form action={resetGolfDataAction} className="grid gap-3">
                      <FormField
                        label="Type RESET to confirm"
                        name="confirmation"
                        autoComplete="off"
                      />
                      <ConfirmSubmitButton
                        type="submit"
                        variant="outline"
                        className="w-full rounded-xl sm:w-fit"
                        confirmTitle="Reset all golf data?"
                        confirmMessage="This removes sessions, shots, bag history, plans, achievements and authored social activity after the typed confirmation is checked."
                        confirmActionLabel="Reset golf data"
                      >
                        <Trash2 className="size-4" />
                        Reset golf data
                      </ConfirmSubmitButton>
                    </form>
                  </section>
                  <Separator />
                  <section className="grid gap-3" aria-labelledby="delete-account-title">
                    <div>
                      <h3 id="delete-account-title" className="font-semibold">
                        Delete account permanently
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Revokes active sessions, removes application data and deletes the Supabase
                        Auth identity. A recent sign-in and typed confirmation are required.
                      </p>
                    </div>
                    <form action={deleteAccountDataAction} className="grid gap-3">
                      <FormField
                        label={`Type ${profile.email ?? profile.id} to confirm`}
                        name="confirmation"
                        autoComplete="off"
                      />
                      <ConfirmSubmitButton
                        type="submit"
                        variant="destructive"
                        className="w-full rounded-xl sm:w-fit"
                        confirmTitle="Delete this account permanently?"
                        confirmMessage="This revokes active sessions, removes application data and deletes the authentication identity after the typed confirmation is checked."
                        confirmActionLabel="Delete account permanently"
                      >
                        <Trash2 className="size-4" />
                        Delete account permanently
                      </ConfirmSubmitButton>
                    </form>
                  </section>
                </CardContent>
              </Card>
            </SettingsMobileDisclosure>
          </div>
        </section>
      </SettingsSurfaceLayout>
    </PageShell>
  );
}

async function SettingsSurfaceLayout({
  surface,
  children,
}: {
  surface: "companion" | "workbench";
  children: ReactNode;
}) {
  if (surface === "companion") {
    return <div className="grid min-w-0 gap-5">{children}</div>;
  }

  const { DesktopWorkbenchLayout } = await import("@/components/app/desktop-workbench");
  return <DesktopWorkbenchLayout scope="settings">{children}</DesktopWorkbenchLayout>;
}

const settingsSections: Array<{ value: SettingsSection; label: string }> = [
  { value: "general", label: "General" },
  { value: "appearance", label: "Appearance" },
  { value: "privacy", label: "Privacy" },
  { value: "sharing", label: "Sharing" },
  { value: "notifications", label: "Notifications" },
  { value: "data", label: "Connected data" },
  { value: "offline", label: "Offline" },
  { value: "billing", label: "Billing" },
  { value: "danger", label: "Danger" },
];

function SettingsSectionNavigation({ activeSection }: { activeSection: SettingsSection }) {
  return (
    <nav className="sticky top-28 min-w-0" aria-label="Settings sections">
      <Card className="gap-0 p-3">
        <CardContent className="p-0">
          <p className="px-2 pb-2 text-sm font-semibold">Settings</p>
          <ButtonGroup
            orientation="vertical"
            className="w-full items-stretch"
            data-settings-section-navigation
          >
            {settingsSections.map((section) => (
              <Button
                key={section.value}
                asChild
                size="sm"
                variant={section.value === activeSection ? "secondary" : "ghost"}
                className={
                  section.value === "danger"
                    ? "w-full justify-start text-destructive"
                    : "w-full justify-start"
                }
              >
                <Link
                  href={`/settings?section=${section.value}`}
                  prefetch={false}
                  aria-current={section.value === activeSection ? "page" : undefined}
                >
                  {section.label}
                </Link>
              </Button>
            ))}
          </ButtonGroup>
        </CardContent>
      </Card>
    </nav>
  );
}

function SettingsRoutePanel({
  title,
  description,
  href,
  action,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
  icon: ReactNode;
}) {
  return (
    <DataPanel>
      <SectionHeader title={title} description={description} action={icon} />
      <CardContent>
        <Button asChild>
          <Link href={href} prefetch={false}>
            {action}
          </Link>
        </Button>
      </CardContent>
    </DataPanel>
  );
}

function parseSettingsSection(value: string | undefined): SettingsSection {
  return settingsSections.some((section) => section.value === value)
    ? (value as SettingsSection)
    : "general";
}

function settingsSectionLabel(value: SettingsSection) {
  return settingsSections.find((section) => section.value === value)?.label ?? "General";
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
            <div key={row.label} className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="mt-1 text-sm font-semibold">{row.value}</p>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </CardContent>
        <div className="border-t border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
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
            <div key={row.label} className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="mt-1 text-sm font-semibold">{row.value}</p>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </CardContent>
        <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/api/settings/export" prefetch={false}>
              <Download className="size-4" />
              Export my data
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/settings?section=danger" prefetch={false}>
              <Trash2 className="size-4" />
              Delete controls
            </Link>
          </Button>
        </div>
      </DataPanel>
    </SettingsMobileDisclosure>
  );
}

async function AccessManagementTable({
  rows,
  workbench,
}: {
  rows: SettingsAccessRow[];
  workbench: boolean;
}) {
  const workbenchModule = workbench ? await import("@/components/app/desktop-workbench") : null;
  const DesktopTableWorkbenchControls = workbenchModule?.DesktopTableWorkbenchControls;

  return (
    <section
      id="settings-access-table"
      data-workbench-scope="settings-access"
      className="grid gap-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Account access ledger</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Review pending invites, accepted collaborators and accounts shared with this login.
          </p>
        </div>
        <StatusPill tone={rows.length > 0 ? "green" : "slate"}>
          {rows.length} access rows
        </StatusPill>
      </div>

      {!workbench ? (
        <div>
          <IOSGroupedList label="Account access">
            {rows.length > 0 ? (
              rows.map((row) => (
                <IOSListRow
                  key={row.id}
                  label={row.party}
                  value={row.role}
                  detail={`${row.scope} · ${row.status} · ${row.detail}`}
                  trailing={row.action}
                />
              ))
            ) : (
              <IOSListRow
                label="No shared access"
                detail="Create an invite when a coach, viewer or editor needs access."
              />
            )}
          </IOSGroupedList>
        </div>
      ) : null}

      {workbench && DesktopTableWorkbenchControls ? (
        <div>
          <DesktopTableWorkbenchControls
            viewKey="settings-access"
            scope="settings-access"
            currentViewLabel="Account access"
            resultLabel={`${rows.length} access rows`}
            columns={settingsAccessColumns}
            suggestedViews={settingsAccessSuggestedViews}
            exportTableId="settings-access"
            exportFileName="forekinghell-account-access.csv"
          />
        </div>
      ) : null}

      {workbench ? (
        <div>
          <DataTableFrame mainTable mainTableLabel="Account access table" stickyFirstColumn>
            <Table
              data-workbench-export-table="settings-access"
              aria-describedby="settings-access-summary"
            >
              <TableCaption id="settings-access-summary" className="sr-only">
                Account access table showing invitation and membership scope, person or account,
                role, status, detail and action.
              </TableCaption>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted">
                <TableRow>
                  <TableHead
                    data-column="scope"
                    className="sticky left-0 z-20 min-w-48 bg-muted shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                  >
                    Scope
                  </TableHead>
                  <TableHead data-column="party">Person or account</TableHead>
                  <TableHead data-column="role">Role</TableHead>
                  <TableHead data-column="status">Status</TableHead>
                  <TableHead data-column="detail">Detail</TableHead>
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
                        data-column="scope"
                        className="sticky left-0 z-10 min-w-48 bg-card font-medium shadow-[1px_0_0_color-mix(in_srgb,var(--border)_72%,transparent)]"
                      >
                        {row.scope}
                      </TableCell>
                      <TableCell data-column="party">
                        <span className="block max-w-72 truncate">{row.party}</span>
                      </TableCell>
                      <TableCell data-column="role">{row.role}</TableCell>
                      <TableCell data-column="status">
                        <StatusPill tone={row.status === "Pending" ? "amber" : "green"}>
                          {row.status}
                        </StatusPill>
                      </TableCell>
                      <TableCell data-column="detail">{row.detail}</TableCell>
                      <TableCell data-column="action" className="text-right">
                        {row.action}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No invitations or shared account access yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DataTableFrame>
        </div>
      ) : null}
    </section>
  );
}

function SettingsPreviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 min-w-0 truncate text-sm font-semibold">{value}</p>
    </div>
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
      <Input name={name} className="h-10 rounded-xl bg-card" {...props} />
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
    <div className="grid gap-2 text-sm font-medium">
      <Label>{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger className="h-10 w-full bg-card">
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {values.map((value) => (
            <SelectItem key={value} value={value}>
              {titleCase(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
    <Label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm">
      <Switch name={name} value={value} defaultChecked={defaultChecked} aria-label={label} />
      <span>{label}</span>
    </Label>
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
