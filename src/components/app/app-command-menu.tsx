"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { routesAvailableTo, type AppRouteMetadata } from "@/components/app/route-metadata";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

type AppCommandItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  group: "Navigation" | "Quick actions" | "Suggested";
  aliases: string[];
  icon: AppRouteMetadata["icon"];
};

type VisibleCommandGroup = {
  label: "Recent" | AppCommandItem["group"];
  items: AppCommandItem[];
};

const recentStorageKey = "lmwt:command-centre:recent";

export function AppCommandMenu({
  isAdmin,
  enableKeyboardShortcut = true,
}: {
  isAdmin: boolean;
  enableKeyboardShortcut?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>(readRecent);

  const allItems = useMemo(() => buildCommandItems(isAdmin), [isAdmin]);
  const visibleItems = useMemo(() => filterCommandItems(allItems, query), [allItems, query]);
  const groups = useMemo(
    () => groupItems(visibleItems, recentIds, query),
    [query, recentIds, visibleItems],
  );
  const currentRoute = allItems.find((item) => item.href === pathname);

  const openPalette = useCallback(() => {
    setQuery("");
    setOpen(true);
  }, []);

  const selectItem = useCallback(
    (item: AppCommandItem) => {
      rememberRecent(item.id, setRecentIds);
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  useEffect(() => {
    window.addEventListener("fkh:open-command-centre", openPalette);
    return () => window.removeEventListener("fkh:open-command-centre", openPalette);
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

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="LM World Tour command centre"
      description="Search every available route and start a useful golf action."
      className="w-[min(46rem,calc(100%-1rem))]"
    >
      <Command shouldFilter={false} loop>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search driver, yardages, practice load or course plan"
          aria-label="Search LM World Tour"
        />
        <p className="px-4 pb-1 pt-2 text-xs text-muted-foreground" aria-live="polite">
          {visibleItems.length} {visibleItems.length === 1 ? "result" : "results"}
          {currentRoute && !query ? ` · You are in ${currentRoute.label}` : ""}
        </p>
        <CommandList aria-label="Command centre results">
          <CommandEmpty>No matching route or golf action.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={`${group.label}-${item.id}`}
                    value={[item.label, item.detail, item.href, ...item.aliases].join(" ")}
                    onSelect={() => selectItem(item)}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary group-data-[selected=true]/command-item:bg-white/14 group-data-[selected=true]/command-item:text-primary-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground group-data-[selected=true]/command-item:text-primary-foreground/75">
                        {item.detail}
                      </span>
                    </span>
                    <CommandShortcut>
                      <ArrowRight className="size-4" aria-hidden />
                    </CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export function openAppCommandMenu() {
  window.dispatchEvent(new Event("fkh:open-command-centre"));
}

function buildCommandItems(isAdmin: boolean): AppCommandItem[] {
  const navigation = routesAvailableTo(isAdmin).map((route) => ({
    id: `route-${route.id}`,
    label: route.pageTitle,
    detail: `${route.navigationGroup} · ${route.route}`,
    href: route.route,
    group: "Navigation" as const,
    aliases: [route.shortTitle, route.route, ...route.searchAliases],
    icon: route.icon,
  }));
  const quickActions: AppCommandItem[] = [
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
): AppCommandItem {
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

function filterCommandItems(items: AppCommandItem[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) =>
    [item.label, item.detail, item.href, ...item.aliases]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function groupItems(items: AppCommandItem[], recentIds: string[], query: string) {
  const groups: VisibleCommandGroup[] = [];
  const recent = query.trim()
    ? []
    : recentIds.flatMap((id) => {
        const item = items.find((candidate) => candidate.id === id);
        return item ? [item] : [];
      });
  const recentSet = new Set(recent.map((item) => item.id));

  if (recent.length) groups.push({ label: "Recent", items: recent });
  for (const label of ["Suggested", "Quick actions", "Navigation"] as const) {
    const grouped = items.filter((item) => item.group === label && !recentSet.has(item.id));
    if (grouped.length) groups.push({ label, items: grouped });
  }
  return groups;
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
      // Storage is optional in strict or private browsing modes.
    }
    return next;
  });
}
