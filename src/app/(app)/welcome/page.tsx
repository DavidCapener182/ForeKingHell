import Link from "next/link";
import { CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { dismissWelcomeAction } from "@/app/welcome/actions";
import { MobileAppShell, MobileStatusAction, MobileTopBar } from "@/components/mobile-sports";
import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { getActivationJourney } from "@/lib/activation-journey";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams?: Promise<{ resume?: string }>;
}) {
  const userId = await requireCurrentUserId();
  const [{ resume }, journey] = await Promise.all([
    searchParams ?? Promise.resolve<{ resume?: string }>({}),
    getActivationJourney(userId),
  ]);
  if (journey.established && resume !== "1") redirect("/today");
  const next = journey.steps.find((step) => !step.complete);

  return (
    <PageShell size="full" className="bg-background">
      <MobileWelcomeJourney journey={journey} next={next} />

      <main className="hidden gap-6 py-6 lg:grid">
        <header className="grid gap-3 rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Welcome to LM World Tour
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-normal sm:text-4xl">
            Get to the first insight you can trust.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            This is your real account setup—no demo data is added. Each step explains why it
            matters, and completion stays tied to the evidence already in your account.
          </p>
          {journey.firstTrustedResult ? (
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
              <Sparkles className="mt-0.5 size-4 text-primary" />
              <span>
                <strong>Your first usable signal is ready.</strong> {journey.firstTrustedResult}
              </span>
            </div>
          ) : null}
        </header>
        <ol className="grid gap-3" aria-label="First-use journey">
          {journey.steps.map((step, index) => (
            <li
              key={step.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-card p-4"
            >
              <span className={step.complete ? "text-primary" : "text-muted-foreground"}>
                {step.complete ? (
                  <CheckCircle2 className="size-5" aria-label="Complete" />
                ) : (
                  <CircleDashed className="size-5" aria-label="Not complete" />
                )}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Step {index + 1}
                </p>
                <h2 className="mt-1 font-semibold">{step.title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
              <Button asChild variant={step.complete ? "outline" : "default"} className="min-h-11">
                <Link href={step.href}>{step.complete ? "Review" : "Start"}</Link>
              </Button>
            </li>
          ))}
        </ol>
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            You can skip now and resume from Today whenever you are ready.
          </p>
          <div className="flex gap-2">
            <form action={dismissWelcomeAction}>
              <Button type="submit" variant="ghost" className="min-h-11">
                Skip for now
              </Button>
            </form>
            {next ? (
              <Button asChild className="min-h-11">
                <Link href={next.href}>Continue to {next.title}</Link>
              </Button>
            ) : (
              <Button asChild className="min-h-11">
                <Link href="/today">Open Today</Link>
              </Button>
            )}
          </div>
        </footer>
      </main>
    </PageShell>
  );
}

type ActivationJourney = Awaited<ReturnType<typeof getActivationJourney>>;

function MobileWelcomeJourney({
  journey,
  next,
}: {
  journey: ActivationJourney;
  next: ActivationJourney["steps"][number] | undefined;
}) {
  const completedSteps = journey.steps.filter((step) => step.complete).length;

  return (
    <MobileAppShell>
      <MobileTopBar title="Welcome" />
      <div className="max-[359px]:[&_.premium-command-surface]:grid-cols-1 max-[359px]:[&_.premium-command-surface]:items-start max-[359px]:[&_[data-primary-action]]:w-full max-[359px]:[&_[data-primary-action]_a]:w-full">
        <MobileStatusAction
          label="Account setup"
          value={`${completedSteps}/${journey.steps.length} complete`}
          detail={next ? `Next: ${next.title}` : "Your setup checklist is complete"}
          action={
            <Button asChild className="min-h-11">
              <Link href={next?.href ?? "/today"}>{next ? "Continue" : "Open Today"}</Link>
            </Button>
          }
        />
      </div>

      {journey.firstTrustedResult ? (
        <IOSGroupedList label="First trusted result">
          <IOSListRow
            label="Your first usable signal is ready"
            detail={journey.firstTrustedResult}
            status={<IOSInlineStatus label="Real account data" tone="positive" />}
            icon={Sparkles}
          />
        </IOSGroupedList>
      ) : null}

      <section className="grid gap-2" aria-label="First-use journey">
        <IOSSectionHeader
          title="Setup checklist"
          description="Each step reflects the evidence already stored in your account"
        />
        <IOSGroupedList label="First-use setup steps">
          {journey.steps.map((step, index) => (
            <IOSListRow
              key={step.id}
              label={`${index + 1}. ${step.title}`}
              detail={step.description}
              value={step.complete ? "Review" : "Start"}
              href={step.href}
              leading={
                <span
                  className={
                    step.complete
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-muted-foreground"
                  }
                >
                  {step.complete ? (
                    <CheckCircle2 className="size-5" aria-hidden />
                  ) : (
                    <CircleDashed className="size-5" aria-hidden />
                  )}
                </span>
              }
              status={
                <IOSInlineStatus
                  label={step.complete ? "Complete" : "Not complete"}
                  tone={step.complete ? "positive" : "neutral"}
                />
              }
            />
          ))}
        </IOSGroupedList>
      </section>

      <IOSGroupedList label="Welcome options">
        <IOSListRow
          label="Skip for now"
          detail="Resume setup from Today whenever you are ready."
          trailing={
            <form action={dismissWelcomeAction}>
              <Button type="submit" variant="outline" className="min-h-11">
                Skip
              </Button>
            </form>
          }
        />
      </IOSGroupedList>
    </MobileAppShell>
  );
}
