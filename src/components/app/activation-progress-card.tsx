import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ActivationJourney } from "@/lib/activation-journey";

export function ActivationProgressCard({ journey }: { journey: ActivationJourney }) {
  if (!journey.available || journey.established || journey.dismissed) return null;
  const next = journey.steps.find((step) => !step.complete);
  if (!next) return null;
  const progress = Math.round((journey.completedCount / journey.steps.length) * 100);

  return (
    <section
      className="relative mx-auto w-full max-w-none overflow-hidden rounded-2xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5"
      aria-labelledby="activation-progress-title"
      data-activation-progress
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/8 to-transparent"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
              Your starting line
            </p>
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-semibold text-primary">
              {journey.completedCount} of {journey.steps.length} complete
            </span>
          </div>
          <h2 id="activation-progress-title" className="mt-2 text-xl font-semibold tracking-normal">
            Build a golf baseline you can trust.
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Each step is checked against your real account data. Complete the next one and the app
            can give you a more useful decision.
          </p>
        </div>
        <div className="w-full max-w-xs rounded-xl border border-border/80 bg-background/75 p-3 sm:w-52">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">Journey progress</span>
            <span className="text-lg font-semibold tabular-nums text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="mt-2 h-2" aria-label={`${progress}% complete`} />
        </div>
      </div>
      <ol
        className="relative mt-4 overflow-hidden rounded-xl border border-border/80 bg-background/60"
        aria-label="First-use journey"
      >
        {journey.steps.map((step, index) => (
          <li key={step.id} className="border-b border-border/80 last:border-b-0">
            <Link
              href={step.href}
              className="group grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 transition-colors hover:bg-primary/5 sm:px-4"
            >
              <span
                className={
                  step.complete
                    ? "grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"
                    : "grid size-8 place-items-center rounded-full border border-border bg-muted/50 text-xs font-semibold text-muted-foreground"
                }
              >
                {step.complete ? (
                  <CheckCircle2 className="size-4" aria-label="Complete" />
                ) : (
                  <span aria-hidden="true">{index + 1}</span>
                )}
              </span>
              <span className="min-w-0">
                <strong className="block text-sm font-semibold text-foreground">
                  {step.title}
                </strong>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {step.description}
                </span>
              </span>
              {step.complete ? (
                <span className="hidden items-center gap-1 text-xs font-semibold text-primary sm:flex">
                  Complete <CheckCircle2 className="size-3.5" aria-hidden="true" />
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                  {step.id === next.id ? "Start" : "View"}
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
        <p className="flex min-w-0 items-start gap-2 text-sm leading-5 text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Next up: <strong className="font-semibold text-foreground">{next.title}</strong>
          </span>
        </p>
        <Button asChild className="min-h-10">
          <Link href="/welcome?resume=1">
            Continue setup <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
