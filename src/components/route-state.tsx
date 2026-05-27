import Link from "next/link";
import { AlertTriangle, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DelayedGolfLoader } from "@/components/visuals/delayed-golf-loader";
import { BRAND_NAME } from "@/lib/brand";

export function RouteLoadingState({ label = `Loading ${BRAND_NAME}` }: { label?: string }) {
  return (
    <main id="main-content" className="min-h-[40vh] px-4 py-5 pb-24 sm:px-6 lg:px-8">
      <div className="grid w-full place-items-center pt-10 sm:pt-16">
        <DelayedGolfLoader label={label} delayMs={2500} />
      </div>
    </main>
  );
}

export function RouteErrorState({
  title = "Something went wrong",
  description = "The page could not be rendered. Try again, or return to the dashboard.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center px-4 py-10">
      <section className="premium-card max-w-xl p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
          <Button asChild variant="outline">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export function RouteNotFoundState() {
  return (
    <main id="main-content" className="grid min-h-screen place-items-center px-4 py-10">
      <section className="premium-card max-w-xl p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-100">
          <SearchX className="size-6" />
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          That route does not match an {BRAND_NAME} screen.
        </p>
        <Button asChild className="mt-5">
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </section>
    </main>
  );
}
