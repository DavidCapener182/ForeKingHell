"use client";

import Link from "next/link";
import { Fragment, type KeyboardEventHandler, type MouseEvent, type RefObject } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Keyboard,
  Pin,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { CommandItem, WorkbenchLink } from "@/components/app/desktop-workbench-chrome";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem as CommandMenuItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export function DesktopCommandPalette({
  open,
  onOpenChange,
  inputRef,
  query,
  onQueryChange,
  onInputKeyDown,
  commands,
  activeIndex,
  pinnedLinks,
  savedViewLinks,
  savedInsightLinks,
  recentLinks,
  onSelect,
  onTogglePinned,
  onPreview,
  onNavigate,
  onOpenShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  onInputKeyDown: KeyboardEventHandler<HTMLInputElement>;
  commands: CommandItem[];
  activeIndex: number;
  pinnedLinks: WorkbenchLink[];
  savedViewLinks: WorkbenchLink[];
  savedInsightLinks: WorkbenchLink[];
  recentLinks: WorkbenchLink[];
  onSelect: (command: CommandItem) => void;
  onTogglePinned: (command: CommandItem) => void;
  onPreview: (index: number) => void;
  onNavigate: (href: string) => void;
  onOpenShortcuts: () => void;
}) {
  const pinnedHrefs = new Set(pinnedLinks.map((link) => link.href));
  const groups = [...new Set(commands.map((command) => command.group ?? "Navigation"))];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Search LM World Tour pages, clubs, rounds and actions."
      className="sm:max-w-4xl"
      showCloseButton={false}
    >
      <Command shouldFilter={false} loop>
        <CommandInput
          ref={inputRef}
          value={query}
          onValueChange={onQueryChange}
          onKeyDown={onInputKeyDown}
          placeholder="Search driver, latest round, 7 iron, friends, courses..."
          aria-label="Search command palette"
        />
        <div className="grid min-h-0 gap-0 md:grid-cols-[minmax(0,1fr)_18rem]">
          <CommandList
            id="command-palette-results"
            className="max-h-[29rem] p-2"
            aria-label="Command palette results"
            data-command-results
          >
            <CommandEmpty>
              No matching command. Try a page, club, course, friend, round or import action.
            </CommandEmpty>
            {groups.map((group, groupIndex) => (
              <Fragment key={group}>
                {groupIndex > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading={group}>
                  {commands.map((command, index) =>
                    (command.group ?? "Navigation") === group ? (
                      <CommandLink
                        key={`${command.type}-${command.title}-${command.href}`}
                        command={command}
                        index={index}
                        active={index === activeIndex}
                        pinned={pinnedHrefs.has(command.href)}
                        onSelect={onSelect}
                        onTogglePinned={onTogglePinned}
                        onPreview={() => onPreview(index)}
                      />
                    ) : null,
                  )}
                </CommandGroup>
              </Fragment>
            ))}
          </CommandList>
          <aside className="hidden min-h-0 border-l border-border bg-muted/25 p-3 md:grid md:content-start md:gap-4">
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
              title="Saved insights"
              icon={Sparkles}
              links={savedInsightLinks}
              empty="Saved AI insights appear here."
              onNavigate={onNavigate}
            />
            <QuickLinkSection
              title="Recent items"
              icon={Clock3}
              links={recentLinks}
              empty="Recent pages appear here."
              onNavigate={onNavigate}
            />
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="focus-aaa grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 text-left text-sm font-semibold outline-none hover:border-primary/40 hover:bg-accent/60"
            >
              <Keyboard className="size-4 text-primary" aria-hidden />
              <span>Keyboard shortcuts</span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </button>
          </aside>
        </div>
      </Command>
    </CommandDialog>
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
    if (shouldLetBrowserHandleLink(event)) return;

    event.preventDefault();
    event.stopPropagation();
    onSelect(command);
  }

  return (
    <CommandMenuItem
      id={`command-palette-option-${index}`}
      aria-selected={active}
      value={[command.title, command.detail, command.href, command.group ?? ""].join(" ")}
      onSelect={() => onSelect(command)}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-stretch rounded-lg border bg-card/80 transition-[border-color,background-color,box-shadow] hover:border-primary/40 hover:bg-accent/60",
        active
          ? "border-primary/50 bg-primary/10 shadow-sm ring-1 ring-primary/20"
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
        <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
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
        <CommandShortcut className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden md:inline">{index + 1}</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </CommandShortcut>
      </Link>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onTogglePinned(command);
        }}
        className={cn(
          "focus-aaa grid min-h-14 w-12 place-items-center rounded-r-lg border-l border-border outline-none transition-colors hover:bg-primary/10",
          pinned ? "text-primary" : "text-muted-foreground",
        )}
        aria-label={pinned ? `Unpin ${command.title}` : `Pin ${command.title}`}
      >
        {pinned ? <Check className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
      </button>
    </CommandMenuItem>
  );
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
                if (shouldLetBrowserHandleLink(event)) return;
                event.preventDefault();
                onNavigate(link.href);
              }}
              className="focus-aaa grid gap-0.5 rounded-lg border border-border bg-card/75 px-3 py-2 outline-none hover:border-primary/40 hover:bg-accent/60"
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
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}
