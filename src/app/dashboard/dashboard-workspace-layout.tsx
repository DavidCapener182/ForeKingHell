"use client";

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
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

  function setMode(mode: DashboardWorkspaceMode) {
    setSettings((current) => ({ ...current, mode }));
  }

  function togglePanel(panelId: DashboardWorkspacePanelId) {
    setSettings((current) => {
      const hidden = new Set(current.hidden);
      if (hidden.has(panelId)) {
        hidden.delete(panelId);
      } else {
        const visibleCustomCount = panels.filter((panel) => !hidden.has(panel.id)).length;
        if (visibleCustomCount <= 1) {
          return current;
        }
        hidden.add(panelId);
      }

      return { ...current, hidden: [...hidden] };
    });
  }

  function movePanel(panelId: DashboardWorkspacePanelId, direction: -1 | 1) {
    setSettings((current) => {
      const order = normalizeOrder(
        current.order,
        panels.map((panel) => panel.id),
      );
      const index = order.indexOf(panelId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
        return current;
      }

      const nextOrder = [...order];
      [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
      return { ...current, order: nextOrder };
    });
  }

  function resetLayout() {
    setSettings(defaultSettings);
  }

  return (
    <DashboardWorkspaceModeContext.Provider value={settings.mode}>
      <section
        aria-labelledby="dashboard-layout-controls-title"
        className="premium-card grid gap-3 rounded-lg border border-emerald-900/10 bg-white/82 p-3 shadow-sm"
        data-dashboard-layout-controls
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <LayoutDashboard className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id="dashboard-layout-controls-title" className="text-sm font-semibold">
                  Dashboard layout
                </h2>
                <p className="text-xs text-muted-foreground">
                  {visiblePanelCount} visible panels
                  {hydrated && customHiddenCount > 0 ? ` · ${customHiddenCount} hidden` : ""}
                  {modeHiddenCount > 0 ? ` · ${modeHiddenCount} folded into executive mode` : ""}
                </p>
              </div>
              <Badge variant="outline" className="ml-auto capitalize sm:ml-0">
                {settings.mode.replace("-", " ")}
              </Badge>
            </div>
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
          {controlIds.map((panelId) => {
            const panel = panelById.get(panelId);
            if (!panel || (hydrated && !childByPanelId.has(panelId))) {
              return null;
            }

            const hidden = hiddenIds.has(panelId);
            const folded = settings.mode === "executive" && !panel.executive && !hidden;

            return (
              <div
                key={panelId}
                className={cn(
                  "grid min-h-20 gap-2 rounded-lg border bg-white/72 p-2 text-sm shadow-sm",
                  hidden || folded ? "border-dashed text-muted-foreground" : "border-emerald-100",
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
                      aria-label={`Move ${panel.label} earlier`}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => movePanel(panelId, 1)}
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
      </section>

      <div
        className={cn(
          "@container/dashboard-workspace grid auto-rows-auto items-start",
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
        "@container/dashboard-panel col-span-12 min-w-0",
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
