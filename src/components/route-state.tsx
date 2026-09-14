import Link from "next/link";
import { AlertTriangle, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DelayedGolfLoader } from "@/components/visuals/delayed-golf-loader";
import { BRAND_NAME } from "@/lib/brand";

export function RouteLoadingState({ label = `Loading ${BRAND_NAME}` }: { label?: string }) {
  return (
    <main
      id="main-content"
      className="min-h-[40dvh] px-4 py-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-8"
    >
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
    <main
      id="main-content"
      className="grid min-h-[70dvh] place-items-center px-4 py-10 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:min-h-screen lg:pb-10"
    >
      <section className="premium-card ios-grouped-list w-full max-w-xl overflow-hidden text-center lg:p-6">
        <div className="px-5 py-6">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-6" />
          </div>
          <h1 className="mt-4 text-[2rem] font-bold leading-tight tracking-[-0.025em] lg:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="grid border-t border-border sm:grid-cols-2 lg:mt-5 lg:flex lg:justify-center lg:gap-2 lg:border-0">
          {onRetry ? (
            <Button onClick={onRetry} className="min-h-12 rounded-none lg:rounded-md">
              Try again
            </Button>
          ) : null}
          <Button asChild variant="ghost" className="min-h-12 rounded-none lg:rounded-md">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export function RouteNotFoundState({ authenticated = false }: { authenticated?: boolean }) {
  return (
    <main
      id="main-content"
      className="grid min-h-[70dvh] place-items-center px-4 py-10 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:min-h-screen lg:pb-10"
    >
      <Card className="w-full max-w-xl text-center" data-route-not-found-state>
        <CardHeader className="items-center gap-2 px-5 py-6">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <SearchX className="size-6" />
          </div>
          <CardTitle>
            <h1 className="mt-2 text-[2rem] font-bold leading-tight tracking-[-0.025em] lg:text-3xl">
              Page not found
            </h1>
          </CardTitle>
          <CardDescription className="text-[15px] leading-6">
            That page is missing or the link has changed. Let’s get you back to {BRAND_NAME}.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-wrap justify-center gap-3">
          <Button asChild className="min-h-12 w-full sm:w-auto">
            <Link href={authenticated ? "/dashboard" : "/"}>
              {authenticated ? "Open dashboard" : "Back to home"}
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-12 w-full sm:w-auto">
            <Link href={authenticated ? "/sessions" : "/login"}>
              {authenticated ? "Open golf history" : "Sign in"}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
