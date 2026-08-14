import Link from "next/link";
import { CheckCircle2, CircleDashed, Sparkles } from "lucide-react";

import { dismissWelcomeAction } from "@/app/welcome/actions";
import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileStatusAction, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import type { ActivationJourney } from "@/lib/activation-journey";

export default function WelcomeCompanionPage({ journey }: { journey: ActivationJourney }) {
  const next = journey.steps.find((step) => !step.complete);
  const completedSteps = journey.steps.filter((step) => step.complete).length;

  return (
    <PageShell size="full" className="bg-background" data-welcome-companion>
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
                        ? "text-[var(--status-success-foreground)]"
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
    </PageShell>
  );
}
