"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type DashboardCommandRoute = {
  title: string;
  description: string;
  href: string;
  metric: string;
};

export function DashboardCommandPalette({ routes }: { routes: DashboardCommandRoute[] }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const filteredRoutes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return routes.slice(0, 8);
    }

    return routes
      .filter((route) =>
        [route.title, route.description, route.metric, route.href]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 8);
  }, [query, routes]);
  const suggestedQueries = ["driver", "import", "latest round", "friends", "7 iron", "course record"];

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div className="rounded-lg border border-[#DFE7DF] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <label className="grid gap-2 text-sm font-medium">
        <span className="sr-only">Search tools</span>
        <span className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border bg-[#F8FAF8] px-3">
          <Search className="size-4 text-[#667085]" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search driver, import, latest round, friends..."
            className="min-w-0 bg-transparent text-sm outline-none placeholder:text-[#667085]"
          />
        </span>
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {suggestedQueries.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setQuery(suggestion)}
            className="min-h-8 shrink-0 rounded-full border border-[#DFE7DF] bg-[#FBFDFB] px-3 text-xs font-semibold text-[#475467] transition-colors hover:border-[#0B7A3B] hover:text-[#087A3D]"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        {filteredRoutes.length > 0 ? (
          filteredRoutes.map((route, index) => (
            <Link
              key={`${route.title}-${route.href}`}
              href={route.href}
              prefetch={false}
              className="group grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 transition-colors hover:border-[#0B7A3B]"
            >
              <span className="grid size-7 place-items-center rounded-full bg-[#F5F6F4] text-xs font-semibold text-[#667085]">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{route.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {route.description}
                </span>
              </span>
              <span className="flex items-center gap-2 self-center text-xs font-medium text-muted-foreground">
                <span className="hidden max-w-24 truncate sm:inline">{route.metric}</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-[#087A3D]" />
              </span>
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            No matching tools.
          </p>
        )}
      </div>
    </div>
  );
}
