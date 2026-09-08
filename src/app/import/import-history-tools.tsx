"use client";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import type { DesktopWorkbenchControls } from "@/components/app/desktop-workbench-controls";
type ToolsComponent = typeof DesktopWorkbenchControls;

/** Load the complete table tools when their history section approaches the viewport. */
export function ImportHistoryTools(props: ComponentProps<ToolsComponent>) {
  const root = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const requested = useRef(false);
  const restoreFocus = useRef(false);
  const [Tools, setTools] = useState<ToolsComponent | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    setFailed(false);
    setLoading(true);
    void import("@/components/app/desktop-workbench-controls")
      .then((module) => {
        if (alive.current) setTools(() => module.DesktopWorkbenchControls);
      })
      .catch(() => {
        requested.current = false;
        if (alive.current) setFailed(true);
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
  }, []);
  useEffect(() => {
    alive.current = true;
    if (!window.IntersectionObserver) load();
    const observer = window.IntersectionObserver
      ? new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              load();
              observer?.disconnect();
            }
          },
          { rootMargin: "400px" },
        )
      : null;
    if (root.current) observer?.observe(root.current);
    return () => {
      alive.current = false;
      observer?.disconnect();
    };
  }, [load]);
  useEffect(() => {
    if (!Tools || !restoreFocus.current || !root.current) return;
    // Saved-view controls hydrate their stored preferences after mounting.
    // Restore focus only once the first control is enabled.
    const container = root.current;
    const focusControl = () => {
      const button = container.querySelector<HTMLButtonElement>("button");
      if (!button || button.disabled) return false;
      button.focus();
      restoreFocus.current = false;
      return true;
    };
    if (focusControl()) return;
    const observer = new MutationObserver(() => {
      if (focusControl()) observer.disconnect();
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    return () => observer.disconnect();
  }, [Tools]);
  return (
    <div ref={root} className="min-h-14" data-import-history-tools>
      {Tools ? (
        <Tools {...props} />
      ) : (
        <div className="mb-3 flex min-h-11 items-center gap-3">
          <button
            type="button"
            className="min-h-11 rounded-lg border px-3 text-sm font-medium"
            disabled={loading}
            onClick={() => {
              restoreFocus.current = true;
              load();
            }}
          >
            {failed ? "Retry file tools" : "Load file tools"}
          </button>
          {loading ? (
            <p role="status" className="text-sm">
              Loading saved views, columns and export…
            </p>
          ) : null}
          {failed ? (
            <p role="alert" className="text-sm">
              File tools could not load. Retry to continue.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
