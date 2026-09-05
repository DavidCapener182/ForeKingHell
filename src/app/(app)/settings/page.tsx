import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  Bell,
  CreditCard,
  Database,
  Download,
  HardDrive,
  Link2,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
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
import { SettingsDirtyForm } from "@/app/settings/settings-dirty-form";
import { saveNotificationPreferencesAction } from "@/app/settings/notifications/actions";
import { OfflineStoragePanel } from "@/app/settings/offline-storage-panel";
import { SettingsStatusToast } from "@/app/settings/settings-status-toast";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import { settingsSections, isSettingsSection, type SettingsSection } from "@/lib/settings-sections";
import {
  DataHealthFeaturePanel,
  ProviderHealthFeaturePanel,
} from "@/components/features/feature-panels";
import { PageShell, StatusPill } from "@/components/premium";
import { PlausibleEventOnMount } from "@/components/plausible-event-on-mount";
import { ThemePreferenceSelect } from "@/components/theme-preference-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import { getDb } from "@/db/client";
import { accountInvitations, accountMemberships, users } from "@/db/schema";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { requireCurrentUserId } from "@/lib/current-user";
import { getFeatureIdeasData } from "@/lib/feature-ideas";
import {
  getProductPreferences,
  type NotificationCategory,
  type NotificationDelivery,
  type NotificationPreferences,
} from "@/lib/product-preferences";
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

type SettingsAccessRow = {
  id: string;
  scope: string;
  party: string;
  role: string;
  status: string;
  detail: string;
  action?: ReactNode;
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

const notificationOptions = [
  {
    key: "weeklyReview",
    title: "Weekly game review",
    detail: "Evidence-backed weekly recap and next-practice signal.",
  },
  {
    key: "dataQuality",
    title: "Data quality",
    detail: "Imports, duplicate warnings and repair actions.",
  },
  {
    key: "achievements",
    title: "Achievements",
    detail: "Newly proven milestones and personal bests.",
  },
  {
    key: "challenges",
    title: "Challenges",
    detail: "Invitations and competition activity.",
  },
  {
    key: "social",
    title: "Friends",
    detail: "Friend requests and private social activity.",
  },
] as const;

const notificationDeliveryOptions: Array<{
  key: NotificationCategory;
  title: string;
  detail: string;
}> = [
  {
    key: "dataQuality",
    title: "Data needs attention",
    detail: "Mapping, duplicates and failed sync evidence.",
  },
  {
    key: "practiceDue",
    title: "Practice due",
    detail: "Measured-plan reminders and unfinished range work.",
  },
  {
    key: "goalProgress",
    title: "Goal progress",
    detail: "Progress, confidence changes and target milestones.",
  },
  {
    key: "personalBest",
    title: "Personal best",
    detail: "New records backed by qualifying evidence.",
  },
  {
    key: "providerSync",
    title: "Provider sync",
    detail: "Reconnects, failed imports and recovered connections.",
  },
  {
    key: "competition",
    title: "Competition",
    detail: "Challenges, tournaments, eligibility and proof status.",
  },
  {
    key: "friendActivity",
    title: "Friend activity",
    detail: "Private social events allowed by your visibility settings.",
  },
  { key: "billing", title: "Billing", detail: "Plan, payment and entitlement changes." },
  { key: "security", title: "Security", detail: "Sign-in, account and sensitive-access alerts." },
];

const notificationDeliveryLabels: Record<NotificationDelivery, string> = {
  in_app: "In-app",
  digest: "Email digest",
  immediate: "Email now",
  weekly: "Weekly email",
  off: "Off",
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const activeSection = parseSettingsSection(params?.section);
  const hasSelectedMobileSection = isSettingsSection(params?.section);
  const [settingsData, surface] = await Promise.all([getSettingsData(), getRequestAppSurface()]);
  const { profile, ownedInvitations, ownedMemberships, receivedMemberships, relatedUsersById } =
    settingsData;
  const privacy = normalizePrivacy(profile.privacySettingsJson);
  const featureData = activeSection === "data" ? await getFeatureIdeasData() : null;
  const notificationPreferences =
    activeSection === "notifications"
      ? (await getProductPreferences(profile.id)).notifications
      : null;
  const inviteUrl = params?.invite
    ? `${getSiteOrigin()}/settings/invitations/${encodeURIComponent(params.invite)}`
    : null;
  const accessRows = buildAccessRows({
    ownedInvitations,
    ownedMemberships,
    receivedMemberships,
    relatedUsersById,
  });

  return (
    <PageShell contentClassName="gap-0 sm:gap-0 lg:gap-0">
      {params?.inviteAccepted ? <PlausibleEventOnMount eventName="Invite Accepted" /> : null}
      <SettingsStatusToast saved={Boolean(params?.saved)} />

      <SettingsSurfaceLayout surface={surface}>
        {surface === "companion" && !hasSelectedMobileSection ? (
          <MobileSettingsIndex
            profile={profile}
            privacy={privacy}
            sharedAccessCount={accessRows.length}
          />
        ) : (
          <div className="min-w-0">
            <SettingsPageHeading surface={surface} activeSection={activeSection} />

            <div className="mt-5 grid min-w-0 gap-8 lg:mt-7 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[16rem_minmax(0,1fr)]">
              <SettingsSectionNavigation activeSection={activeSection} />

              <section className="min-w-0" aria-label={settingsSection(activeSection).label}>
                <SettingsSectionHeading section={activeSection} surface={surface} />
                <SettingsAlerts params={params} inviteUrl={inviteUrl} />
                <div className="mt-5">
                  <SettingsSectionContent
                    activeSection={activeSection}
                    companion={surface === "companion"}
                    profile={profile}
                    privacy={privacy}
                    accessRows={accessRows}
                    featureData={featureData}
                    notificationPreferences={notificationPreferences}
                    ownedMembershipCount={ownedMemberships.length}
                    receivedMembershipCount={receivedMemberships.length}
                  />
                </div>
              </section>
            </div>
          </div>
        )}
      </SettingsSurfaceLayout>
    </PageShell>
  );
}

function MobileSettingsIndex({
  profile,
  privacy,
  sharedAccessCount,
}: {
  profile: SettingsProfile;
  privacy: PrivacySettings;
  sharedAccessCount: number;
}) {
  return (
    <div className="grid gap-6 pb-3">
      <MobileLargeTitle title="Settings" eyebrow="Your account" />

      <MobileSection title="Preferences">
        <MobileGroupedList label="Preferences">
          <MobileListRow
            label="General"
            value={titleCase(profile.preferredUnits)}
            detail="Name and measurement units"
            href="/settings?section=general"
            icon={SlidersHorizontal}
          />
          <MobileListRow
            label="Appearance"
            value={titleCase(profile.theme)}
            detail="Device appearance and desktop preferences"
            href="/settings?section=appearance"
            icon={Palette}
          />
          <MobileListRow
            label="Privacy"
            value={privacy.publicProfile ? "Public" : "Private"}
            detail="Profile and coach visibility"
            href="/settings?section=privacy"
            icon={ShieldCheck}
          />
          <MobileListRow
            label="Notifications"
            detail="Delivery and in-app updates"
            href="/settings?section=notifications"
            icon={Bell}
          />
        </MobileGroupedList>
      </MobileSection>

      <MobileSection title="Account and data">
        <MobileGroupedList label="Account and data">
          <MobileListRow
            label="Sharing"
            value={sharedAccessCount > 0 ? sharedAccessCount : "None"}
            detail="Collaborators and invitations"
            href="/settings?section=sharing"
            icon={UserPlus}
          />
          <MobileListRow
            label="Connected Data"
            detail="Providers, imports and exports"
            href="/settings?section=data"
            icon={Database}
          />
          <MobileListRow
            label="Offline"
            detail="Storage and retry queue"
            href="/settings?section=offline"
            icon={HardDrive}
          />
          <MobileListRow
            label="Billing"
            detail="Plan, subscription and invoices"
            href="/settings?section=billing"
            icon={CreditCard}
          />
        </MobileGroupedList>
      </MobileSection>

      <MobileSection title="Danger zone">
        <MobileGroupedList label="Danger zone">
          <MobileListRow
            label="Danger Zone"
            detail="Reset golf history or delete this account"
            href="/settings?section=danger"
            icon={Trash2}
            destructive
          />
        </MobileGroupedList>
      </MobileSection>
    </div>
  );
}

function SettingsPageHeading({
  surface,
}: {
  surface: "companion" | "workbench";
  activeSection: SettingsSection;
}) {
  if (surface === "companion") return null;

  return (
    <header className="border-b border-border pb-5">
      <p className="text-sm font-semibold text-primary">Account</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.025em]">Settings</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Manage account preferences, access and data without losing your place.
      </p>
    </header>
  );
}

function SettingsSectionHeading({
  section,
  surface,
}: {
  section: SettingsSection;
  surface: "companion" | "workbench";
}) {
  const item = settingsSection(section);
  if (surface === "companion") return <MobileLargeTitle title={item.label} />;

  return (
    <header className="border-b border-border pb-5">
      <h1 id="settings-section-title" className="text-2xl font-semibold tracking-[-0.02em]">
        {item.label}
      </h1>
      <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{item.description}</p>
    </header>
  );
}

function SettingsSectionNavigation({ activeSection }: { activeSection: SettingsSection }) {
  const regularSections = settingsSections.filter((section) => section.value !== "danger");
  const dangerSection = settingsSection("danger");

  return (
    <nav className="sticky top-24 hidden min-w-0 lg:block" aria-label="Settings sections">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Settings
      </p>
      <div className="grid gap-0.5" data-settings-section-navigation>
        {regularSections.map((section) => (
          <SettingsNavigationLink
            key={section.value}
            section={section}
            active={section.value === activeSection}
          />
        ))}
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <SettingsNavigationLink
          section={dangerSection}
          active={activeSection === "danger"}
          destructive
        />
      </div>
    </nav>
  );
}

function SettingsNavigationLink({
  section,
  active,
  destructive = false,
}: {
  section: (typeof settingsSections)[number];
  active: boolean;
  destructive?: boolean;
}) {
  return (
    <Link
      href={`/settings?section=${section.value}`}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={`focus-aaa flex min-h-10 items-center rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-100 motion-reduce:transition-none ${
        active
          ? destructive
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary"
          : destructive
            ? "text-destructive hover:bg-destructive/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {section.label}
    </Link>
  );
}

function SettingsAlerts({
  params,
  inviteUrl,
}: {
  params: Awaited<NonNullable<SettingsPageProps["searchParams"]>> | undefined;
  inviteUrl: string | null;
}) {
  return (
    <div className="mt-4 grid gap-3" aria-label="Settings status">
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
        <SettingsInlineStatus
          title="Invite accepted"
          detail="The shared account is now available to this login."
        />
      ) : null}
      {params?.inviteCancelled ? (
        <SettingsInlineStatus
          title="Invite cancelled"
          detail="The pending invite link can no longer be accepted."
        />
      ) : null}
      {params?.memberRemoved ? (
        <SettingsInlineStatus
          title="Access removed"
          detail="The collaborator can no longer access shared data."
        />
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
    </div>
  );
}

function SettingsInlineStatus({ title, detail }: { title: string; detail: string }) {
  return (
    <Alert>
      <ShieldCheck className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{detail}</AlertDescription>
    </Alert>
  );
}

function SettingsSectionContent({
  activeSection,
  companion,
  profile,
  privacy,
  accessRows,
  featureData,
  notificationPreferences,
  ownedMembershipCount,
  receivedMembershipCount,
}: {
  activeSection: SettingsSection;
  companion: boolean;
  profile: SettingsProfile;
  privacy: PrivacySettings;
  accessRows: SettingsAccessRow[];
  featureData: Awaited<ReturnType<typeof getFeatureIdeasData>> | null;
  notificationPreferences: NotificationPreferences | null;
  ownedMembershipCount: number;
  receivedMembershipCount: number;
}) {
  switch (activeSection) {
    case "general":
      return <GeneralSettings profile={profile} companion={companion} />;
    case "appearance":
      return <AppearanceSettings profile={profile} companion={companion} />;
    case "privacy":
      return (
        <PrivacySettingsSection
          privacy={privacy}
          ownedMembershipCount={ownedMembershipCount}
          receivedMembershipCount={receivedMembershipCount}
        />
      );
    case "sharing":
      return <SharingSettings accessRows={accessRows} />;
    case "notifications":
      return notificationPreferences ? (
        <NotificationSettings preferences={notificationPreferences} />
      ) : null;
    case "data":
      return featureData ? <ConnectedDataSettings featureData={featureData} /> : null;
    case "offline":
      return <OfflineStoragePanel />;
    case "billing":
      return <BillingSettings />;
    case "danger":
      return <DangerZoneSettings profile={profile} />;
  }
}

function GeneralSettings({ profile, companion }: { profile: SettingsProfile; companion: boolean }) {
  return (
    <SettingsDirtyForm action={updateUserSettingsAction} className="grid gap-6">
      <input type="hidden" name="settingsSection" value="general" />
      <SettingsGroup
        title="Account details"
        description="The name and measurement system used throughout ForeKingHell."
      >
        <div className="grid gap-5 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <FormField label="Display name" name="name" defaultValue={profile.name ?? ""} />
          <ReadonlyField label="Email" value={profile.email ?? "No email on profile"} />
          <SelectField
            label="Preferred units"
            name="preferredUnits"
            defaultValue={profile.preferredUnits}
            values={preferredUnitOptions}
          />
        </div>
      </SettingsGroup>

      <DesktopSettingsDisclosure companion={companion}>
        <SettingsGroup
          title="Dashboard shortcuts"
          description="Choose the areas kept close at hand on your desktop dashboard."
        >
          <div className="grid sm:grid-cols-2">
            {dashboardPinOptions.map((pin) => (
              <SettingsToggleRow
                key={pin}
                name="dashboardPins"
                value={pin}
                label={dashboardPinLabels[pin]}
                detail={`Show ${dashboardPinLabels[pin].toLowerCase()} in dashboard shortcuts.`}
                defaultChecked={profile.dashboardPins.includes(pin)}
              />
            ))}
          </div>
        </SettingsGroup>
      </DesktopSettingsDisclosure>
    </SettingsDirtyForm>
  );
}

function AppearanceSettings({
  profile,
  companion,
}: {
  profile: SettingsProfile;
  companion: boolean;
}) {
  return (
    <SettingsDirtyForm action={updateUserSettingsAction} className="grid gap-6">
      <input type="hidden" name="settingsSection" value="appearance" />
      {companion ? (
        <div className="grid gap-2">
          <p className="mobile-type-headline">Automatic appearance</p>
          <p className="mobile-type-callout text-muted-foreground">
            ForeKingHell follows this iPhone’s Light or Dark appearance.
          </p>
        </div>
      ) : null}
      <DesktopSettingsDisclosure companion={companion}>
        <SettingsGroup
          title="Theme"
          description="Preview a desktop theme, then save it to your account."
        >
          <div className="px-4 py-4 sm:px-5">
            <ThemePreferenceSelect defaultValue={parseTheme(profile.theme)} />
          </div>
        </SettingsGroup>
        <SettingsGroup
          title="Information density"
          description="Control how much information is visible in tables and workbench views."
        >
          <div className="px-4 py-4 sm:max-w-md sm:px-5">
            <SelectField
              label="Table density"
              name="tableDensity"
              defaultValue={profile.tableDensity}
              values={tableDensityOptions}
            />
          </div>
        </SettingsGroup>
      </DesktopSettingsDisclosure>
    </SettingsDirtyForm>
  );
}

function PrivacySettingsSection({
  privacy,
  ownedMembershipCount,
  receivedMembershipCount,
}: {
  privacy: PrivacySettings;
  ownedMembershipCount: number;
  receivedMembershipCount: number;
}) {
  return (
    <SettingsDirtyForm action={updateUserSettingsAction} className="grid gap-6">
      <input type="hidden" name="settingsSection" value="privacy" />
      <SettingsGroup
        title="Visibility defaults"
        description="New sharing stays private unless you explicitly enable it."
      >
        <SettingsToggleRow
          name="allowCoachAccess"
          label="Invited coach access"
          detail="Allow invited coaches to read your golf data within their assigned role."
          defaultChecked={privacy.allowCoachAccess}
        />
        <SettingsToggleRow
          name="allowLeaderboard"
          label="Friend leaderboards"
          detail="Include your profile in private leaderboards shared with friends."
          defaultChecked={privacy.allowLeaderboard}
        />
        <SettingsToggleRow
          name="publicProfile"
          label="Public profile"
          detail="Allow a public profile if you choose to share it later."
          defaultChecked={privacy.publicProfile}
        />
      </SettingsGroup>
      <SettingsGroup
        title="Current access"
        description="A quick readback of who can reach account-level data."
      >
        <SettingsValueRow
          label="Shared by you"
          value={ownedMembershipCount}
          detail="Accepted role-scoped collaborators."
        />
        <SettingsValueRow
          label="Shared with you"
          value={receivedMembershipCount}
          detail="Accounts another owner has granted you access to."
        />
        <SettingsValueRow
          label="Public visitors"
          value={privacy.publicProfile ? "Profile visible" : "Hidden"}
          detail="Public visitors never receive account-level access."
        />
      </SettingsGroup>
    </SettingsDirtyForm>
  );
}

function SharingSettings({ accessRows }: { accessRows: SettingsAccessRow[] }) {
  return (
    <SettingsGroup
      title="Account access"
      description="Invite a coach, viewer or editor and review every active relationship."
      action={<SettingsInvitationDialog />}
    >
      <AccessManagementTable rows={accessRows} />
    </SettingsGroup>
  );
}

function NotificationSettings({ preferences }: { preferences: NotificationPreferences }) {
  return (
    <SettingsDirtyForm action={saveNotificationPreferencesAction} className="grid gap-6">
      <input type="hidden" name="settingsReturnTo" value="section" />
      <SettingsGroup
        title="Delivery by category"
        description="Security and billing can stay immediate while less urgent updates remain quieter."
      >
        {notificationDeliveryOptions.map((option) => (
          <SettingsSelectRow
            key={option.key}
            label={option.title}
            detail={option.detail}
            name={option.key}
            defaultValue={preferences.delivery[option.key]}
            values={notificationDeliveryLabels}
          />
        ))}
      </SettingsGroup>
      <SettingsGroup
        title="In-app notification centre"
        description="Choose which activity is allowed into your in-app feed."
      >
        {notificationOptions.map((option) => (
          <SettingsToggleRow
            key={option.key}
            name={`legacy_${option.key}`}
            label={option.title}
            detail={option.detail}
            defaultChecked={preferences[option.key]}
          />
        ))}
      </SettingsGroup>
    </SettingsDirtyForm>
  );
}

function ConnectedDataSettings({
  featureData,
}: {
  featureData: Awaited<ReturnType<typeof getFeatureIdeasData>>;
}) {
  return (
    <div className="grid gap-6">
      <SettingsGroup
        title="Data sources"
        description="Connect providers, import measured sessions or take a copy of your data."
      >
        <SettingsLinkRow
          href="/providers"
          icon={<Database className="size-4" aria-hidden />}
          label="Launch-monitor providers"
          detail="Manage Rapsodo and other connected accounts."
          action="Manage"
        />
        <SettingsLinkRow
          href="/import"
          icon={<Download className="size-4" aria-hidden />}
          label="Import history"
          detail="Upload, map or reconnect measured sessions."
          action="Open"
        />
        <SettingsLinkRow
          href="/api/settings/export"
          icon={<Download className="size-4" aria-hidden />}
          label="Export account data"
          detail="Download a JSON copy of user-owned golf data."
          action="Download"
          prefetch={false}
        />
      </SettingsGroup>
      <div className="grid gap-6 xl:grid-cols-2">
        <DataHealthFeaturePanel data={featureData} />
        <ProviderHealthFeaturePanel data={featureData} />
      </div>
    </div>
  );
}

function BillingSettings() {
  return (
    <SettingsGroup
      title="Membership and billing"
      description="Billing is managed in a dedicated secure workspace."
    >
      <SettingsLinkRow
        href="/billing"
        icon={<CreditCard className="size-4" aria-hidden />}
        label="Plan and subscription"
        detail="Review membership, invoices and subscription controls."
        action="Open billing"
      />
    </SettingsGroup>
  );
}

function DangerZoneSettings({ profile }: { profile: SettingsProfile }) {
  return (
    <section
      id="danger-zone"
      className="scroll-mt-24 rounded-2xl border border-destructive/45 bg-destructive/[0.035]"
    >
      <div className="border-b border-destructive/25 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-destructive">Permanent account actions</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Export anything you need before resetting golf data or deleting the account.
            </p>
          </div>
          <Trash2 className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        </div>
      </div>

      <div className="grid gap-6 px-4 py-5 sm:px-5">
        <Alert variant="destructive">
          <Trash2 className="size-4" />
          <AlertTitle>These actions cannot be undone</AlertTitle>
          <AlertDescription>
            Both actions require typed confirmation and a final confirmation dialog.
          </AlertDescription>
        </Alert>

        <section className="grid gap-4" aria-labelledby="reset-golf-data-title">
          <div>
            <h3 id="reset-golf-data-title" className="font-semibold">
              Reset golf data
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Removes sessions, shots, bag history, plans, achievements and authored social
              activity. Keeps your login, preferences, provider links and billing account.
            </p>
          </div>
          <form action={resetGolfDataAction} className="grid gap-3 sm:max-w-xl">
            <FormField
              id="reset-golf-data-confirmation"
              label="Type RESET to confirm"
              name="confirmation"
              autoComplete="off"
            />
            <ConfirmSubmitButton
              type="submit"
              variant="outline"
              className="w-full sm:w-fit"
              confirmTitle="Reset all golf data?"
              confirmMessage="This removes sessions, shots, bag history, plans, achievements and authored social activity after the typed confirmation is checked."
              confirmActionLabel="Reset golf data"
            >
              <Trash2 className="size-4" />
              Reset golf data
            </ConfirmSubmitButton>
          </form>
        </section>

        <Separator className="bg-destructive/20" />

        <section className="grid gap-4" aria-labelledby="delete-account-title">
          <div>
            <h3 id="delete-account-title" className="font-semibold text-destructive">
              Delete account permanently
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Revokes active sessions, removes application data and deletes the authentication
              identity. A recent sign-in is required.
            </p>
          </div>
          <form action={deleteAccountDataAction} className="grid gap-3 sm:max-w-xl">
            <FormField
              id="delete-account-confirmation"
              label={`Type ${profile.email ?? profile.id} to confirm`}
              name="confirmation"
              autoComplete="off"
            />
            <ConfirmSubmitButton
              type="submit"
              variant="destructive"
              className="w-full sm:w-fit"
              confirmTitle="Delete this account permanently?"
              confirmMessage="This revokes active sessions, removes application data and deletes the authentication identity after the typed confirmation is checked."
              confirmActionLabel="Delete account permanently"
            >
              <Trash2 className="size-4" />
              Delete account permanently
            </ConfirmSubmitButton>
          </form>
        </section>
      </div>
    </section>
  );
}

function DesktopSettingsDisclosure({
  companion,
  children,
}: {
  companion: boolean;
  children: ReactNode;
}) {
  if (!companion) return children;
  return (
    <details className="mobile-settings-desktop">
      <summary>Desktop preferences</summary>
      <div className="grid gap-6">{children}</div>
    </details>
  );
}

function SettingsGroup({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex min-w-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function SettingsToggleRow({
  label,
  detail,
  name,
  value,
  defaultChecked,
}: {
  label: string;
  detail: string;
  name: string;
  value?: string;
  defaultChecked?: boolean;
}) {
  const id = `setting-${name}-${value ?? "toggle"}`;
  return (
    <Label
      htmlFor={id}
      className="flex min-h-16 cursor-pointer items-center justify-between gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0 sm:px-5"
    >
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block font-normal leading-5 text-muted-foreground">{detail}</span>
      </span>
      <Switch
        id={id}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        aria-label={label}
      />
    </Label>
  );
}

function SettingsValueRow({
  label,
  detail,
  value,
}: {
  label: string;
  detail: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 text-sm sm:px-5">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="mt-0.5 leading-5 text-muted-foreground">{detail}</p>
      </div>
      <span className="shrink-0 font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function SettingsSelectRow<T extends string>({
  label,
  detail,
  name,
  defaultValue,
  values,
}: {
  label: string;
  detail: string;
  name: string;
  defaultValue: string;
  values: Record<T, string>;
}) {
  const id = `setting-${name}`;
  return (
    <div className="grid min-h-16 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center sm:px-5">
      <div className="min-w-0 text-sm">
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
        <p className="mt-0.5 leading-5 text-muted-foreground">{detail}</p>
      </div>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={id} className="w-full bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(values).map(([value, optionLabel]) => (
            <SelectItem key={value} value={value}>
              {optionLabel as string}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SettingsLinkRow({
  href,
  icon,
  label,
  detail,
  action,
  prefetch = true,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  detail: string;
  action: string;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className="focus-aaa flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/45 motion-reduce:transition-none sm:px-5"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium">{label}</span>
        <span className="mt-0.5 block leading-5 text-muted-foreground">{detail}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold text-primary">{action}</span>
    </Link>
  );
}

function AccessManagementTable({ rows }: { rows: SettingsAccessRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-8 text-center sm:px-5">
        <UserPlus className="mx-auto size-5 text-muted-foreground" aria-hidden />
        <p className="mt-2 text-sm font-medium">No shared access</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite someone when a coach, viewer or editor needs access.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="lg:hidden">
        <MobileGroupedList label="Account access" className="rounded-none border-0 shadow-none">
          {rows.map((row) => (
            <MobileListRow
              key={row.id}
              label={row.party}
              value={row.role}
              detail={`${row.scope} · ${row.status} · ${row.detail}`}
              trailing={row.action}
            />
          ))}
        </MobileGroupedList>
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <Table>
          <TableCaption className="sr-only">Collaborators and shared accounts.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Person or account</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="w-16 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.party}</TableCell>
                <TableCell>
                  {row.role} · {row.scope}
                </TableCell>
                <TableCell>
                  <StatusPill tone={row.status === "Pending" ? "amber" : "green"}>
                    {row.status}
                  </StatusPill>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.detail}</TableCell>
                <TableCell className="text-right">{row.action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
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
  const id = props.id ?? `settings-${name}`;
  return (
    <div className="grid gap-2 text-sm">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} className="h-10 bg-background" {...props} />
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex h-10 items-center rounded-lg border bg-muted/45 px-3 text-muted-foreground">
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
  const id = `settings-${name}`;
  return (
    <div className="grid gap-2 text-sm">
      <Label htmlFor={id}>{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={id} className="h-10 w-full bg-background">
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

async function SettingsSurfaceLayout({
  surface,
  children,
}: {
  surface: "companion" | "workbench";
  children: ReactNode;
}) {
  if (surface === "companion") {
    return <div className="min-w-0 mobile-settings-screen">{children}</div>;
  }

  const { DesktopWorkbenchLayout } = await import("@/components/app/desktop-workbench");
  return <DesktopWorkbenchLayout scope="settings">{children}</DesktopWorkbenchLayout>;
}

type SettingsProfile = Awaited<ReturnType<typeof getSettingsData>>["profile"];

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
  if (!profile) throw new Error("Current user profile was not created.");

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

function buildAccessRows({
  ownedInvitations,
  ownedMemberships,
  receivedMemberships,
  relatedUsersById,
}: Omit<Awaited<ReturnType<typeof getSettingsData>>, "profile">): SettingsAccessRow[] {
  return [
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
      const party = member?.email ?? member?.name ?? membership.memberUserId;
      return {
        id: `owned-${membership.id}`,
        scope: "Shared by me",
        party,
        role: titleCase(membership.role),
        status: "Accepted",
        detail: `Added ${formatDate(membership.createdAt)}`,
        action: (
          <SettingsAccessRowAction targetId={membership.id} targetType="membership" party={party} />
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
}

function parseSettingsSection(value: string | undefined): SettingsSection {
  return isSettingsSection(value) ? value : "general";
}

function settingsSection(value: SettingsSection) {
  return settingsSections.find((section) => section.value === value) ?? settingsSections[0];
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
