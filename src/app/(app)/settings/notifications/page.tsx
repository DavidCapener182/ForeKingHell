import Link from "next/link";
import { SettingsDirtyForm } from "@/app/settings/settings-dirty-form";
import { saveNotificationPreferencesFormAction } from "@/app/settings/notifications/actions";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  getProductPreferences,
  type NotificationCategory,
  type NotificationDelivery,
} from "@/lib/product-preferences";
export const dynamic = "force-dynamic";
const options = [
  {
    key: "weeklyReview",
    title: "Weekly game review",
    detail: "Show the latest evidence-backed weekly recap.",
  },
  {
    key: "dataQuality",
    title: "Data quality",
    detail: "Show imports, duplicate warnings and repair actions.",
  },
  {
    key: "achievements",
    title: "Achievements",
    detail: "Show newly proven milestones and personal bests.",
  },
  { key: "challenges", title: "Challenges", detail: "Show invitations and competition activity." },
  { key: "social", title: "Friends", detail: "Show friend requests and private social activity." },
] as const;

const deliveryOptions: Array<{ key: NotificationCategory; title: string; detail: string }> = [
  {
    key: "dataQuality",
    title: "Data needs attention",
    detail: "Mapping, duplicates, stale numbers and failed sync evidence.",
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

const deliveryLabels: Record<NotificationDelivery, string> = {
  in_app: "In-app",
  digest: "Email digest",
  immediate: "Email now",
  weekly: "Weekly email",
  off: "Off",
};

export default async function NotificationSettingsPage() {
  const preferences = (await getProductPreferences(await requireCurrentUserId())).notifications;
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28">
        <PageHeader
          title="Notifications"
          description="Choose delivery preferences separately from the categories shown in your in-app notification centre."
          actions={
            <Button asChild variant="outline">
              <Link href="/settings?section=notifications" prefetch={false}>
                Back to Settings
              </Link>
            </Button>
          }
        />
        <p className="rounded-xl border p-4 text-sm">
          These are the same saved preferences used in Settings. Email selections record a delivery
          preference; saving this form does not send an email or enable push notifications.
        </p>
        <SettingsDirtyForm action={saveNotificationPreferencesFormAction} className="grid gap-5">
          <fieldset className="grid gap-3">
            <legend className="mb-3 text-lg font-semibold">Delivery by category</legend>
            {deliveryOptions.map((option) => (
              <div
                key={option.key}
                className="grid min-w-0 gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center"
              >
                <div>
                  <label htmlFor={`delivery-${option.key}`} className="font-medium">
                    {option.title}
                  </label>
                  <p className="mt-1 text-sm text-muted-foreground">{option.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saved: {deliveryLabels[preferences.delivery[option.key]]}
                  </p>
                </div>
                <select
                  id={`delivery-${option.key}`}
                  name={option.key}
                  defaultValue={preferences.delivery[option.key]}
                  className="min-h-11 w-full rounded-lg border bg-background px-3"
                >
                  {Object.entries(deliveryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </fieldset>
          <fieldset className="grid gap-3">
            <legend className="mb-3 text-lg font-semibold">In-app notification categories</legend>
            {options.map((option) => (
              <label
                key={option.key}
                htmlFor={`legacy-${option.key}`}
                className="flex min-h-16 items-center justify-between gap-4 rounded-xl border p-4"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{option.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{option.detail}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Saved: {preferences[option.key] ? "On" : "Off"}
                  </span>
                </span>
                <Switch
                  id={`legacy-${option.key}`}
                  name={`legacy_${option.key}`}
                  defaultChecked={preferences[option.key]}
                  aria-label={option.title}
                />
              </label>
            ))}
          </fieldset>
        </SettingsDirtyForm>
      </div>
    </PageShell>
  );
}
