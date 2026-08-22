"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  Columns3,
  Copy,
  Download,
  LayoutDashboard,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveVisibleColumnIds } from "@/components/app/desktop-workbench-columns";
import { csvCell } from "@/lib/csv";
import { cn } from "@/lib/utils";

export type DesktopWorkbenchColumn = {
  id: string;
  label: string;
  locked?: boolean;
};

export type DesktopSavedViewSuggestion = {
  title: string;
  href: string;
  detail: string;
};

type SavedView = DesktopSavedViewSuggestion & {
  id: string;
  createdAt: string;
  density?: "comfortable" | "compact";
  visibleColumnIds?: string[];
};

type DesktopWorkbenchControlsProps = {
  viewKey: string;
  scope: string;
  currentViewLabel: string;
  resultLabel: string;
  columns: DesktopWorkbenchColumn[];
  suggestedViews?: DesktopSavedViewSuggestion[];
  exportTableId?: string;
  exportFileName?: string;
  className?: string;
};

const densityStorageKey = "fkh:desktop-workbench-density";
export const desktopSavedViewsUpdatedEvent = "fkh:desktop-saved-views-updated";

export function DesktopWorkbenchControls({
  viewKey,
  scope,
  currentViewLabel,
  resultLabel,
  columns,
  suggestedViews = [],
  exportTableId = scope,
  exportFileName = `${scope}-view.csv`,
  className,
}: DesktopWorkbenchControlsProps) {
  const savedViewsKey = `fkh:saved-views:${viewKey}`;
  const visibleColumnsKey = `fkh:visible-columns:${viewKey}`;
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(
    () => new Set(columns.map((column) => column.id)),
  );
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [exportStatus, setExportStatus] = useState<"idle" | "done" | "missing">("idle");
  const [copyStatus, setCopyStatus] = useState<"idle" | "done" | "failed">("idle");
  const [layoutStatusMessage, setLayoutStatusMessage] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [draftSavedViewTitle, setDraftSavedViewTitle] = useState(currentViewLabel);
  const layoutStatusTimerRef = useRef<number | null>(null);
  const saveViewTitleId = useId();
  const storageSignature = useMemo(
    () => `${savedViewsKey}:${visibleColumnsKey}:${columns.map((column) => column.id).join("|")}`,
    [columns, savedViewsKey, visibleColumnsKey],
  );
  const [hydratedStorageSignature, setHydratedStorageSignature] = useState<string | null>(null);
  const hydrated = hydratedStorageSignature === storageSignature;

  const visibleCount = visibleColumnIds.size;
  const exportStatusMessage =
    exportStatus === "done"
      ? `Exported ${exportFileName}.`
      : exportStatus === "missing"
        ? "No exportable table found for this view."
        : "";
  const copyStatusMessage =
    copyStatus === "done"
      ? "Current view link copied."
      : copyStatus === "failed"
        ? "Current view link could not be copied."
        : "";
  const actionStatusMessage = [exportStatusMessage, copyStatusMessage, layoutStatusMessage]
    .filter(Boolean)
    .join(" ");
  const lockedIds = useMemo(
    () => new Set(columns.filter((column) => column.locked).map((column) => column.id)),
    [columns],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSavedViews(readJson<SavedView[]>(savedViewsKey, []));

      const storedVisible = readJson<string[]>(
        visibleColumnsKey,
        columns.map((column) => column.id),
      );
      const nextVisible = resolveVisibleColumnIds(columns, storedVisible);
      setVisibleColumnIds(new Set(nextVisible));

      const storedDensity = window.localStorage.getItem(densityStorageKey);
      setDensity(storedDensity === "compact" ? "compact" : "comfortable");
      setHydratedStorageSignature(storageSignature);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [columns, savedViewsKey, storageSignature, visibleColumnsKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(visibleColumnsKey, JSON.stringify(Array.from(visibleColumnIds)));

    const styleId = `fkh-workbench-columns-${viewKey}`;
    let style = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    const hiddenRules = columns
      .filter((column) => !visibleColumnIds.has(column.id))
      .map(
        (column) =>
          `[data-workbench-scope="${cssAttribute(scope)}"] [data-column="${cssAttribute(
            column.id,
          )}"] { display: none !important; }`,
      );

    style.textContent = hiddenRules.join("\n");

    return () => {
      style?.remove();
    };
  }, [columns, hydrated, scope, viewKey, visibleColumnIds, visibleColumnsKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    document.documentElement.dataset.tableDensity = density;
    window.localStorage.setItem(densityStorageKey, density);
  }, [density, hydrated]);

  useEffect(() => {
    return () => {
      if (layoutStatusTimerRef.current !== null) {
        window.clearTimeout(layoutStatusTimerRef.current);
      }
    };
  }, []);

  function openSaveCurrentViewDialog() {
    setDraftSavedViewTitle(currentViewLabel || "Current view");
    setSaveDialogOpen(true);
  }

  function announceLayoutStatus(message: string) {
    if (layoutStatusTimerRef.current !== null) {
      window.clearTimeout(layoutStatusTimerRef.current);
    }

    setLayoutStatusMessage(message);
    layoutStatusTimerRef.current = window.setTimeout(() => {
      setLayoutStatusMessage("");
      layoutStatusTimerRef.current = null;
    }, 2200);
  }

  function saveCurrentView(titleValue = draftSavedViewTitle) {
    const title = titleValue.trim();
    if (!title) {
      return;
    }

    const savedAt = new Date();
    const savedAtIso = savedAt.toISOString();
    const view: SavedView = {
      id: savedAtIso,
      title: title.slice(0, 80),
      href: `${window.location.pathname}${window.location.search}`,
      detail: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(savedAt),
      createdAt: savedAtIso,
      density,
      visibleColumnIds: Array.from(visibleColumnIds),
    };
    const next = [view, ...savedViews.filter((saved) => saved.href !== view.href)].slice(0, 10);
    setSavedViews(next);
    window.localStorage.setItem(savedViewsKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(desktopSavedViewsUpdatedEvent));
    announceLayoutStatus(`Saved table view ${view.title}.`);
    setSaveDialogOpen(false);
  }

  function applySavedView(view: SavedView) {
    let appliedColumnCount: number | null = null;
    let appliedDensity: "comfortable" | "compact" | null = null;

    if (view.visibleColumnIds?.length) {
      const nextVisible = resolveVisibleColumnIds(columns, view.visibleColumnIds);

      if (nextVisible.length > 0) {
        setVisibleColumnIds(new Set(nextVisible));
        window.localStorage.setItem(visibleColumnsKey, JSON.stringify(nextVisible));
        appliedColumnCount = nextVisible.length;
      }
    }

    if (view.density === "compact" || view.density === "comfortable") {
      setDensity(view.density);
      window.localStorage.setItem(densityStorageKey, view.density);
      appliedDensity = view.density;
    }

    if (appliedColumnCount !== null || appliedDensity !== null) {
      announceLayoutStatus(
        [
          appliedColumnCount === null
            ? null
            : `Applied saved view with ${appliedColumnCount} visible columns.`,
          appliedDensity === null ? null : `${appliedDensity} density.`,
        ]
          .filter(Boolean)
          .join(" "),
      );
    }
  }

  function removeSavedView(id: string) {
    const removed = savedViews.find((view) => view.id === id);
    const next = savedViews.filter((view) => view.id !== id);
    setSavedViews(next);
    window.localStorage.setItem(savedViewsKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(desktopSavedViewsUpdatedEvent));
    announceLayoutStatus(removed ? `Removed saved view ${removed.title}.` : "Saved view removed.");
  }

  function toggleColumn(id: string, checked: boolean) {
    if (lockedIds.has(id)) {
      return;
    }

    setVisibleColumnIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(id);
      } else if (next.size > 1) {
        next.delete(id);
      }

      announceLayoutStatus(`${next.size} of ${columns.length} columns visible.`);
      return next;
    });
  }

  function resetColumns() {
    setVisibleColumnIds(new Set(columns.map((column) => column.id)));
    announceLayoutStatus(`All ${columns.length} columns shown.`);
  }

  function resetTableLayout() {
    const allColumnIds = columns.map((column) => column.id);

    setVisibleColumnIds(new Set(allColumnIds));
    setDensity("comfortable");
    window.localStorage.setItem(visibleColumnsKey, JSON.stringify(allColumnIds));
    window.localStorage.setItem(densityStorageKey, "comfortable");
    announceLayoutStatus("Table layout reset to all columns and comfortable density.");
  }

  function updateDensity(nextDensity: "comfortable" | "compact") {
    setDensity(nextDensity);
    announceLayoutStatus(`Table density set to ${nextDensity}.`);
  }

  function exportCurrentTable() {
    const table = document.querySelector<HTMLTableElement>(
      `table[data-workbench-export-table="${cssAttribute(exportTableId)}"]`,
    );

    if (!table) {
      setExportStatus("missing");
      window.setTimeout(() => setExportStatus("idle"), 2200);
      return;
    }

    const csv = tableToCsv(table);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportFileName;
    anchor.click();
    URL.revokeObjectURL(url);
    setExportStatus("done");
    window.setTimeout(() => setExportStatus("idle"), 2200);
  }

  async function copyCurrentViewLink() {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("done");
    } catch {
      setCopyStatus("failed");
    }

    window.setTimeout(() => setCopyStatus("idle"), 2200);
  }

  return (
    <>
      <div
        className={cn(
          "hidden min-w-0 flex-wrap items-center justify-start gap-3 rounded-lg border border-primary/10 bg-card/88 px-3 py-2 shadow-sm sm:flex",
          className,
        )}
        data-desktop-workbench-toolbar
        data-workbench-controls-hydrated={hydrated ? "true" : "false"}
        data-filter-toolbar
      >
        <div className="min-w-0 flex-[1_1_14rem]">
          <div className="flex min-w-0 items-center gap-2">
            <LayoutDashboard className="size-4 text-primary" aria-hidden />
            <p className="truncate text-sm font-semibold text-foreground">{currentViewLabel}</p>
            <Badge variant="secondary" className="hidden lg:inline-flex">
              {resultLabel}
            </Badge>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_26rem] flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-filter-control
                disabled={!hydrated}
              >
                <Save className="size-4" />
                Saved views
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Current workspace</DropdownMenuLabel>
              <DropdownMenuItem onSelect={openSaveCurrentViewDialog}>
                <Save className="size-4" />
                Save current view
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Your saved views</DropdownMenuLabel>
              {savedViews.length > 0 ? (
                savedViews.map((view) => (
                  <div key={view.id} className="grid gap-0.5">
                    <DropdownMenuItem asChild>
                      <Link
                        href={view.href}
                        prefetch={false}
                        className="grid gap-0.5"
                        onClick={() => applySavedView(view)}
                      >
                        <span className="font-medium">{view.title}</span>
                        <span className="text-xs text-muted-foreground">{view.detail}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(event) => {
                        event.preventDefault();
                        removeSavedView(view.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Remove {view.title}
                    </DropdownMenuItem>
                  </div>
                ))
              ) : (
                <div className="px-1.5 py-1 text-sm text-muted-foreground">
                  Saved filters and table views appear here.
                </div>
              )}
              {suggestedViews.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>AI suggested filters</DropdownMenuLabel>
                  {suggestedViews.map((view) => (
                    <DropdownMenuItem key={`${view.title}-${view.href}`} asChild>
                      <Link href={view.href} prefetch={false} className="grid gap-0.5">
                        <span className="font-medium">{view.title}</span>
                        <span className="text-xs text-muted-foreground">{view.detail}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-filter-control
                disabled={!hydrated}
              >
                <Columns3 className="size-4" />
                Columns
                <span className="hidden text-xs text-muted-foreground xl:inline">
                  {visibleCount}/{columns.length}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Column control</DropdownMenuLabel>
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={visibleColumnIds.has(column.id)}
                  disabled={column.locked}
                  onCheckedChange={(checked) => toggleColumn(column.id, checked === true)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {column.label}
                  {column.locked ? (
                    <span className="ml-auto text-xs text-muted-foreground">Pinned</span>
                  ) : null}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={resetColumns}>
                <Check className="size-4" />
                Show all columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-filter-control
                disabled={!hydrated}
              >
                <SlidersHorizontal className="size-4" />
                Density
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Table density</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={density === "comfortable"}
                onCheckedChange={() => updateDensity("comfortable")}
              >
                Comfortable
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={density === "compact"}
                onCheckedChange={() => updateDensity("compact")}
              >
                Compact
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={resetTableLayout}>
                <LayoutDashboard className="size-4" />
                Reset table layout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCurrentTable}
            disabled={!hydrated}
            data-export-current-view
            data-export-table-id={exportTableId}
          >
            <span
              className="t-icon-swap"
              data-state={exportStatus === "done" ? "b" : "a"}
              aria-hidden="true"
            >
              <span className="t-icon" data-icon="a">
                <Download className="size-4" />
              </span>
              <span className="t-icon" data-icon="b">
                <Check className="size-4" />
              </span>
            </span>
            <span
              key={exportStatus}
              className="t-text-state"
              data-motion-ready={exportStatus !== "idle" ? "true" : "false"}
            >
              {exportStatus === "done"
                ? "Exported"
                : exportStatus === "missing"
                  ? "No table"
                  : "Export"}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyCurrentViewLink()}
            disabled={!hydrated}
            data-copy-current-view
          >
            <span
              className="t-icon-swap"
              data-state={copyStatus === "done" ? "b" : "a"}
              aria-hidden="true"
            >
              <span className="t-icon" data-icon="a">
                <Copy className="size-4" />
              </span>
              <span className="t-icon" data-icon="b">
                <Check className="size-4" />
              </span>
            </span>
            <span
              key={copyStatus}
              className="t-text-state"
              data-motion-ready={copyStatus !== "idle" ? "true" : "false"}
            >
              {copyStatus === "done"
                ? "Copied"
                : copyStatus === "failed"
                  ? "Copy failed"
                  : "Copy link"}
            </span>
          </Button>
          <span
            className="sr-only"
            aria-live="polite"
            aria-atomic="true"
            data-workbench-action-status
          >
            {actionStatusMessage}
          </span>
          <span
            className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground 2xl:inline-flex"
            aria-label="Table row shortcuts: arrow keys move rows, Enter or Space selects the focused row"
            data-table-row-shortcuts
          >
            <span className="font-semibold text-foreground">Rows</span>
            <Kbd className="bg-card">Up/Down</Kbd>
            <span>move</span>
            <Kbd className="bg-card">Enter</Kbd>
            <span>select</span>
          </span>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save table view</DialogTitle>
            <DialogDescription>
              Save the current columns, density and filters for this desktop workspace.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveCurrentView();
            }}
          >
            <label className="grid gap-2 text-sm font-medium" htmlFor={saveViewTitleId}>
              View name
              <Input
                id={saveViewTitleId}
                value={draftSavedViewTitle}
                onChange={(event) => setDraftSavedViewTitle(event.target.value)}
                maxLength={80}
                autoFocus
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!draftSavedViewTitle.trim()}>
                Save view
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function tableToCsv(table: HTMLTableElement) {
  const rows = Array.from(table.querySelectorAll("tr"));

  return rows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll<HTMLTableCellElement>("th,td")).filter(
        (cell) => getComputedStyle(cell).display !== "none",
      );

      return cells.map((cell) => csvCell(cell.innerText)).join(",");
    })
    .join("\n");
}

function cssAttribute(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
