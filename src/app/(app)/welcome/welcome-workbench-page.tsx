import Link from "next/link";
import { CheckCircle2, CircleDashed, Sparkles } from "lucide-react";

import { dismissWelcomeAction } from "@/app/welcome/actions";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import type { ActivationJourney } from "@/lib/activation-journey";

export default function WelcomeWorkbenchPage({ journey }: { journey: ActivationJourney }) {
  const next = journey.steps.find((step) => !step.complete);

  return (
    <PageShell size="full" className="bg-background" data-welcome-workbench>
      <main className="grid gap-6 py-6">
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
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
            >
              <span className={step.complete ? "text-primary" : "text-muted-foreground"}>
                {step.complete ? (
                  <CheckCircle2 className="size-5" aria-label="Complete" />
                ) : (
                  <CircleDashed className="size-5" aria-label="Not complete" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Step {index + 1}
                </p>
                <h2 className="mt-1 font-semibold">{step.title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
              <Button
                asChild
                variant={step.complete ? "outline" : "default"}
                className="col-span-2 min-h-11 w-full sm:col-span-1 sm:w-auto"
              >
                <Link href={step.href}>{step.complete ? "Review" : "Start"}</Link>
              </Button>
            </li>
          ))}
        </ol>

        <footer className="flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            You can skip now and resume from Today whenever you are ready.
          </p>
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <form action={dismissWelcomeAction}>
              <Button type="submit" variant="ghost" className="min-h-11 w-full">
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
