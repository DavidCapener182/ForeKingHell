"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Bell,
  Bot,
  Brain,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  Database,
  Download,
  FileText,
  Flag,
  Gauge,
  Keyboard,
  MapPin,
  MessageCircle,
  PanelRightOpen,
  Pin,
  Search,
  Settings,
  ShieldCheck as ShieldCheckIcon,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  Upload,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AppNavGroup, AppNavItem } from "@/components/app/nav-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { savedInsightUpdatedEvent } from "@/components/app/desktop-save-insight-button";
import { desktopSavedViewsUpdatedEvent } from "@/components/app/desktop-workbench-controls";
import { cn } from "@/lib/utils";

type DesktopWorkbenchChromeProps = {
  navGroups: AppNavGroup[];
  isAdmin: boolean;
  accountMenu?: ReactNode;
};

type WorkbenchLink = {
  title: string;
  href: string;
  detail: string;
  group?: string;
};

type CommandItem = WorkbenchLink & {
  keywords: string;
  icon: LucideIcon;
  type: "page" | "club" | "round" | "course" | "session" | "friend" | "action" | "workspace";
};

type WorkspaceCommandType = "club" | "round" | "course" | "session" | "friend";

type WorkspaceCommandItem = WorkbenchLink & {
  keywords: string;
  type: WorkspaceCommandType;
};

type SavedViewCommandItem = WorkbenchLink & {
  keywords: string;
};

type DesktopNotificationTone = "green" | "amber" | "blue" | "slate";

type DesktopNotificationItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: DesktopNotificationTone;
  unread: boolean;
};

type AssistantContext = {
  label: string;
  route: string;
  summary: string;
  evidence: string[];
  prompts: Array<{
    label: string;
    prompt: string;
    icon: LucideIcon;
  }>;
};

type BreadcrumbItem = {
  label: string;
  href?: string;
};

const recentStorageKey = "fkh:desktop-recent-items";
const pinnedStorageKey = "fkh:desktop-pinned-items";
const savedInsightStorageKey = "fkh:desktop-saved-insights";
const notificationReadStorageKey = "fkh:desktop-notification-read-ids";
const savedViewsStoragePrefix = "fkh:saved-views:";

const assistantSupportedRoutePrefixes = [
  "/dashboard",
  "/today",
  "/shots",
  "/compare",
  "/bag",
  "/rounds",
  "/courses",
  "/course-records",
  "/progress",
  "/strokes-gained",
  "/coach",
  "/data-chat",
  "/admin",
];

const defaultPinnedLinks: WorkbenchLink[] = [
  { title: "Driver analytics", href: "/bag", detail: "Tee club trust, path and course number" },
  { title: "Latest round", href: "/rounds", detail: "Scorecard, cleanup tasks and review" },
  { title: "7 iron stock", href: "/shots?club=7-iron", detail: "Stock-shot table and filters" },
  { title: "Course records", href: "/course-records", detail: "Proof tiers and chaseable records" },
];

const clubCommands: CommandItem[] = [
  {
    title: "Driver analytics",
    href: "/bag",
    detail: "Open tee-club confidence, path and gapping signals.",
    group: "Club",
    keywords: "driver tee club analytics path face speed dispersion",
    icon: Target,
    type: "club",
  },
  {
    title: "7 iron stock shots",
    href: "/shots?club=7-iron",
    detail: "Review stock 7 iron evidence and carry movement.",
    group: "Club",
    keywords: "7 iron seven stock shots approach carry",
    icon: Target,
    type: "club",
  },
  {
    title: "Wedge confidence",
    href: "/bag",
    detail: "Check scoring-zone calibration without guessing.",
    group: "Club",
    keywords: "wedge wedges scoring zone confidence gapping",
    icon: Target,
    type: "club",
  },
];

const actionCommands: CommandItem[] = [
  {
    title: "Import data",
    href: "/import",
    detail: "Upload or connect a launch-monitor session.",
    group: "Action",
    keywords: "import upload csv rapsodo launch monitor data",
    icon: Upload,
    type: "action",
  },
  {
    title: "Add round",
    href: "/rounds/new",
    detail: "Enter a keyboard-friendly scorecard.",
    group: "Action",
    keywords: "round scorecard add new play handicap",
    icon: FileText,
    type: "action",
  },
  {
    title: "Generate performance report",
    href: "/data-chat?prompt=Generate%20a%20performance%20report%20from%20my%20current%20ForeKingHell%20data.%20Use%20only%20available%20evidence%20and%20call%20out%20low-confidence%20areas.",
    detail: "Open Data Chat with the desktop report prompt.",
    group: "AI",
    keywords: "ai report weekly summary practice export",
    icon: Sparkles,
    type: "action",
  },
  {
    title: "Open friends",
    href: "/friends",
    detail: "Requests, invites, comparison and blocked users.",
    group: "Social",
    keywords: "friend friends social profile invite requests",
    icon: MessageCircle,
    type: "action",
  },
  {
    title: "Find courses",
    href: "/courses",
    detail: "Search mapped courses, holes and source health.",
    group: "Play",
    keywords: "course courses holes records map address",
    icon: Target,
    type: "action",
  },
];

const shortcutRows = [
  { keys: ["⌘", "K"], altKeys: ["Ctrl", "K"], action: "Open command palette" },
  { keys: ["G", "D"], action: "Dashboard" },
  { keys: ["G", "T"], action: "Latest practice" },
  { keys: ["G", "P"], action: "Progress" },
  { keys: ["G", "B"], action: "Bag" },
  { keys: ["G", "S"], action: "Shots" },
  { keys: ["G", "R"], action: "Rounds" },
  { keys: ["G", "C"], action: "Coach" },
  { keys: ["G", "H"], action: "Data Chat" },
  { keys: ["/"], action: "Focus page search or filter" },
  { keys: ["F"], action: "Focus filters" },
  { keys: ["E"], action: "Export current view" },
  { keys: ["W"], action: "Open workspace links" },
  { keys: ["A"], action: "Open AI assistant on supported pages" },
  { keys: ["Enter"], altKeys: ["Space"], action: "Select focused table row" },
  { keys: ["↑", "↓"], altKeys: ["Home", "End"], action: "Move between table rows" },
  { keys: ["?"], action: "Keyboard shortcuts" },
];

const shortcutRoutes = new Map([
  ["d", "/dashboard"],
  ["t", "/today"],
  ["p", "/progress"],
  ["b", "/bag"],
  ["s", "/shots"],
  ["r", "/rounds"],
  ["c", "/coach"],
  ["h", "/data-chat"],
]);

const workspaceCommandIcons: Record<WorkspaceCommandType, LucideIcon> = {
  club: Target,
  round: Flag,
  course: MapPin,
  session: Clock3,
  friend: UserRound,
};

const workspaceCommandGroups: Record<WorkspaceCommandType, string> = {
  club: "Club",
  round: "Round",
  course: "Course",
  session: "Session",
  friend: "Friend",
};

const workspaceCommandTypes = new Set<WorkspaceCommandType>([
  "club",
  "round",
  "course",
  "session",
  "friend",
]);

export function DesktopWorkbenchChrome({
  navGroups,
  isAdmin,
  accountMenu,
}: DesktopWorkbenchChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [workspaceLinksOpen, setWorkspaceLinksOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentLinks, setRecentLinks] = useState<WorkbenchLink[]>([]);
  const [pinnedLinks, setPinnedLinks] = useState<WorkbenchLink[]>(defaultPinnedLinks);
  const [savedInsightLinks, setSavedInsightLinks] = useState<WorkbenchLink[]>([]);
  const [savedViewCommands, setSavedViewCommands] = useState<SavedViewCommandItem[]>([]);
  const [workspaceCommands, setWorkspaceCommands] = useState<WorkspaceCommandItem[]>([]);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const gSequenceTimerRef = useRef<number | null>(null);
  const awaitingGoRef = useRef(false);

  const activeItem = useMemo(() => findActiveItem(navGroups, pathname), [navGroups, pathname]);
  const breadcrumbItems = useMemo(
    () => buildBreadcrumbItems(activeItem, pathname),
    [activeItem, pathname],
  );
  const assistantContext = useMemo(() => getAssistantContext(pathname), [pathname]);
  const pageAction = getPrimaryAction(pathname);
  const PageActionIcon = pageAction.icon;
  const commands = useMemo(
    () => buildCommandItems(navGroups, isAdmin, workspaceCommands, savedViewCommands),
    [navGroups, isAdmin, workspaceCommands, savedViewCommands],
  );
  const filteredCommands = useMemo(() => filterCommands(commands, query), [commands, query]);
  const safeActiveCommandIndex =
    filteredCommands.length === 0 ? 0 : Math.min(activeCommandIndex, filteredCommands.length - 1);
  const activeCommand = filteredCommands[safeActiveCommandIndex] ?? null;
  const savedCurrentInsight = useMemo(
    () => savedInsightLinks.some((link) => link.href === pathname),
    [pathname, savedInsightLinks],
  );

  useEffect(() => {
    if (!assistantContext && assistantOpen) {
      const timer = window.setTimeout(() => setAssistantOpen(false), 0);
      return () => window.clearTimeout(timer);
    }
  }, [assistantContext, assistantOpen]);

  const assistantSheetOpen = assistantOpen && Boolean(assistantContext);

  const openCommandPalette = useCallback(() => {
    setSavedViewCommands(readSavedViewCommands());
    setQuery("");
    setActiveCommandIndex(0);
    setCommandOpen(true);
  }, []);

  const closeCommandAndNavigate = useCallback(
    (href: string) => {
      setCommandOpen(false);
      setShortcutsOpen(false);
      setAssistantOpen(false);
      setWorkspaceLinksOpen(false);
      setQuery("");
      window.requestAnimationFrame(() => {
        router.push(href);
      });
    },
    [router],
  );

  const addRecentLink = useCallback((link: WorkbenchLink) => {
    const current = normalizeStoredLink(link);
    if (!current) {
      return;
    }

    setRecentLinks((links) => {
      const next = [current, ...links.filter((item) => item.href !== current.href)].slice(0, 6);
      writeStoredLinks(recentStorageKey, next);
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecentLinks(readStoredLinks(recentStorageKey));
      setPinnedLinks(readStoredLinks(pinnedStorageKey, defaultPinnedLinks));
      setSavedInsightLinks(readStoredLinks(savedInsightStorageKey));
      setSavedViewCommands(readSavedViewCommands());
    }, 0);
    const syncSavedInsights = () => setSavedInsightLinks(readStoredLinks(savedInsightStorageKey));
    const syncSavedViews = () => setSavedViewCommands(readSavedViewCommands());

    window.addEventListener(savedInsightUpdatedEvent, syncSavedInsights);
    window.addEventListener(desktopSavedViewsUpdatedEvent, syncSavedViews);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(savedInsightUpdatedEvent, syncSavedInsights);
      window.removeEventListener(desktopSavedViewsUpdatedEvent, syncSavedViews);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWorkspaceCommands() {
      try {
        const response = await fetch("/api/desktop-workbench/commands", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload: unknown = await response.json();
        if (!controller.signal.aborted) {
          setWorkspaceCommands(normalizeWorkspaceCommands(payload));
        }
      } catch {
        if (!controller.signal.aborted) {
          setWorkspaceCommands([]);
        }
      }
    }

    void loadWorkspaceCommands();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const current =
      findWorkspaceRecentForCurrentPath(pathname, workspaceCommands) ??
      (activeItem
        ? {
            title: activeItem.item.label,
            href: pathname,
            detail: `${activeItem.group.label} workspace`,
            group: activeItem.group.label,
          }
        : null);

    if (!current) {
      return;
    }

    const timer = window.setTimeout(() => {
      addRecentLink(current);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeItem, addRecentLink, pathname, workspaceCommands]);

  useEffect(() => {
    if (!commandOpen) {
      return;
    }

    const timer = window.setTimeout(() => commandInputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [commandOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        key === "w" &&
        !commandOpen &&
        !shortcutsOpen &&
        !workspaceLinksOpen
      ) {
        event.preventDefault();
        setSavedViewCommands(readSavedViewCommands());
        setWorkspaceLinksOpen(true);
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === "a" && assistantContext) {
        event.preventDefault();
        setAssistantOpen(true);
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === "/") {
        const focused = focusFirstElement([
          "[data-page-search]",
          "[data-filter-search]",
          "main input[type='search']",
          "main [name='q']",
          "main [name='search']",
        ]);

        if (focused) {
          event.preventDefault();
        }
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === "f") {
        const focused = focusFirstElement([
          "[data-filter-control]",
          "[data-filter-toolbar] button",
          "main button[aria-haspopup='dialog']",
          "main input[type='search']",
        ]);

        if (focused) {
          event.preventDefault();
        }
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === "e") {
        const element = findCurrentExportControl();

        if (element) {
          event.preventDefault();
          element.click();
        }
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === "g") {
        event.preventDefault();
        awaitingGoRef.current = true;
        if (gSequenceTimerRef.current) {
          window.clearTimeout(gSequenceTimerRef.current);
        }
        gSequenceTimerRef.current = window.setTimeout(() => {
          awaitingGoRef.current = false;
        }, 900);
        return;
      }

      if (awaitingGoRef.current) {
        const href = shortcutRoutes.get(key);
        awaitingGoRef.current = false;
        if (gSequenceTimerRef.current) {
          window.clearTimeout(gSequenceTimerRef.current);
        }

        if (href) {
          event.preventDefault();
          closeCommandAndNavigate(href);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (gSequenceTimerRef.current) {
        window.clearTimeout(gSequenceTimerRef.current);
      }
    };
  }, [
    assistantContext,
    closeCommandAndNavigate,
    commandOpen,
    openCommandPalette,
    shortcutsOpen,
    workspaceLinksOpen,
  ]);

  function pinCurrentPage() {
    const current =
      findWorkspaceRecentForCurrentPath(pathname, workspaceCommands) ??
      ({
        title: activeItem?.item.label ?? "Current page",
        href: currentPathWithSearch(pathname),
        detail: activeItem ? `${activeItem.group.label} workspace` : "Saved workspace",
        group: activeItem?.group.label,
      } satisfies WorkbenchLink);

    pinWorkspaceLink(current);
  }

  function pinWorkspaceLink(link: WorkbenchLink) {
    const current = normalizeStoredLink(link);
    if (!current) {
      return;
    }

    setPinnedLinks((links) => {
      const next = [current, ...links.filter((item) => item.href !== current.href)].slice(0, 8);
      writeStoredLinks(pinnedStorageKey, next);
      return next;
    });
  }

  function unpinWorkspaceLink(href: string) {
    setPinnedLinks((links) => {
      const next = links.filter((link) => link.href !== href);
      writeStoredLinks(pinnedStorageKey, next);
      return next;
    });
  }

  function togglePinnedWorkspaceLink(link: WorkbenchLink) {
    if (pinnedLinks.some((item) => item.href === link.href)) {
      unpinWorkspaceLink(link.href);
      return;
    }

    pinWorkspaceLink(link);
  }

  function saveInsight() {
    if (!assistantContext) {
      return;
    }

    const insight = {
      title: `${assistantContext.label} insight`,
      href: pathname,
      detail: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };
    const existing = readStoredLinks(savedInsightStorageKey);
    const next = [insight, ...existing.filter((link) => link.href !== insight.href)].slice(0, 12);

    writeStoredLinks(savedInsightStorageKey, next);
    setSavedInsightLinks(next);
  }

  function selectCommand(command: CommandItem) {
    addRecentLink(command);
    closeCommandAndNavigate(command.href);
  }

  function handleCommandInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (filteredCommands.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCommandIndex((safeActiveCommandIndex + 1) % filteredCommands.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCommandIndex(
        (safeActiveCommandIndex - 1 + filteredCommands.length) % filteredCommands.length,
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveCommandIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveCommandIndex(filteredCommands.length - 1);
      return;
    }

    if (event.key === "Enter" && activeCommand) {
      event.preventDefault();
      selectCommand(activeCommand);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 hidden min-h-14 border-b border-emerald-950/10 bg-[#FFFDF8]/92 px-4 py-2 shadow-[0_8px_24px_rgba(31,49,39,0.06)] backdrop-blur supports-[backdrop-filter]:bg-[#FFFDF8]/82 sm:block">
        <div className="flex min-w-0 items-center gap-2 2xl:gap-3">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
            <Link
              href="/dashboard"
              className="focus-aaa rounded-md px-2 py-1 font-semibold text-emerald-950 outline-none hover:bg-emerald-50"
            >
              Home
            </Link>
            {breadcrumbItems.map((item, index) => {
              const isLast = index === breadcrumbItems.length - 1;

              return (
                <span
                  key={`${item.label}-${item.href ?? index}`}
                  className="flex min-w-0 items-center gap-2"
                >
                  <span className="text-muted-foreground" aria-hidden>
                    /
                  </span>
                  {item.href && !isLast ? (
                    <Link
                      href={item.href}
                      className="focus-aaa min-w-0 rounded-md px-2 py-1 font-medium text-muted-foreground outline-none hover:bg-emerald-50 hover:text-foreground"
                    >
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ) : (
                    <span
                      className="min-w-0 truncate rounded-md px-2 py-1 font-medium text-muted-foreground"
                      aria-current={isLast ? "page" : undefined}
                    >
                      {item.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={openCommandPalette}
            className="focus-aaa ml-auto grid h-9 min-w-0 max-w-xl flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-emerald-950/10 bg-white/76 px-3 text-left text-sm text-muted-foreground shadow-sm outline-none transition-colors hover:border-emerald-300 hover:bg-white lg:min-w-[12rem] 2xl:min-w-[18rem]"
            aria-label="Open command palette"
          >
            <Search className="size-4" aria-hidden />
            <span className="truncate">
              Search pages, clubs, rounds, friends, courses or actions
            </span>
            <span className="hidden items-center gap-1 text-[11px] font-semibold text-muted-foreground lg:flex">
              <ShortcutKey>⌘</ShortcutKey>
              <ShortcutKey>K</ShortcutKey>
            </span>
          </button>

          <WorkspaceSwitcher pathname={pathname} isAdmin={isAdmin} />

          <Button
            asChild
            variant="outline"
            className="hidden size-8 px-0 xl:inline-flex 2xl:w-auto 2xl:px-2.5"
          >
            <Link href={pageAction.href}>
              <PageActionIcon className="size-4" />
              <span className="hidden 2xl:inline">{pageAction.label}</span>
            </Link>
          </Button>

          <WorkspaceLinksMenu
            open={workspaceLinksOpen}
            onOpenChange={setWorkspaceLinksOpen}
            pinnedLinks={pinnedLinks}
            recentLinks={recentLinks}
            savedViewLinks={savedViewCommands}
            onPinCurrent={pinCurrentPage}
            onNavigate={closeCommandAndNavigate}
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="focus-aaa"
            onClick={pinCurrentPage}
            aria-label="Pin current workspace"
          >
            <Pin className="size-4" />
          </Button>

          <NotificationMenu />

          {assistantContext ? (
            <Button
              type="button"
              variant="secondary"
              className="hidden size-8 px-0 xl:inline-flex 2xl:w-auto 2xl:px-2.5"
              onClick={() => setAssistantOpen(true)}
              aria-label={`Open AI assistant for ${assistantContext.label}`}
            >
              <PanelRightOpen className="size-4" />
              <span className="hidden 2xl:inline">AI assistant</span>
            </Button>
          ) : null}

          {accountMenu}
        </div>
      </header>

      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent
          className="max-h-[min(44rem,calc(100vh-2rem))] overflow-hidden p-0 sm:max-w-4xl"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Command palette</DialogTitle>
            <DialogDescription>
              Search ForeKingHell pages, clubs, rounds and actions.
            </DialogDescription>
          </DialogHeader>
          <div className="border-b border-border bg-[#FFFDF8] p-4">
            <label className="grid h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-emerald-950/10 bg-white px-3 shadow-sm">
              <Search className="size-4 text-muted-foreground" aria-hidden />
              <span className="sr-only">Search command palette</span>
              <input
                ref={commandInputRef}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveCommandIndex(0);
                }}
                onKeyDown={handleCommandInputKeyDown}
                placeholder="Search driver, latest round, 7 iron, friends, courses..."
                role="combobox"
                aria-expanded={commandOpen}
                aria-controls="command-palette-results"
                aria-activedescendant={
                  activeCommand ? commandOptionId(safeActiveCommandIndex) : undefined
                }
                className="min-w-0 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
              />
              <span className="text-xs font-semibold text-muted-foreground">Esc</span>
            </label>
          </div>
          <div className="grid min-h-0 gap-0 md:grid-cols-[minmax(0,1fr)_18rem]">
            <ScrollArea className="max-h-[29rem]">
              <div
                id="command-palette-results"
                className="grid gap-2 p-3"
                role="listbox"
                aria-label="Command palette results"
                data-command-results
              >
                {filteredCommands.length > 0 ? (
                  filteredCommands.map((command, index) => (
                    <CommandLink
                      key={`${command.type}-${command.title}-${command.href}`}
                      command={command}
                      index={index}
                      active={index === safeActiveCommandIndex}
                      pinned={pinnedLinks.some((link) => link.href === command.href)}
                      onSelect={selectCommand}
                      onTogglePinned={togglePinnedWorkspaceLink}
                      onPreview={() => setActiveCommandIndex(index)}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    No matching command. Try a page, club, course, friend, round or import action.
                  </div>
                )}
              </div>
            </ScrollArea>
            <aside className="hidden min-h-0 border-l border-border bg-muted/25 p-3 md:grid md:content-start md:gap-4">
              <QuickLinkSection
                title="Pinned workspace"
                icon={Pin}
                links={pinnedLinks}
                onNavigate={closeCommandAndNavigate}
              />
              <QuickLinkSection
                title="Saved table views"
                icon={SlidersHorizontal}
                links={savedViewCommands}
                empty="Saved filters appear here."
                onNavigate={closeCommandAndNavigate}
              />
              <QuickLinkSection
                title="Saved insights"
                icon={Sparkles}
                links={savedInsightLinks}
                empty="Saved AI insights appear here."
                onNavigate={closeCommandAndNavigate}
              />
              <QuickLinkSection
                title="Recent items"
                icon={Clock3}
                links={recentLinks}
                empty="Recent pages appear here."
                onNavigate={closeCommandAndNavigate}
              />
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                className="focus-aaa grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-white/72 px-3 py-2 text-left text-sm font-semibold outline-none hover:border-emerald-300"
              >
                <Keyboard className="size-4 text-emerald-700" aria-hidden />
                <span>Keyboard shortcuts</span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              </button>
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={assistantSheetOpen} onOpenChange={setAssistantOpen}>
        <SheetContent className="w-[min(100vw,30rem)] gap-0 p-0 sm:max-w-[30rem]">
          {assistantContext ? (
            <AssistantPanel
              context={assistantContext}
              pathname={pathname}
              saved={savedCurrentInsight}
              onSave={saveInsight}
            />
          ) : (
            <>
              <SheetHeader className="border-b border-border p-4 text-left">
                <SheetTitle>AI assistant</SheetTitle>
                <SheetDescription>
                  Open Latest practice, Shots, Bag, Rounds, Progress, Coach or Data Chat for
                  contextual help.
                </SheetDescription>
              </SheetHeader>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Desktop shortcuts for route switching, filters and the AI workbench.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {shortcutRows.map((shortcut) => (
              <div
                key={`${shortcut.action}-${shortcut.keys.join("")}`}
                className="grid grid-cols-[minmax(7rem,auto)_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border bg-white/70 px-3 py-2"
              >
                <span className="flex flex-wrap gap-1">
                  {shortcut.keys.map((key) => (
                    <ShortcutKey key={key}>{key}</ShortcutKey>
                  ))}
                  {shortcut.altKeys ? (
                    <>
                      <span className="px-1 text-xs text-muted-foreground">or</span>
                      {shortcut.altKeys.map((key) => (
                        <ShortcutKey key={key}>{key}</ShortcutKey>
                      ))}
                    </>
                  ) : null}
                </span>
                <span className="text-sm font-medium">{shortcut.action}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function WorkspaceLinksMenu({
  open,
  onOpenChange,
  pinnedLinks,
  recentLinks,
  savedViewLinks,
  onPinCurrent,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinnedLinks: WorkbenchLink[];
  recentLinks: WorkbenchLink[];
  savedViewLinks: WorkbenchLink[];
  onPinCurrent: () => void;
  onNavigate: (href: string) => void;
}) {
  const savedCount = savedViewLinks.length + pinnedLinks.length;
  const pinnedHrefs = new Set(pinnedLinks.map((link) => link.href));
  const visibleRecentLinks = recentLinks.filter((link) => !pinnedHrefs.has(link.href));

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="relative hidden size-8 px-0 lg:inline-flex xl:size-8 xl:justify-center 2xl:w-auto 2xl:min-w-[8.75rem] 2xl:justify-start 2xl:px-2.5"
          aria-label="Open workspace links"
        >
          <Pin className="size-4" aria-hidden />
          <span className="hidden truncate 2xl:inline">Workspace</span>
          {savedCount > 0 ? (
            <Badge
              variant="secondary"
              className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] leading-4 2xl:static 2xl:ml-auto 2xl:h-5 2xl:px-1.5"
            >
              {savedCount > 9 ? "9+" : savedCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-3">
        <DropdownMenuLabel className="px-0">Workspace links</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onPinCurrent}>
          <Pin className="size-4" />
          Pin current workspace
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="grid gap-4">
          <QuickLinkSection
            title="Pinned workspace"
            icon={Pin}
            links={pinnedLinks}
            onNavigate={onNavigate}
          />
          <QuickLinkSection
            title="Saved table views"
            icon={SlidersHorizontal}
            links={savedViewLinks}
            empty="Saved filters appear here."
            onNavigate={onNavigate}
          />
          <QuickLinkSection
            title="Recent items"
            icon={Clock3}
            links={visibleRecentLinks}
            empty="Recent pages appear here."
            onNavigate={onNavigate}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CommandLink({
  command,
  index,
  active,
  pinned,
  onSelect,
  onTogglePinned,
  onPreview,
}: {
  command: CommandItem;
  index: number;
  active: boolean;
  pinned: boolean;
  onSelect: (command: CommandItem) => void;
  onTogglePinned: (command: CommandItem) => void;
  onPreview: () => void;
}) {
  const Icon = command.icon;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (shouldLetBrowserHandleLink(event)) {
      return;
    }

    event.preventDefault();
    onSelect(command);
  }

  return (
    <div
      id={commandOptionId(index)}
      role="option"
      aria-selected={active}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-lg border bg-white/72 transition-[border-color,background-color,box-shadow] hover:border-emerald-300 hover:bg-white",
        active
          ? "border-emerald-400 bg-emerald-50/75 shadow-[0_0_0_1px_rgba(5,150,105,0.22)]"
          : "border-border",
      )}
      data-command-active={active ? "true" : undefined}
    >
      <Link
        href={command.href}
        prefetch={false}
        onClick={handleClick}
        onMouseEnter={onPreview}
        className="focus-aaa group grid min-h-14 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-l-lg px-3 py-2 text-left outline-none"
      >
        <span className="grid size-8 place-items-center rounded-md bg-emerald-50 text-emerald-800">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{command.title}</span>
            {command.group ? (
              <Badge
                variant="outline"
                className="hidden h-5 shrink-0 px-1.5 text-[10px] sm:inline-flex"
              >
                {command.group}
              </Badge>
            ) : null}
          </span>
          <span className="block truncate text-xs leading-5 text-muted-foreground">
            {command.detail}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden md:inline">{index + 1}</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
        </span>
      </Link>
      <button
        type="button"
        onClick={() => onTogglePinned(command)}
        className={cn(
          "focus-aaa grid min-h-14 w-12 place-items-center rounded-r-lg border-l border-border outline-none transition-colors hover:bg-emerald-50",
          pinned ? "text-emerald-700" : "text-muted-foreground",
        )}
        aria-label={pinned ? `Unpin ${command.title}` : `Pin ${command.title}`}
      >
        {pinned ? <Check className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

function commandOptionId(index: number) {
  return `command-palette-option-${index}`;
}

function QuickLinkSection({
  title,
  icon: Icon,
  links,
  empty = "No saved links.",
  onNavigate,
}: {
  title: string;
  icon: LucideIcon;
  links: WorkbenchLink[];
  empty?: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {title}
      </div>
      <div className="grid gap-1.5">
        {links.length > 0 ? (
          links.slice(0, 4).map((link) => (
            <Link
              key={`${title}-${link.href}-${link.title}`}
              href={link.href}
              prefetch={false}
              onClick={(event) => {
                if (shouldLetBrowserHandleLink(event)) {
                  return;
                }

                event.preventDefault();
                onNavigate(link.href);
              }}
              className="focus-aaa grid gap-0.5 rounded-lg border border-border bg-white/70 px-3 py-2 outline-none hover:border-emerald-300 hover:bg-white"
            >
              <span className="truncate text-sm font-semibold">{link.title}</span>
              <span className="truncate text-xs text-muted-foreground">{link.detail}</span>
            </Link>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}

function shouldLetBrowserHandleLink(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    event.button !== 0
  );
}

function NotificationMenu() {
  const [notifications, setNotifications] = useState<DesktopNotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const readNotificationIdsRef = useRef<Set<string>>(new Set());
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  useEffect(() => {
    const controller = new AbortController();
    const storedReadIds = readNotificationReadIds();
    readNotificationIdsRef.current = storedReadIds;

    async function loadNotifications() {
      try {
        const response = await fetch("/api/desktop-workbench/notifications", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          if (!controller.signal.aborted) {
            setNotifications([]);
            setLoaded(true);
          }
          return;
        }

        const payload: unknown = await response.json();
        if (!controller.signal.aborted) {
          setNotifications(
            applyNotificationReadIds(normalizeNotificationItems(payload), storedReadIds),
          );
          setLoaded(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setNotifications([]);
          setLoaded(true);
        }
      }
    }

    void loadNotifications();

    return () => controller.abort();
  }, []);

  function markNotificationRead(id: string) {
    setNotifications((items) =>
      items.map((notification) =>
        notification.id === id ? { ...notification, unread: false } : notification,
      ),
    );
    const next = new Set(readNotificationIdsRef.current);
    next.add(id);
    readNotificationIdsRef.current = next;
    writeNotificationReadIds(next);
  }

  function markAllNotificationsRead() {
    if (notifications.length === 0) {
      return;
    }

    setNotifications((items) => items.map((notification) => ({ ...notification, unread: false })));
    const next = new Set(readNotificationIdsRef.current);

    for (const notification of notifications) {
      next.add(notification.id);
    }

    readNotificationIdsRef.current = next;
    writeNotificationReadIds(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : "Open notifications"
          }
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-emerald-700 px-1 text-[10px] font-semibold leading-4 text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {unreadCount > 0 ? `${unreadCount} unread` : "All clear"}
            </Badge>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={(event) => {
                  event.stopPropagation();
                  markAllNotificationsRead();
                }}
              >
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="grid gap-2 p-1">
          {!loaded ? (
            <NotificationStatusRow
              title="Checking updates"
              detail="Loading golf workspace signals."
            />
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onMarkRead={markNotificationRead}
              />
            ))
          ) : (
            <NotificationStatusRow
              title="No new alerts"
              detail="Friend requests, challenge invites, imports and data warnings will appear here."
            />
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceSwitcher({ pathname, isAdmin }: { pathname: string; isAdmin: boolean }) {
  const views = getWorkspaceViews(pathname, isAdmin);
  const activeView = views.find((view) => view.isActive) ?? views[0];
  const ActiveIcon = activeView.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="hidden size-8 px-0 lg:inline-flex xl:size-8 xl:justify-center 2xl:w-auto 2xl:min-w-[8.75rem] 2xl:justify-start 2xl:px-2.5"
          aria-label="Switch workspace view"
        >
          <ActiveIcon className="size-4" aria-hidden />
          <span className="hidden truncate 2xl:inline">{activeView.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <DropdownMenuLabel>Workspace view</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.map((view) => {
          const Icon = view.icon;

          return (
            <DropdownMenuItem key={view.label} asChild>
              <Link
                href={view.href}
                prefetch={false}
                aria-current={view.isActive ? "page" : undefined}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2"
              >
                <span className="grid size-8 place-items-center rounded-md bg-emerald-50 text-emerald-800">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-sm font-semibold">{view.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{view.detail}</span>
                </span>
                {view.isActive ? (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    Active
                  </Badge>
                ) : null}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getWorkspaceViews(pathname: string, isAdmin: boolean) {
  const isCoachView =
    pathname.startsWith("/coach") ||
    pathname.startsWith("/practice") ||
    pathname.startsWith("/data-chat");
  const isAdminView = pathname.startsWith("/admin") || pathname.startsWith("/partners");

  return [
    {
      label: "Player workspace",
      href: "/dashboard",
      detail: "Command centre, play, analyse and social routes.",
      icon: UserRound,
      isActive: !isCoachView && !isAdminView,
    },
    {
      label: "Coach desk",
      href: "/coach",
      detail: "Diagnosis, drill plans and practice evidence.",
      icon: Brain,
      isActive: isCoachView,
    },
    ...(isAdmin
      ? [
          {
            label: "Admin console",
            href: "/admin",
            detail: "Moderation, provider health and operations.",
            icon: ShieldCheckIcon,
            isActive: isAdminView,
          },
        ]
      : []),
  ];
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: DesktopNotificationItem;
  onMarkRead: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-lg border bg-white/74",
        notification.unread ? "border-emerald-200" : "border-border",
      )}
    >
      <Link
        href={notification.href}
        prefetch={false}
        onClick={() => onMarkRead(notification.id)}
        className="focus-aaa grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-l-lg p-3 outline-none hover:bg-white"
      >
        <span
          className={cn(
            "mt-1 size-2 rounded-full",
            notification.unread ? notificationToneClass(notification.tone) : "bg-slate-300",
          )}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold">{notification.title}</span>
            {notification.unread ? (
              <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
                New
              </Badge>
            ) : null}
          </span>
          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
            {notification.detail}
          </span>
        </span>
        <ArrowRight className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
      </Link>
      <div className="grid min-w-[4.25rem] place-items-center border-l border-border px-2">
        {notification.unread ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onMarkRead(notification.id)}
          >
            Mark read
          </Button>
        ) : (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            Read
          </Badge>
        )}
      </div>
    </div>
  );
}

function NotificationStatusRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white/60 p-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function AssistantPanel({
  context,
  pathname,
  saved,
  onSave,
}: {
  context: AssistantContext;
  pathname: string;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <>
      <SheetHeader className="border-b border-border bg-[#FFFDF8] p-4 pr-12 text-left">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-900 text-white">
            <Bot className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <SheetTitle className="truncate">{context.label} assistant</SheetTitle>
            <SheetDescription className="truncate">Contextual AI assistant sheet</SheetDescription>
          </div>
        </div>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-4">
          <section className="premium-command-surface rounded-lg p-3">
            <p className="text-sm font-semibold">Explain this page from visible evidence.</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{context.summary}</p>
          </section>

          <section className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Evidence to cite
            </p>
            {context.evidence.map((item) => (
              <div
                key={item}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-lg border border-border bg-white/72 px-3 py-2 text-sm"
              >
                <Check className="mt-0.5 size-4 text-emerald-700" aria-hidden />
                <span>{item}</span>
              </div>
            ))}
          </section>

          <section className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Ask AI
            </p>
            {context.prompts.map((prompt) => {
              const Icon = prompt.icon;
              return (
                <Link
                  key={prompt.label}
                  href={`/data-chat?prompt=${encodeURIComponent(prompt.prompt)}&source=${encodeURIComponent(pathname)}`}
                  prefetch={false}
                  className="focus-aaa grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-white/72 px-3 py-2 outline-none hover:border-emerald-300 hover:bg-white"
                >
                  <Icon className="size-4 text-emerald-700" aria-hidden />
                  <span className="text-sm font-semibold">{prompt.label}</span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              );
            })}
            <button
              type="button"
              onClick={onSave}
              className={cn(
                "focus-aaa grid min-h-12 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold outline-none",
                saved
                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                  : "border-border bg-white/72 hover:border-emerald-300 hover:bg-white",
              )}
            >
              <Pin className="size-4 text-emerald-700" aria-hidden />
              {saved ? "Insight saved" : "Save this insight"}
            </button>
          </section>
        </div>
      </ScrollArea>
    </>
  );
}

function ShortcutKey({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded-md border border-border bg-white px-1.5 py-0.5 text-[11px] font-bold leading-4 text-muted-foreground shadow-sm">
      {children}
    </kbd>
  );
}

function buildCommandItems(
  navGroups: AppNavGroup[],
  isAdmin: boolean,
  workspaceCommands: WorkspaceCommandItem[],
  savedViewCommands: SavedViewCommandItem[],
): CommandItem[] {
  const pageCommands = navGroups.flatMap((group) =>
    group.items.map((item) => ({
      title: item.label,
      href: item.href,
      detail: `${group.label} page`,
      group: group.label,
      keywords: `${group.label} ${item.label} ${item.href} ${item.badge ?? ""}`,
      icon: item.icon,
      type: "page" as const,
    })),
  );

  const adminCommands: CommandItem[] = isAdmin
    ? [
        {
          title: "System checks",
          href: "/admin/system-checks",
          detail: "Provider health, moderation and role controls.",
          group: "Admin",
          keywords: "admin system checks provider moderation role audit",
          icon: SlidersHorizontal,
          type: "workspace",
        },
      ]
    : [];

  const dynamicWorkspaceCommands: CommandItem[] = workspaceCommands.map((command) => ({
    ...command,
    group: command.group ?? workspaceCommandGroups[command.type],
    icon: workspaceCommandIcons[command.type],
  }));

  const savedViewCommandItems: CommandItem[] = savedViewCommands.map((command) => ({
    ...command,
    group: command.group ?? "Saved view",
    icon: SlidersHorizontal,
    type: "workspace" as const,
  }));

  return [
    ...pageCommands,
    ...dynamicWorkspaceCommands,
    ...savedViewCommandItems,
    ...clubCommands,
    ...actionCommands,
    ...adminCommands,
  ];
}

function normalizeWorkspaceCommands(payload: unknown): WorkspaceCommandItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return [];
  }

  return payload.items
    .map((item) => normalizeWorkspaceCommand(item))
    .filter((item): item is WorkspaceCommandItem => Boolean(item))
    .slice(0, 32);
}

function normalizeWorkspaceCommand(value: unknown): WorkspaceCommandItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!isWorkspaceCommandType(value.type)) {
    return null;
  }

  const title = cleanCommandText(value.title, 90);
  const href = cleanCommandHref(value.href);
  const detail = cleanCommandText(value.detail, 140);
  const keywords = cleanCommandText(value.keywords, 300);

  if (!title || !href || !detail || !keywords) {
    return null;
  }

  return {
    title,
    href,
    detail,
    keywords,
    group: cleanCommandText(value.group, 48) || workspaceCommandGroups[value.type],
    type: value.type,
  };
}

function isWorkspaceCommandType(value: unknown): value is WorkspaceCommandType {
  return typeof value === "string" && workspaceCommandTypes.has(value as WorkspaceCommandType);
}

function cleanCommandText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanCommandHref(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const href = value.trim();
  return href.startsWith("/") && !href.startsWith("//") ? href.slice(0, 220) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeNotificationItems(payload: unknown): DesktopNotificationItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return [];
  }

  return payload.items
    .map((item) => normalizeNotificationItem(item))
    .filter((item): item is DesktopNotificationItem => Boolean(item))
    .slice(0, 8);
}

function applyNotificationReadIds(notifications: DesktopNotificationItem[], readIds: Set<string>) {
  if (readIds.size === 0) {
    return notifications;
  }

  return notifications.map((notification) =>
    readIds.has(notification.id) ? { ...notification, unread: false } : notification,
  );
}

function readNotificationReadIds() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(notificationReadStorageKey) ?? "[]");

    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(
      parsed.filter((item): item is string => typeof item === "string" && item.length > 0),
    );
  } catch {
    return new Set<string>();
  }
}

function writeNotificationReadIds(readIds: Set<string>) {
  try {
    window.localStorage.setItem(
      notificationReadStorageKey,
      JSON.stringify(Array.from(readIds).slice(-80)),
    );
  } catch {
    // Local storage is optional desktop polish; ignore private-mode failures.
  }
}

function normalizeNotificationItem(value: unknown): DesktopNotificationItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = cleanCommandText(value.id, 80);
  const title = cleanCommandText(value.title, 100);
  const detail = cleanCommandText(value.detail, 180);
  const href = cleanCommandHref(value.href);
  const tone = isNotificationTone(value.tone) ? value.tone : "slate";

  if (!id || !title || !detail || !href) {
    return null;
  }

  return {
    id,
    title,
    detail,
    href,
    tone,
    unread: value.unread === true,
  };
}

function isNotificationTone(value: unknown): value is DesktopNotificationTone {
  return value === "green" || value === "amber" || value === "blue" || value === "slate";
}

function notificationToneClass(tone: DesktopNotificationTone) {
  if (tone === "green") {
    return "bg-emerald-500";
  }

  if (tone === "amber") {
    return "bg-amber-500";
  }

  if (tone === "blue") {
    return "bg-blue-500";
  }

  return "bg-slate-400";
}

function findWorkspaceRecentForCurrentPath(
  pathname: string,
  workspaceCommands: WorkspaceCommandItem[],
): WorkbenchLink | null {
  const currentPath = currentPathWithSearch(pathname);
  const exact = workspaceCommands.find((command) => command.href === currentPath);
  const pathnameOnly = workspaceCommands.find((command) => command.href.split("?")[0] === pathname);
  const command = exact ?? pathnameOnly;

  return command ? toRecentLink(command) : null;
}

function toRecentLink(link: WorkbenchLink): WorkbenchLink {
  return {
    title: link.title,
    href: link.href,
    detail: link.detail,
    group: link.group,
  };
}

function currentPathWithSearch(fallbackPathname: string) {
  if (typeof window === "undefined") {
    return fallbackPathname;
  }

  return `${window.location.pathname}${window.location.search}`;
}

function filterCommands(commands: CommandItem[], query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return commands.slice(0, 12);
  }

  return commands
    .map((command) => ({
      command,
      score: scoreCommand(command, normalized),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 16)
    .map((entry) => entry.command);
}

function scoreCommand(command: CommandItem, query: string) {
  const haystack =
    `${command.title} ${command.detail} ${command.group ?? ""} ${command.keywords}`.toLowerCase();
  if (command.title.toLowerCase().startsWith(query)) return 5;
  if (haystack.includes(query)) return 3;
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part))
    ? 1
    : 0;
}

function findActiveItem(navGroups: AppNavGroup[], pathname: string) {
  const matches: Array<{ group: AppNavGroup; item: AppNavItem }> = [];

  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.isActive(pathname)) {
        matches.push({ group, item });
      }
    }
  }

  return matches.sort((left, right) => right.item.href.length - left.item.href.length)[0] ?? null;
}

function buildBreadcrumbItems(
  activeItem: ReturnType<typeof findActiveItem>,
  pathname: string,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = activeItem
    ? [{ label: activeItem.item.label, href: activeItem.item.href }]
    : [];
  const detailLabel = deepRouteLabel(pathname);

  if (!detailLabel) {
    return items;
  }

  const lastItem = items[items.length - 1];

  if (lastItem?.label === detailLabel) {
    return items;
  }

  return [...items, { label: detailLabel }];
}

function deepRouteLabel(pathname: string) {
  if (pathname === "/bag/longest") return "Longest shots";
  if (/^\/bag\/[^/]+\/analytics$/.test(pathname)) return "Club analytics";
  if (/^\/bag\/[^/]+$/.test(pathname)) return "Club profile";
  if (pathname === "/rounds/new") return "New round";
  if (/^\/rounds\/[^/]+$/.test(pathname)) return "Round review";
  if (pathname === "/courses/new") return "New course";
  if (/^\/courses\/[^/]+\/holes$/.test(pathname)) return "Hole management";
  if (/^\/courses\/[^/]+\/records\/[^/]+$/.test(pathname)) return "Record detail";
  if (/^\/courses\/[^/]+\/records$/.test(pathname)) return "Course records";
  if (/^\/courses\/[^/]+\/shot-pattern$/.test(pathname)) return "Shot pattern";
  if (/^\/courses\/[^/]+\/tournaments$/.test(pathname)) return "Course tournaments";
  if (/^\/courses\/[^/]+$/.test(pathname)) return "Course detail";
  if (/^\/course-records\/[^/]+$/.test(pathname)) return "Record detail";
  if (/^\/tournaments\/[^/]+\/leaderboard$/.test(pathname)) return "Event leaderboard";
  if (/^\/tournaments\/[^/]+\/rounds$/.test(pathname)) return "Event rounds";
  if (/^\/tournaments\/[^/]+\/rules$/.test(pathname)) return "Event rules";
  if (/^\/tournaments\/[^/]+\/submit$/.test(pathname)) return "Submit round";
  if (/^\/tournaments\/[^/]+$/.test(pathname)) return "Event detail";
  if (/^\/speed\/sessions\/[^/]+$/.test(pathname)) return "Speed session";
  if (/^\/groups\/[^/]+$/.test(pathname)) return "Group detail";
  if (/^\/profile\/[^/]+$/.test(pathname)) return "Public profile";
  if (/^\/friends\/qr\/[^/]+$/.test(pathname)) return "Friend invite";
  if (/^\/settings\/invitations\/[^/]+$/.test(pathname)) return "Invitation";

  return null;
}

function getPrimaryAction(pathname: string): { label: string; href: string; icon: LucideIcon } {
  if (pathname === "/" || pathname.startsWith("/dashboard")) {
    return { label: "Latest practice", href: "/today", icon: CalendarDays };
  }

  if (pathname.startsWith("/today")) {
    return { label: "Shot rows", href: "/shots", icon: Database };
  }

  if (pathname.startsWith("/rounds")) {
    return { label: "Add round", href: "/rounds/new", icon: FileText };
  }

  if (pathname.startsWith("/courses")) {
    return { label: "New course", href: "/courses/new", icon: FileText };
  }

  if (pathname.startsWith("/tournaments")) {
    return { label: "Add round", href: "/rounds/new", icon: Flag };
  }

  if (pathname.startsWith("/feed")) {
    return { label: "Friends", href: "/friends", icon: Users };
  }

  if (pathname.startsWith("/friends")) {
    return { label: "Find friends", href: "/friends", icon: UserRound };
  }

  if (pathname.startsWith("/groups")) {
    return { label: "Challenges", href: "/challenges", icon: Trophy };
  }

  if (pathname.startsWith("/challenges")) {
    return { label: "Leaderboards", href: "/leaderboard", icon: Trophy };
  }

  if (pathname.startsWith("/leaderboard")) {
    return { label: "Challenges", href: "/challenges", icon: Trophy };
  }

  if (pathname.startsWith("/profile")) {
    return { label: "Settings", href: "/settings", icon: Settings };
  }

  if (pathname.startsWith("/social-intelligence")) {
    return { label: "Feed", href: "/feed", icon: MessageCircle };
  }

  if (pathname.startsWith("/settings")) {
    return { label: "Billing", href: "/billing", icon: CreditCard };
  }

  if (pathname.startsWith("/billing")) {
    return { label: "Settings", href: "/settings", icon: Settings };
  }

  if (pathname.startsWith("/providers")) {
    return { label: "Rapsodo", href: "/rapsodo", icon: Upload };
  }

  if (pathname.startsWith("/rapsodo")) {
    return { label: "Import CSV", href: "/import", icon: Upload };
  }

  if (pathname.startsWith("/import")) {
    return { label: "Rapsodo", href: "/rapsodo", icon: Upload };
  }

  if (pathname.startsWith("/partners")) {
    return { label: "Admin console", href: "/admin", icon: ShieldCheckIcon };
  }

  if (pathname.startsWith("/admin")) {
    return { label: "User lookup", href: "/admin/users", icon: UserRound };
  }

  if (pathname.startsWith("/coach") || pathname.startsWith("/practice")) {
    return { label: "Build plan", href: "/practice", icon: Sparkles };
  }

  if (pathname.startsWith("/data-chat")) {
    return { label: "Generate report", href: "/data-chat", icon: Sparkles };
  }

  if (
    pathname.startsWith("/shots") ||
    pathname.startsWith("/bag") ||
    pathname.startsWith("/progress") ||
    pathname.startsWith("/strokes-gained") ||
    pathname.startsWith("/speed") ||
    pathname.startsWith("/stats/training-over-time") ||
    pathname.startsWith("/equipment") ||
    pathname.startsWith("/handicap") ||
    pathname.startsWith("/simulator-lab") ||
    pathname.startsWith("/course-records")
  ) {
    return { label: "Import", href: "/import", icon: Upload };
  }

  return { label: "Dashboard", href: "/dashboard", icon: Gauge };
}

function getAssistantContext(pathname: string): AssistantContext | null {
  if (!assistantSupportedRoutePrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  if (pathname.startsWith("/dashboard")) {
    return assistantContext({
      label: "Dashboard",
      route: pathname,
      summary:
        "Use the command-centre brief, quick answers, practice plan, data confidence and latest signals before recommending the next action.",
      evidence: [
        "AI Caddie brief and quick answers",
        "Practice planner and latest-practice signal",
        "Data health, bag confidence and action centre",
      ],
      actionPrompt: {
        label: "Build dashboard practice plan",
        prompt:
          "Build a dashboard practice plan from the visible ForeKingHell command-centre brief, quick answers, data confidence, bag confidence and latest-practice signals.",
        icon: Target,
      },
      reportPrompt: {
        label: "Generate dashboard report",
        prompt:
          "Generate a dashboard performance report from the visible ForeKingHell command-centre evidence, including next action, data confidence and low-confidence gaps.",
        icon: Download,
      },
    });
  }

  if (pathname.startsWith("/today")) {
    return assistantContext({
      label: "Latest practice",
      route: pathname,
      summary:
        "Use the clean-scoring session read, raw shot history, club comparisons and data-cleaning notes before recommending the next range job.",
      evidence: [
        "Clean scoring summary",
        "Raw shot rows and quality tags",
        "Club comparison and plan-result cards",
      ],
      actionPrompt: {
        label: "Build latest-practice plan",
        prompt:
          "Build a latest-practice follow-up plan from the visible ForeKingHell clean-scoring summary, raw shot history, club comparisons and data-cleaning notes.",
        icon: Target,
      },
      reportPrompt: {
        label: "Generate session report",
        prompt:
          "Generate a latest-practice report from the visible ForeKingHell session evidence, including clean-scoring exclusions and low-confidence clubs.",
        icon: Download,
      },
    });
  }

  if (pathname.startsWith("/shots")) {
    return assistantContext({
      label: "Shots",
      route: pathname,
      summary:
        "Use the active filters, visible table rows and selected shot detail before explaining trends or building a practice block.",
      evidence: ["Active filters", "Shot table columns", "Selected shot or grouped metric"],
    });
  }

  if (pathname.startsWith("/compare")) {
    return assistantContext({
      label: "Compare",
      route: pathname,
      summary:
        "Use the selected baseline, comparison scope, club filters and visible confidence before declaring what changed.",
      evidence: ["Baseline period", "Comparison period", "Selected clubs and metrics"],
    });
  }

  if (/^\/bag\/[^/]+\/analytics$/.test(pathname)) {
    return assistantContext({
      label: "Club analytics",
      route: pathname,
      summary:
        "Use the selected club's face, path, launch, speed, dispersion and evidence table before recommending drills.",
      evidence: ["Club analytics rail", "Shot evidence table", "Visible chart summaries"],
      actionPrompt: {
        label: "Build club drill",
        prompt:
          "Build a club-specific practice drill from the visible ForeKingHell club analytics evidence. Cite low-confidence areas.",
        icon: Target,
      },
    });
  }

  if (/^\/bag\/[^/]+$/.test(pathname) && pathname !== "/bag/longest") {
    return assistantContext({
      label: "Club profile",
      route: pathname,
      summary:
        "Use this club profile's selected range, recommended carry, trust, miss pattern and shot evidence before suggesting changes.",
      evidence: ["Selected date range", "Recommended vs best stock", "Club shot evidence table"],
      actionPrompt: {
        label: "Explain this club",
        prompt:
          "Explain this club profile from the visible ForeKingHell carry, trust, dispersion and shot evidence. Do not invent missing numbers.",
        icon: Target,
      },
    });
  }

  if (pathname.startsWith("/bag")) {
    return assistantContext({
      label: "Bag",
      route: pathname,
      summary:
        "Keep Recommended as the course-facing number, preserve low-confidence states and explain trust before suggesting clubs.",
      evidence: [
        "Recommended vs Best Stock",
        "Shot count and confidence",
        "Gapping and dispersion signals",
      ],
    });
  }

  if (pathname.startsWith("/rounds")) {
    return assistantContext({
      label: "Rounds",
      route: pathname,
      summary:
        "Explain scorecard proof, handicap contribution and lost-shot patterns from visible round evidence.",
      evidence: ["Scorecard status", "Hole breakdown", "Cleanup tasks and round trend"],
    });
  }

  if (pathname.startsWith("/courses") || pathname.startsWith("/course-records")) {
    return assistantContext({
      label: "Courses",
      route: pathname,
      summary:
        "Use course source health, mapped holes, records and proof tiers before recommending course actions.",
      evidence: ["Course library or record board", "Proof tier", "Recent rounds or opportunities"],
    });
  }

  if (pathname.startsWith("/progress") || pathname.startsWith("/strokes-gained")) {
    return assistantContext({
      label: "Progress",
      route: pathname,
      summary:
        "Compare the selected period with prior form, call out confidence and avoid inventing missing baselines.",
      evidence: ["Time range", "Club or phase breakdown", "Calculated vs pending samples"],
    });
  }

  if (pathname.startsWith("/coach")) {
    return assistantContext({
      label: "Coach",
      route: pathname,
      summary:
        "Turn diagnosis, evidence and drills into a practice plan while keeping manual notes as context.",
      evidence: ["Diagnosis", "Supporting shots", "Drill plan and session notes"],
    });
  }

  if (pathname.startsWith("/data-chat")) {
    return assistantContext({
      label: "Data Chat",
      route: pathname,
      summary:
        "Build answers from cited ForeKingHell data cards and save useful prompts for repeat desktop workflows.",
      evidence: ["Cited data", "Visible charts or cards", "Saved answers and suggested prompts"],
    });
  }

  if (pathname.startsWith("/admin/users")) {
    return assistantContext({
      label: "Admin users",
      route: pathname,
      summary:
        "Use account search, plan state, admin role status, recent activity and confirmation copy before recommending access changes.",
      evidence: ["User account table", "Plan and activity columns", "Admin role actions"],
      actionPrompt: {
        label: "Review access change",
        prompt:
          "Review the visible ForeKingHell admin users table and recommend the next access-management action. Call out risky lifetime or admin-role changes.",
        icon: UserRound,
      },
      reportPrompt: {
        label: "Generate access report",
        prompt:
          "Generate an admin access report from the visible ForeKingHell users table, including plans, admin roles, activity gaps and confirmation-sensitive actions.",
        icon: Download,
      },
    });
  }

  if (pathname.startsWith("/admin/billing")) {
    return assistantContext({
      label: "Admin billing",
      route: pathname,
      summary:
        "Use subscription status, plan, renewal, billing failure and lifetime access evidence before recommending entitlement changes.",
      evidence: ["Subscription table", "Billing failure metrics", "Lifetime access grant form"],
      actionPrompt: {
        label: "Review entitlement action",
        prompt:
          "Review the visible ForeKingHell admin billing table and recommend the next entitlement or billing action without inventing plan data.",
        icon: CreditCard,
      },
      reportPrompt: {
        label: "Generate billing report",
        prompt:
          "Generate an admin billing report from the visible ForeKingHell subscription, failure and entitlement evidence.",
        icon: Download,
      },
    });
  }

  if (pathname.startsWith("/admin/moderation")) {
    return assistantContext({
      label: "Admin moderation",
      route: pathname,
      summary:
        "Use report queues, moderation events, selected rows, bulk-action confirmations and audit language before recommending operator action.",
      evidence: ["User reports table", "Moderation events table", "Bulk action confirmation"],
      actionPrompt: {
        label: "Prioritise queue action",
        prompt:
          "Prioritise the visible ForeKingHell moderation queue and recommend the safest next operator action. Cite open reports, selected rows and audit impact.",
        icon: ShieldCheckIcon,
      },
      reportPrompt: {
        label: "Generate moderation report",
        prompt:
          "Generate a moderation operations report from the visible ForeKingHell reports, events and audit evidence.",
        icon: Download,
      },
    });
  }

  if (pathname.startsWith("/admin/challenges")) {
    return assistantContext({
      label: "Admin challenges",
      route: pathname,
      summary:
        "Use challenge board status, participant counts, proof requirements and moderation links before recommending competition actions.",
      evidence: ["Challenge board table", "Status and participant columns", "Moderation links"],
      actionPrompt: {
        label: "Review challenge action",
        prompt:
          "Review the visible ForeKingHell admin challenge board and recommend the next competition operation. Cite proof or moderation gaps.",
        icon: Flag,
      },
      reportPrompt: {
        label: "Generate challenge report",
        prompt:
          "Generate an admin challenge report from the visible ForeKingHell challenge board evidence.",
        icon: Download,
      },
    });
  }

  if (pathname.startsWith("/admin/system-checks")) {
    return assistantContext({
      label: "System checks",
      route: pathname,
      summary:
        "Use provider health, billing failures, moderation load, audit activity and recommended admin actions before escalating issues.",
      evidence: ["Provider health", "Billing and moderation metrics", "Next admin actions"],
      actionPrompt: {
        label: "Prioritise system issue",
        prompt:
          "Prioritise the visible ForeKingHell system-check issue and recommend the next admin action using only current console evidence.",
        icon: Gauge,
      },
      reportPrompt: {
        label: "Generate system report",
        prompt:
          "Generate a system health report from the visible ForeKingHell provider, billing, moderation and audit evidence.",
        icon: Download,
      },
    });
  }

  if (pathname.startsWith("/admin")) {
    return assistantContext({
      label: "Admin",
      route: pathname,
      summary:
        "Use visible queues, user lookup, billing, provider health and audit evidence before recommending operator action.",
      evidence: ["Admin metrics", "Operational tables", "Audit or moderation state"],
      actionPrompt: {
        label: "Recommend admin action",
        prompt:
          "Recommend the next admin action from visible ForeKingHell operations, moderation, billing, provider and audit evidence.",
        icon: SlidersHorizontal,
      },
      reportPrompt: {
        label: "Generate admin report",
        prompt:
          "Generate an admin operations report from the visible ForeKingHell console evidence.",
        icon: Download,
      },
    });
  }

  return null;
}

function assistantContext({
  label,
  route,
  summary,
  evidence,
  actionPrompt,
  reportPrompt,
}: {
  label: string;
  route: string;
  summary: string;
  evidence: string[];
  actionPrompt?: {
    label: string;
    prompt: string;
    icon: LucideIcon;
  };
  reportPrompt?: {
    label: string;
    prompt: string;
    icon: LucideIcon;
  };
}): AssistantContext {
  const defaultActionPrompt = {
    label: "Build practice plan",
    prompt: `Build a practice plan from this ${label} evidence. Keep it golfer-facing and avoid guessing missing numbers.`,
    icon: Target,
  };
  const defaultReportPrompt = {
    label: "Generate report",
    prompt: `Generate a performance report from this ${label} view with summary, weakness, confidence and next action.`,
    icon: Download,
  };

  return {
    label,
    route,
    summary,
    evidence,
    prompts: [
      {
        label: "Explain this page",
        prompt: `Explain the ${label} page using only visible ForeKingHell metrics and cite any low-confidence areas.`,
        icon: Bot,
      },
      {
        label: "What changed?",
        prompt: `Compare the current ${label} view with my recent form. Use only available data and say when the sample is weak.`,
        icon: Sparkles,
      },
      actionPrompt ?? defaultActionPrompt,
      reportPrompt ?? defaultReportPrompt,
    ].map((prompt) => ({
      ...prompt,
      prompt: guardAssistantPrompt(prompt.prompt),
    })),
  };
}

function guardAssistantPrompt(prompt: string) {
  return [
    prompt,
    "Use only visible ForeKingHell metrics, cite the evidence labels shown in the assistant sheet, and say when a number is missing or low-confidence instead of inventing it.",
  ].join(" ");
}

function readStoredLinks(key: string, fallback: WorkbenchLink[] = []): WorkbenchLink[] {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) {
      return fallback;
    }

    const links = parsed
      .map((item) => normalizeStoredLink(item))
      .filter((item): item is WorkbenchLink => item !== null);

    return links.length > 0 ? links : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredLinks(key: string, links: WorkbenchLink[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(links));
  } catch {
    // Local storage is optional desktop polish; ignore private-mode failures.
  }
}

function readSavedViewCommands(): SavedViewCommandItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const commands: SavedViewCommandItem[] = [];

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (!key?.startsWith(savedViewsStoragePrefix)) {
        continue;
      }

      const viewKey = key.slice(savedViewsStoragePrefix.length);
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");

      if (!Array.isArray(parsed)) {
        continue;
      }

      for (const view of parsed) {
        if (!isRecord(view)) {
          continue;
        }

        const link = normalizeStoredLink({
          title: view.title,
          href: view.href,
          detail: view.detail,
          group: "Saved view",
        });

        if (!link) {
          continue;
        }

        const scope = formatSavedViewScope(viewKey);
        commands.push({
          ...link,
          detail: `${scope} saved view - ${link.detail}`.slice(0, 120),
          keywords:
            `${link.title} ${link.href} ${link.detail} ${scope} ${viewKey} saved view saved filter columns density`.slice(
              0,
              300,
            ),
        });
      }
    }
  } catch {
    return [];
  }

  return dedupeSavedViewCommands(commands).slice(0, 24);
}

function dedupeSavedViewCommands(commands: SavedViewCommandItem[]) {
  const seen = new Set<string>();
  const deduped: SavedViewCommandItem[] = [];

  for (const command of commands) {
    const key = `${command.href}::${command.title}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(command);
  }

  return deduped;
}

function formatSavedViewScope(viewKey: string) {
  const normalized = viewKey.replace(/[-_]+/g, " ").trim();

  if (!normalized) {
    return "Workbench";
  }

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function normalizeStoredLink(value: unknown): WorkbenchLink | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<WorkbenchLink>;

  if (
    typeof candidate.title !== "string" ||
    typeof candidate.href !== "string" ||
    typeof candidate.detail !== "string" ||
    !candidate.href.startsWith("/")
  ) {
    return null;
  }

  return {
    title: candidate.title.slice(0, 80),
    href: candidate.href.slice(0, 180),
    detail: candidate.detail.slice(0, 120),
    group: typeof candidate.group === "string" ? candidate.group.slice(0, 40) : undefined,
  };
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function focusFirstElement(selectors: string[]) {
  const element = findFirstElement(selectors);

  if (!element) {
    return false;
  }

  element.focus();
  return true;
}

function findFirstElement(selectors: string[]) {
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);

    if (element && !element.hasAttribute("disabled") && element.offsetParent !== null) {
      return element;
    }
  }

  return null;
}

function findCurrentExportControl() {
  const mainTableId = findMainExportTableId();

  if (mainTableId) {
    const mainExportButton = findFirstElement([
      `[data-export-current-view][data-export-table-id="${cssAttribute(mainTableId)}"]`,
    ]);

    if (mainExportButton) {
      return mainExportButton;
    }
  }

  return findFirstElement([
    "[data-export-current-view]",
    "main a[href*='export']",
    "main button[name='export']",
  ]);
}

function findMainExportTableId() {
  const mainTableTarget = document.querySelector<HTMLElement>("[data-main-table-target='true']");

  if (!mainTableTarget) {
    return null;
  }

  const exportTable = mainTableTarget.matches("table[data-workbench-export-table]")
    ? mainTableTarget
    : mainTableTarget.querySelector<HTMLElement>("table[data-workbench-export-table]");

  return exportTable?.getAttribute("data-workbench-export-table") ?? null;
}

function cssAttribute(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
