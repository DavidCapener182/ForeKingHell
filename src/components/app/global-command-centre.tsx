"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from "react";
import { ArrowRight, Command, Search, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { routesAvailableTo, type AppRouteMetadata } from "@/components/app/route-metadata";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type CommandItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  group: "Navigation" | "Quick actions" | "Suggested";
  aliases: string[];
  icon: AppRouteMetadata["icon"];
};

const recentStorageKey = "lmwt:command-centre:recent";

export function GlobalCommandCentre({
  isAdmin,
  enableKeyboardShortcut = true,
}: {
  isAdmin: boolean;
  enableKeyboardShortcut?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(readRecent);

  const allItems = useMemo(() => buildCommandItems(isAdmin), [isAdmin]);
  const visibleItems = useMemo(
    () => filterCommandItems(allItems, query, recentIds),
    [allItems, query, recentIds],
  );
  const safeActiveIndex = visibleItems.length ? Math.min(activeIndex, visibleItems.length - 1) : 0;

  const openPalette = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }, []);

  const selectItem = useCallback(
    (item: CommandItem) => {
      rememberRecent(item.id, setRecentIds);
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  useEffect(() => {
    const openFromShell = () => openPalette();
    window.addEventListener("fkh:open-command-centre", openFromShell);
    return () => window.removeEventListener("fkh:open-command-centre", openFromShell);
  }, [openPalette]);

  useEffect(() => {
    if (!enableKeyboardShortcut) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      const usesCommand = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const usesSlash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!usesCommand && !usesSlash) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openPalette();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enableKeyboardShortcut, openPalette]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!visibleItems.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleItems.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + visibleItems.length) % visibleItems.length);
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(visibleItems.length - 1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = visibleItems[safeActiveIndex];
      if (item) selectItem(item);
    }
  }

  const grouped = groupItems(visibleItems);
  const currentRoute = allItems.find((item) => item.href === pathname);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-h-[calc(100dvh-1.5rem)] w-[min(46rem,calc(100%-1rem))] gap-3 overflow-hidden p-0 sm:max-w-[46rem]"
        showCloseButton
      >
        <DialogHeader className="border-b px-4 pb-3 pt-4 pr-12 sm:px-5 sm:pr-14">
          <DialogTitle className="flex items-center gap-2">
            <Command className="size-4 text-primary" /> Command centre
          </DialogTitle>
          <DialogDescription>Search every route and start a useful golf action.</DialogDescription>
        </DialogHeader>
        <div className="px-4 sm:px-5">
          <label className="flex min-h-12 items-center gap-2 rounded-lg border border-input bg-muted/35 px-3">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">Search LM World Tour</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              aria-controls={resultId}
              aria-activedescendant={
                visibleItems[safeActiveIndex]
                  ? `global-command-option-${visibleItems[safeActiveIndex].id}`
                  : undefined
              }
              placeholder="Search driver, yardages, practice load or course plan"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">
              ESC
            </kbd>
          </label>
        </div>
        <div
          id={resultId}
          role="listbox"
          aria-label="Command centre results"
          className="min-h-0 overflow-y-auto px-2 pb-3 sm:px-3"
        >
          <p className="px-2 pb-1 pt-1 text-xs text-muted-foreground" aria-live="polite">
            {visibleItems.length} {visibleItems.length === 1 ? "result" : "results"}
            {currentRoute && !query ? ` · You are in ${currentRoute.label}` : ""}
          </p>
          {grouped.map(([group, items]) => (
            <section key={group} aria-label={group} className="mb-2">
              <h3 className="px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {group}
              </h3>
              <div className="grid gap-1">
                {items.map((item) => {
                  const index = visibleItems.findIndex((candidate) => candidate.id === item.id);
                  const Icon = item.icon;
                  const active = index === safeActiveIndex;
                  return (
                    <button
                      id={`global-command-option-${item.id}`}
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={() => selectItem(item)}
                      className={cn(
                        "grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 text-left transition-colors",
                        active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {" "}
                      <span
                        className={cn(
                          "grid size-8 place-items-center rounded-md",
                          active ? "bg-white/14" : "bg-primary/10 text-primary",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{item.label}</span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            active ? "text-primary-foreground/75" : "text-muted-foreground",
                          )}
                        >
                          {item.detail}
                        </span>
                      </span>
                      <ArrowRight className="size-4" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function openGlobalCommandCentre() {
  window.dispatchEvent(new Event("fkh:open-command-centre"));
}

function buildCommandItems(isAdmin: boolean): CommandItem[] {
  const navigation = routesAvailableTo(isAdmin).map((route) => ({
    id: `route-${route.id}`,
    label: route.pageTitle,
    detail: `${route.navigationGroup} · ${route.route}`,
    href: route.route,
    group: "Navigation" as const,
    aliases: [route.shortTitle, route.route, ...route.searchAliases],
    icon: route.icon,
  }));
  const quickActions: CommandItem[] = [
    action("import", "Import data", "Upload a CSV or connect an available provider", "/import", [
      "csv",
      "rapsodo",
      "upload",
    ]),
    action(
      "latest-session",
      "Open latest session",
      "Review the latest measured evidence",
      "/sessions",
      ["latest", "range", "review"],
    ),
    action(
      "practice",
      "Start Practice Planner",
      "Build an evidence-backed practice session",
      "/practice",
      ["practice plan", "drill", "range"],
    ),
    action(
      "quick-range",
      "Open Quick Range",
      "Start a focused range session",
      "/practice/quick-range",
      ["quick practice", "range"],
    ),
    action("round", "Log or review a round", "Open scorecards and round review", "/rounds", [
      "scorecard",
      "round",
    ]),
    action(
      "data-chat",
      "Ask Data Chat",
      "Ask a read-only question from your records",
      "/data-chat",
      ["ai", "question", "improve"],
    ),
    action(
      "strategy",
      "Open Course Strategy",
      "Plan a safe target using your bag",
      "/courses/strategy",
      ["course plan", "safe target"],
    ),
    action("goals", "Open current goals", "Review your season and practice goals", "/goals", [
      "goals",
      "plan",
    ]),
  ];
  const suggested = [quickActions[0]!, quickActions[1]!, quickActions[2]!, quickActions[6]!].map(
    (item) => ({ ...item, id: `suggested-${item.id}`, group: "Suggested" as const }),
  );
  return [...suggested, ...quickActions, ...navigation];
}

function action(
  id: string,
  label: string,
  detail: string,
  href: string,
  aliases: string[],
): CommandItem {
  const route = routesAvailableTo(true).find((candidate) => candidate.route === href);
  return {
    id: `action-${id}`,
    label,
    detail,
    href,
    group: "Quick actions",
    aliases,
    icon: route?.icon ?? Sparkles,
  };
}

function filterCommandItems(items: CommandItem[], query: string, recentIds: string[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized)
    return [...items].sort(
      (left, right) => scoreRecent(right, recentIds) - scoreRecent(left, recentIds),
    );
  return items.filter((item) =>
    [item.label, item.detail, item.href, ...item.aliases]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function groupItems(items: CommandItem[]) {
  const order: CommandItem["group"][] = ["Suggested", "Quick actions", "Navigation"];
  return order
    .map((group) => [group, items.filter((item) => item.group === group)] as const)
    .filter(([, items]) => items.length);
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function readRecent() {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(recentStorageKey);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
function rememberRecent(id: string, setRecent: Dispatch<SetStateAction<string[]>>) {
  setRecent((current) => {
    const next = [id, ...current.filter((item) => item !== id)].slice(0, 8);
    try {
      window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
    } catch {
      /* Storage is optional. */
    }
    return next;
  });
}
function scoreRecent(item: CommandItem, recentIds: string[]) {
  const position = recentIds.indexOf(item.id);
  return position < 0 ? 0 : recentIds.length - position;
}
