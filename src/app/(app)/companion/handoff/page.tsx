import Link from "next/link";
import { redirect } from "next/navigation";
import { AppSurfaceLink } from "@/components/app/app-surface-link";
import { findRouteMetadata } from "@/components/app/route-metadata";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { companionDestination, hasDirectCompanionRoute } from "@/lib/companion-destination";
import { appSurfaceHref } from "@/lib/app-surface-navigation";

export default async function CompanionHandoffPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const requestedPath = companionDestination((await searchParams).from);
  if (hasDirectCompanionRoute(requestedPath)) redirect(requestedPath);
  const route = findRouteMetadata(new URL(requestedPath, "https://companion.invalid").pathname);
  const alternatives = [
    {
      label: route?.mobileFallbackLabel ?? "Go to Today",
      href: route?.mobileFallbackRoute ?? "/today",
    },
    { label: "Review sessions", href: "/sessions" },
    { label: "Prepare for a round", href: "/play" },
    { label: "Open Quick Bag", href: "/quick-bag" },
  ];
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28" data-companion-desktop-handoff>
        <PageHeader
          title="Choose how to continue"
          description="This request does not yet have a complete companion task here. Open its full workspace or choose an available task below."
          actions={
            <Button asChild className="h-auto min-h-11 whitespace-normal">
              <AppSurfaceLink href={appSurfaceHref("workbench", requestedPath)}>
                Open Full Site
              </AppSurfaceLink>
            </Button>
          }
        />
        <section
          className="grid gap-3 rounded-xl border p-5"
          aria-labelledby="requested-task-title"
        >
          <h2 id="requested-task-title" className="text-lg font-semibold">
            {route?.pageTitle ?? "Requested workspace"}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Your selected destination and comparison filters are retained when switching. If the
            destination is no longer available, use one of the tasks below.
          </p>
          <details>
            <summary className="min-h-11 cursor-pointer py-3 text-sm">
              Requested destination
            </summary>
            <p className="break-all text-sm text-muted-foreground">{requestedPath}</p>
          </details>
        </section>
        <section aria-labelledby="alternatives-title" className="grid gap-3">
          <h2 id="alternatives-title" className="text-lg font-semibold">
            Available companion tasks
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {alternatives
              .filter(
                (item, index, all) =>
                  all.findIndex((candidate) => candidate.href === item.href) === index,
              )
              .map((item) => (
                <Button
                  key={item.href}
                  asChild
                  variant="outline"
                  className="h-auto min-h-12 justify-start whitespace-normal"
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
