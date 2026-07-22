import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";

const promises = [
  {
    icon: Upload,
    title: "Import measured sessions",
    detail: "Bring in launch-monitor data and keep the original evidence traceable.",
  },
  {
    icon: BarChart3,
    title: "Trust the numbers",
    detail: "See sample size, freshness and confidence beside the conclusions that matter.",
  },
  {
    icon: CheckCircle2,
    title: "Know what to practise",
    detail: "Turn the clearest weakness into one measured next action and review the result.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-8">
        <Link href="/" className="font-display text-xl font-semibold">
          {BRAND_NAME}
        </Link>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <section className="grid min-h-[calc(100dvh-5rem)] items-center gap-10 px-4 py-14 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)] lg:px-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Public beta · post-session golf improvement
          </p>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
            Trust your club numbers. Know what to practise next.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Import launch-monitor data, establish a reliable personal baseline and turn each session
            into one evidence-backed improvement action.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="premium-action min-h-12 rounded-xl px-6">
              <Link href="/login?mode=join">
                Start the beta
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-12 rounded-xl px-6">
              <Link href="/privacy">
                <ShieldCheck className="size-4" aria-hidden />
                How your data is handled
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3" aria-label="How the product helps">
          {promises.map(({ icon: Icon, title, detail }, index) => (
            <article key={title} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
