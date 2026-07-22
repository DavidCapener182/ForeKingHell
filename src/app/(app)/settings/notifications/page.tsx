import Link from "next/link";
import { ArrowLeft, BellRing, CheckCircle2, ShieldCheck } from "lucide-react";

import { saveNotificationPreferencesAction } from "@/app/settings/notifications/actions";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { requireCurrentUserId } from "@/lib/current-user";
import { getProductPreferences } from "@/lib/product-preferences";
import type { NotificationCategory, NotificationDelivery } from "@/lib/product-preferences";

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
  immediate: "Immediate email",
  weekly: "Weekly only",
  off: "Off",
};

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const userId = await requireCurrentUserId();
  const preferences = (await getProductPreferences(userId)).notifications;

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Preferences</StatusPill>}
        title="Notifications"
        description="Choose which evidence and activity appears in your in-app notification centre."
        actions={
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href="/settings">
              <ArrowLeft className="size-4" aria-hidden />
              Settings
            </Link>
          </Button>
        }
      />
      {params?.saved === "1" ? (
        <div
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950"
          role="status"
        >
          <CheckCircle2 className="size-5" aria-hidden />
          Notification preferences saved.
        </div>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-5 text-primary" aria-hidden />
              In-app notification centre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveNotificationPreferencesAction} className="grid gap-3">
              <fieldset className="grid gap-3">
                <legend className="mb-1 font-semibold">Delivery by category</legend>
                {deliveryOptions.map((option) => (
                  <label
                    key={option.key}
                    htmlFor={option.key}
                    className="grid min-h-20 gap-3 rounded-2xl border border-border/70 bg-secondary/45 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center"
                  >
                    <span>
                      <span className="block font-semibold">{option.title}</span>
                      <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                        {option.detail}
                      </span>
                    </span>
                    <select
                      id={option.key}
                      name={option.key}
                      defaultValue={preferences.delivery[option.key]}
                      className="min-h-11 rounded-xl border bg-background px-3 text-sm font-semibold"
                    >
                      {Object.entries(deliveryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </fieldset>

              <fieldset className="mt-4 grid gap-3 border-t border-border pt-4">
                <legend className="px-1 font-semibold">In-app feed compatibility</legend>
                {options.map((option) => (
                  <label
                    key={option.key}
                    htmlFor={option.key}
                    className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border/70 bg-secondary/45 px-4 py-3"
                  >
                    <span>
                      <span className="block font-semibold">{option.title}</span>
                      <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                        {option.detail}
                      </span>
                    </span>
                    <Switch
                      id={option.key}
                      name={`legacy_${option.key}`}
                      defaultChecked={preferences[option.key]}
                      aria-label={option.title}
                    />
                  </label>
                ))}
              </fieldset>
              <Button type="submit" className="premium-action mt-2 min-h-11 rounded-xl">
                Save preferences
              </Button>
            </form>
          </CardContent>
        </Card>
        <aside className="rounded-3xl border border-border bg-card p-5">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          <h2 className="mt-4 font-display text-xl font-semibold">Quiet by choice</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Turning a category off removes it from the in-app feed. Essential account and security
            messages are never hidden by these controls.
          </p>
          <p className="mt-4 rounded-2xl bg-secondary/55 p-3 text-sm leading-5 text-muted-foreground">
            Email modes are saved as delivery instructions. Security and billing can stay immediate
            while social and progress updates remain in-app or weekly.
          </p>
        </aside>
      </section>
    </PageShell>
  );
}
