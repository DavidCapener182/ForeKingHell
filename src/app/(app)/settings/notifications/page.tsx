import Link from "next/link";
import { ArrowLeft, BellRing, CheckCircle2, ShieldCheck } from "lucide-react";

import { saveNotificationPreferencesAction } from "@/app/settings/notifications/actions";
import { IOSDisclosureGroup } from "@/components/app/ios-mobile";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  immediate: "Email now",
  weekly: "Weekly email",
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
          <span className="hidden lg:inline-flex">
            <Button asChild variant="outline" className="min-h-11 rounded-xl">
              <Link href="/settings">
                <ArrowLeft className="size-4" aria-hidden />
                Settings
              </Link>
            </Button>
          </span>
        }
      />
      {params?.saved === "1" ? (
        <Alert role="status">
          <CheckCircle2 className="size-5" aria-hidden />
          <AlertDescription>Notification preferences saved.</AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="border-0 bg-transparent shadow-none lg:rounded-3xl lg:border lg:border-border lg:bg-card lg:shadow-sm">
          <CardHeader className="hidden lg:flex">
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-5 text-primary" aria-hidden />
              In-app notification centre
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-20 lg:px-6 lg:pb-6">
            <form action={saveNotificationPreferencesAction} className="grid gap-5 lg:gap-3">
              <fieldset className="ios-grouped-list grid overflow-hidden lg:gap-3 lg:overflow-visible lg:bg-transparent">
                <legend className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.035em] text-muted-foreground lg:mb-1 lg:px-0 lg:text-base lg:normal-case lg:tracking-normal lg:text-foreground">
                  Delivery by category
                </legend>
                {deliveryOptions.map((option) => (
                  <label
                    key={option.key}
                    htmlFor={`delivery-${option.key}`}
                    className="ios-grouped-row grid min-h-16 cursor-pointer grid-cols-[minmax(0,1fr)_8.75rem] items-center gap-3 px-4 py-2.5 lg:min-h-20 lg:rounded-2xl lg:border lg:border-border/70 lg:bg-secondary/45 lg:grid-cols-[minmax(0,1fr)_12rem] lg:py-3"
                  >
                    <span>
                      <span className="block text-[15px] font-medium leading-5 lg:font-semibold">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-[1.15rem] text-muted-foreground lg:text-sm lg:leading-5">
                        {option.detail}
                      </span>
                    </span>
                    <Select name={option.key} defaultValue={preferences.delivery[option.key]}>
                      <SelectTrigger
                        id={`delivery-${option.key}`}
                        className="min-h-11 w-full bg-background text-sm font-medium lg:font-semibold"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(deliveryLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                ))}
              </fieldset>

              <fieldset className="ios-grouped-list grid overflow-hidden lg:mt-4 lg:gap-3 lg:overflow-visible lg:border-t lg:border-border lg:bg-transparent lg:pt-4">
                <legend className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.035em] text-muted-foreground lg:mb-0 lg:text-base lg:normal-case lg:tracking-normal lg:text-foreground">
                  In-app feed compatibility
                </legend>
                {options.map((option) => (
                  <label
                    key={option.key}
                    htmlFor={`legacy-${option.key}`}
                    className="ios-grouped-row flex min-h-16 cursor-pointer touch-manipulation items-center justify-between gap-4 px-4 py-2.5 lg:rounded-2xl lg:border lg:border-border/70 lg:bg-secondary/45 lg:py-3"
                  >
                    <span>
                      <span className="block text-[15px] font-medium leading-5 lg:font-semibold">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-[1.15rem] text-muted-foreground lg:text-sm lg:leading-5">
                        {option.detail}
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
              <Button
                type="submit"
                className="premium-action sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-1 min-h-12 rounded-xl shadow-lg lg:static lg:mt-2 lg:min-h-11 lg:shadow-none"
              >
                Save preferences
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="lg:hidden">
          <IOSDisclosureGroup
            label="Notification guidance"
            items={[
              {
                value: "quiet-by-choice",
                title: "Quiet by choice",
                summary: "About",
                description: "What can be turned off and what remains essential",
                content: (
                  <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
                    <p>
                      Turning a category off removes it from the in-app feed. Essential account and
                      security messages are never hidden by these controls.
                    </p>
                    <p>
                      Security and billing can stay immediate while social and progress updates
                      remain in-app or weekly.
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </div>
        <aside className="hidden rounded-3xl border border-border bg-card p-5 lg:block">
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
