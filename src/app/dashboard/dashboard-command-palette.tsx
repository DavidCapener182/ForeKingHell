"use client";

import { Command, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openGlobalCommandCentre } from "@/components/app/global-command-centre";

export type DashboardCommandRoute = {
  title: string;
  description: string;
  href: string;
  metric: string;
};

/**
 * Dashboard keeps a compact launcher, while the searchable command centre is
 * owned by the authenticated app shell and available from every route.
 */
export function DashboardCommandPalette({ routes }: { routes: DashboardCommandRoute[] }) {
  const suggestedCount = Math.min(routes.length, 8);
  return (
    <section
      className="premium-command-surface grid gap-3 rounded-lg p-3"
      aria-labelledby="dashboard-command-title"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Command className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="dashboard-command-title" className="font-semibold">
            Global command centre
          </h2>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            Search every available route and start an action from anywhere in the app.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-12 justify-between"
        onClick={openGlobalCommandCentre}
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" /> Search driver, yardages, practice load or course plan
        </span>
        <span className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground sm:inline">
          ⌘K
        </span>
      </Button>
      <p className="text-xs text-muted-foreground">
        {suggestedCount} contextual destinations are available from this dashboard; the command
        centre also honours route access and admin visibility.
      </p>
    </section>
  );
}
