import Link from "next/link";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import type { ActivationJourney } from "@/lib/activation-journey";
import { WelcomeSkip } from "@/app/welcome/welcome-skip";
export function WelcomeJourney({ journey }: { journey: ActivationJourney }) {
  const next = journey.steps.find((step) => !step.complete);
  const count = journey.steps.filter((step) => step.complete).length;
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28">
        <PageHeader
          title={
            journey.available
              ? next
                ? next.title
                : "Your setup evidence is ready"
              : "Setup progress is unavailable"
          }
          description="Continue from the evidence saved in your account. Opening a step does not mark it complete."
        />
        {journey.dismissed ? (
          <p className="text-sm">
            You previously skipped setup. Your existing golf data remains available and this
            checklist can be resumed.
          </p>
        ) : null}
        {!journey.available ? (
          <div role="alert" className="grid gap-3 rounded-xl border p-4">
            <p>We could not read setup progress. No completed steps are inferred.</p>
            <Button asChild variant="outline">
              <Link href="/welcome?resume=1">Try loading setup again</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 rounded-xl border p-4">
              <p className="font-semibold">
                {count} of {journey.steps.length} evidence steps ready
              </p>
              <progress
                className="h-2 w-full"
                max={Math.max(journey.steps.length, 1)}
                value={count}
                aria-label="Setup evidence progress"
              />
              <Button asChild>
                <Link href={next?.href ?? "/today"}>
                  {next ? `Continue: ${next.title}` : "Open Today"}
                </Link>
              </Button>
            </div>
            {journey.firstTrustedResult ? (
              <section className="rounded-xl border p-4" aria-label="Available evidence">
                <h2 className="font-semibold">Evidence available to inspect</h2>
                <p className="mt-2 text-sm">
                  {journey.firstTrustedResult.replace(
                    "usable measured shots",
                    "shots passing the current onboarding filters",
                  )}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Review club-level confidence before using a number for a course decision.
                </p>
              </section>
            ) : null}
            <ol aria-label="Setup checklist" className="grid gap-3">
              {journey.steps.map((step, index) => (
                <li
                  key={step.id}
                  aria-current={step.id === next?.id ? "step" : undefined}
                  className="grid min-w-0 gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Step {index + 1} of {journey.steps.length} ·{" "}
                      {step.complete
                        ? "Evidence ready"
                        : step.id === next?.id
                          ? "Current task"
                          : "Pending"}
                    </p>
                    <h2 className="mt-1 font-semibold">{step.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                    {step.id === "review" ? (
                      <p className="mt-2 text-sm">
                        Ready means an imported session exists; it does not mean you have opened or
                        completed the review.
                      </p>
                    ) : null}
                  </div>
                  <Button asChild variant="outline" className="self-center">
                    <Link href={step.href}>{step.complete ? "Review evidence" : "Open task"}</Link>
                  </Button>
                </li>
              ))}
            </ol>
          </>
        )}
        <footer className="grid gap-3 rounded-xl border border-dashed p-4">
          <p className="text-sm">
            Setup is optional. Skipping does not delete data or disable golf features. Resume at
            /welcome?resume=1.
          </p>
          <WelcomeSkip />
        </footer>
      </div>
    </PageShell>
  );
}
