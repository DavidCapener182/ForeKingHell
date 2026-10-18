import Link from "next/link";
import { CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LockedDataChatPanel() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <div>
          <h1 id="data-chat-heading" className="text-xl font-semibold tracking-tight">
            Data Chat
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden />
            Pro access required
          </p>
        </div>
      </header>
      <div className="grid place-items-center px-5 py-8 sm:py-12">
        <div className="max-w-md text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">
            Analyse your game in conversation
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Data Chat uses your saved shots, rounds, bag and practice records to answer with cited
            evidence and a clear next action.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/billing" prefetch={false}>
              <CreditCard className="size-4" />
              View plans
            </Link>
          </Button>
          <nav
            aria-label="Explore your saved golf evidence"
            className="mt-4 flex flex-wrap justify-center gap-4"
          >
            <Link
              href="/progress"
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
            >
              Review Progress
            </Link>
            <Link
              href="/practice"
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
            >
              Build practice
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
