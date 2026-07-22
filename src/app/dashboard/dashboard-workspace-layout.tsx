"use client";

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Columns3,
  Eye,
  EyeOff,
  LayoutDashboard,
  MonitorUp,
  RotateCcw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/utils";

export type DashboardWorkspacePanelId =
  | "practice-plan"
  | "coach-priority"
  | "driver-status"
  | "performance-snapshot"
  | "scoring-zones"
  | "course-decisions"
  | "latest-practice"
  | "environment-baseline"
  | "plays-like"
  | "bag-confidence"
  | "latest-round"
  | "action-centre"
  | "social-tools";

export type DashboardWorkspaceMode = "standard" | "executive" | "analysis-wall";

export type DashboardWorkspacePanelConfig = {
  id: DashboardWorkspacePanelId;
  label: string;
  detail: string;
  executive?: boolean;
};

type DashboardWorkspaceSettings = {
  hidden: DashboardWorkspacePanelId[];
  mode: DashboardWorkspaceMode;
  order: DashboardWorkspacePanelId[];
};

type DashboardWorkspaceProps = {
  children: ReactNode;
  panels: DashboardWorkspacePanelConfig[];
};

type DashboardWorkspacePanelProps = {
  children: ReactNode;
  className?: string;
  htmlId?: string;
  panelId: DashboardWorkspacePanelId;
  span: 4 | 8 | 12;
};

const storageKey = "fkh:dashboard-workspace-layout:v1";
const DashboardWorkspaceModeContext = createContext<DashboardWorkspaceMode>("standard");

export function DashboardWorkspace({ children, panels }: DashboardWorkspaceProps) {
  const defaultSettings = useMemo(() => defaultDashboardSettings(panels), [panels]);
  const [settings, setSettings] = useState<DashboardWorkspaceSettings>(defaultSettings);
  const [hydrated, setHydrated] = useState(false);
  const [layoutStatusMessage, setLayoutStatusMessage] = useState("");
  const layoutStatusTimerRef = useRef<number | null>(null);
  const validIds = useMemo(() => new Set(panels.map((panel) => panel.id)), [panels]);
  const childByPanelId = useMemo(() => mapChildrenByPanelId(children), [children]);
  const panelById = useMemo(() => new Map(panels.map((panel) => [panel.id, panel])), [panels]);
  const orderedIds = useMemo(
    () =>
      normalizeOrder(
        settings.order,
        panels.map((panel) => panel.id),
      ),
    [panels, settings.order],
  );
  const hiddenIds = useMemo(
    () => new Set(settings.hidden.filter((id) => validIds.has(id))),
    [settings.hidden, validIds],
  );
  const visibleIds = orderedIds.filter((id) => {
    if (hiddenIds.has(id)) {
      return false;
    }

    if (settings.mode === "executive" && !panelById.get(id)?.executive) {
      return false;
    }

    return childByPanelId.has(id);
  });
  const customHiddenCount = panels.filter((panel) => hiddenIds.has(panel.id)).length;
  const modeHiddenCount =
    hydrated && settings.mode === "executive"
      ? panels.filter((panel) => !panel.executive && !hiddenIds.has(panel.id)).length
      : 0;
  const visiblePanelCount = hydrated ? visibleIds.length : panels.length;
  const controlIds = hydrated ? orderedIds : panels.map((panel) => panel.id);
  const controlPanelIds = controlIds.filter((panelId) => {
    const panel = panelById.get(panelId);
    return Boolean(panel && (!hydrated || childByPanelId.has(panelId)));
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettings(readDashboardSettings(defaultSettings, panels));
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [defaultSettings, panels]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [hydrated, settings]);

  useEffect(() => {
    return () => {
      if (layoutStatusTimerRef.current !== null) {
        window.clearTimeout(layoutStatusTimerRef.current);
      }
    };
  }, []);

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

  function setMode(mode: DashboardWorkspaceMode) {
    setSettings({ ...settings, mode });
    announceLayoutStatus(`Dashboard layout set to ${mode.replace("-", " ")} mode.`);
  }

  function togglePanel(panelId: DashboardWorkspacePanelId) {
    const panel = panelById.get(panelId);
    const hidden = new Set(settings.hidden);

    if (hidden.has(panelId)) {
      hidden.delete(panelId);
      setSettings({ ...settings, hidden: [...hidden] });
      announceLayoutStatus(`${panel?.label ?? "Panel"} shown.`);
      return;
    }

    const visibleCustomCount = panels.filter((item) => !hidden.has(item.id)).length;
    if (visibleCustomCount <= 1) {
      announceLayoutStatus("Keep at least one dashboard panel visible.");
      return;
    }

    hidden.add(panelId);
    setSettings({ ...settings, hidden: [...hidden] });
    announceLayoutStatus(`${panel?.label ?? "Panel"} hidden.`);
  }

  function movePanel(panelId: DashboardWorkspacePanelId, direction: -1 | 1) {
    const panel = panelById.get(panelId);
    const order = normalizeOrder(
      settings.order,
      panels.map((item) => item.id),
    );
    const index = order.indexOf(panelId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
      return;
    }

    const nextOrder = [...order];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    setSettings({ ...settings, order: nextOrder });
    announceLayoutStatus(
      `${panel?.label ?? "Panel"} moved ${direction < 0 ? "earlier" : "later"}.`,
    );
  }

  function resetLayout() {
    setSettings(defaultSettings);
    announceLayoutStatus("Dashboard layout reset.");
  }

  return (
    <DashboardWorkspaceModeContext.Provider value={settings.mode}>
      <details
        className="premium-card group rounded-lg border border-border bg-card/82 shadow-sm"
        data-dashboard-layout-controls
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span id="dashboard-layout-controls-title" className="block text-sm font-semibold">
                Dashboard layout
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {visiblePanelCount} visible panels
                {hydrated && customHiddenCount > 0 ? ` · ${customHiddenCount} hidden` : ""}
                {modeHiddenCount > 0 ? ` · ${modeHiddenCount} folded into executive mode` : ""}
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {settings.mode.replace("-", " ")}
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground">Customise</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <div className="grid gap-3 border-t border-border p-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Workspace mode</p>
              <p className="text-xs text-muted-foreground">
                Choose the dashboard density, then reorder or hide individual panels.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ButtonGroup>
                <Button
                  type="button"
                  variant={settings.mode === "standard" ? "default" : "outline"}
                  size="sm"
                  aria-pressed={settings.mode === "standard"}
                  onClick={() => setMode("standard")}
                >
                  <Columns3 className="size-4" aria-hidden />
                  Standard
                </Button>
                <Button
                  type="button"
                  variant={settings.mode === "executive" ? "default" : "outline"}
                  size="sm"
                  aria-pressed={settings.mode === "executive"}
                  onClick={() => setMode("executive")}
                >
                  <Eye className="size-4" aria-hidden />
                  Executive
                </Button>
                <Button
                  type="button"
                  variant={settings.mode === "analysis-wall" ? "default" : "outline"}
                  size="sm"
                  aria-pressed={settings.mode === "analysis-wall"}
                  onClick={() => setMode("analysis-wall")}
                >
                  <MonitorUp className="size-4" aria-hidden />
                  Wall
                </Button>
              </ButtonGroup>
              <Button type="button" variant="outline" size="sm" onClick={resetLayout}>
                <RotateCcw className="size-4" aria-hidden />
                Reset
              </Button>
            </div>
          </div>

          <div
            className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5"
            data-dashboard-panel-controls
          >
            {controlPanelIds.map((panelId, controlIndex) => {
              const panel = panelById.get(panelId);
              if (!panel) {
                return null;
              }

              const hidden = hiddenIds.has(panelId);
              const folded = settings.mode === "executive" && !panel.executive && !hidden;
              const firstPanel = controlIndex === 0;
              const lastPanel = controlIndex === controlPanelIds.length - 1;

              return (
                <div
                  key={panelId}
                  className={cn(
                    "grid min-h-20 gap-2 rounded-lg border bg-card/72 p-2 text-sm shadow-sm",
                    hidden || folded ? "border-dashed text-muted-foreground" : "border-border",
                  )}
                  data-dashboard-panel-control={panelId}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{panel.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {hidden ? "Hidden" : folded ? "Executive folded" : panel.detail}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => movePanel(panelId, -1)}
                        disabled={firstPanel}
                        aria-label={`Move ${panel.label} earlier`}
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => movePanel(panelId, 1)}
                        disabled={lastPanel}
                        aria-label={`Move ${panel.label} later`}
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant={hidden ? "outline" : "secondary"}
                      size="sm"
                      onClick={() => togglePanel(panelId)}
                      aria-pressed={!hidden}
                    >
                      {hidden ? (
                        <Eye className="size-4" aria-hidden />
                      ) : (
                        <EyeOff className="size-4" aria-hidden />
                      )}
                      {hidden ? "Show" : "Hide"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {layoutStatusMessage}
          </span>
        </div>
      </details>

      <div
        className={cn(
          "@container/dashboard-workspace grid auto-rows-auto items-stretch",
          settings.mode === "executive" ? "gap-3" : "gap-5",
          settings.mode === "analysis-wall" ? "2xl:gap-6" : null,
        )}
        data-dashboard-bento-grid
        data-dashboard-mode={settings.mode}
        style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}
      >
        {hydrated ? visibleIds.map((panelId) => childByPanelId.get(panelId)) : children}
      </div>
    </DashboardWorkspaceModeContext.Provider>
  );
}

export function DashboardWorkspacePanel({
  children,
  className,
  htmlId,
  panelId,
  span,
}: DashboardWorkspacePanelProps) {
  const mode = useContext(DashboardWorkspaceModeContext);

  return (
    <div
      className={cn(
        "@container/dashboard-panel col-span-12 h-full min-w-0 [&>*]:h-full",
        dashboardPanelSpanClass(span),
        mode === "executive" ? "[&_[data-slot=card]]:shadow-sm" : null,
        mode === "analysis-wall" ? "2xl:[&_[data-slot=card]]:min-h-full" : null,
        className,
      )}
      data-dashboard-panel={panelId}
      id={htmlId}
    >
      {children}
    </div>
  );
}

function dashboardPanelSpanClass(span: DashboardWorkspacePanelProps["span"]) {
  if (span === 4) {
    return "@[56rem]/dashboard-workspace:col-span-6 @[100rem]/dashboard-workspace:col-span-4";
  }

  if (span === 8) {
    return "@[100rem]/dashboard-workspace:col-span-8";
  }

  return "";
}

function defaultDashboardSettings(
  panels: DashboardWorkspacePanelConfig[],
): DashboardWorkspaceSettings {
  return {
    hidden: [],
    mode: "standard",
    order: panels.map((panel) => panel.id),
  };
}

function readDashboardSettings(
  fallback: DashboardWorkspaceSettings,
  panels: DashboardWorkspacePanelConfig[],
) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<DashboardWorkspaceSettings>;
    const validIds = new Set(panels.map((panel) => panel.id));
    const mode: DashboardWorkspaceMode =
      parsed.mode === "executive" || parsed.mode === "analysis-wall" ? parsed.mode : "standard";

    return {
      hidden: Array.isArray(parsed.hidden)
        ? parsed.hidden.filter((id): id is DashboardWorkspacePanelId =>
            validIds.has(id as DashboardWorkspacePanelId),
          )
        : [],
      mode,
      order: normalizeOrder(
        Array.isArray(parsed.order)
          ? parsed.order.filter((id): id is DashboardWorkspacePanelId =>
              validIds.has(id as DashboardWorkspacePanelId),
            )
          : [],
        panels.map((panel) => panel.id),
      ),
    };
  } catch {
    return fallback;
  }
}

function normalizeOrder(
  currentOrder: DashboardWorkspacePanelId[],
  defaultOrder: DashboardWorkspacePanelId[],
) {
  const validIds = new Set(defaultOrder);
  const nextOrder = currentOrder.filter((id) => validIds.has(id));

  for (const id of defaultOrder) {
    if (!nextOrder.includes(id)) {
      nextOrder.push(id);
    }
  }

  return nextOrder;
}

function mapChildrenByPanelId(children: ReactNode) {
  const childrenByPanelId = new Map<DashboardWorkspacePanelId, ReactNode>();

  for (const child of toChildArray(children)) {
    if (!isDashboardPanelElement(child)) {
      continue;
    }

    childrenByPanelId.set(child.props.panelId, child);
  }

  return childrenByPanelId;
}

function toChildArray(children: ReactNode) {
  return Children.toArray(children);
}

function isDashboardPanelElement(
  child: ReactNode,
): child is ReactElement<{ panelId: DashboardWorkspacePanelId }> {
  return (
    isValidElement<{ panelId: DashboardWorkspacePanelId }>(child) && Boolean(child.props.panelId)
  );
}
