"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type MutableRefObject,
  type Ref,
} from "react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  elementRef,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
}) {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot,
  );
  const separatorElementRef = useRef<HTMLDivElement | null>(null);
  const ensureAccessibleValues = useCallback((element: HTMLDivElement) => {
    // react-resizable-panels adds these after group registration. Keep the
    // focusable separator valid during the initial client commit as well.
    if (!element.hasAttribute("aria-valuemin")) element.setAttribute("aria-valuemin", "0");
    if (!element.hasAttribute("aria-valuemax")) element.setAttribute("aria-valuemax", "100");
    if (!element.hasAttribute("aria-valuenow")) element.setAttribute("aria-valuenow", "50");
  }, []);
  const accessibleElementRef = useCallback(
    (element: HTMLDivElement | null) => {
      separatorElementRef.current = element;
      if (element) ensureAccessibleValues(element);
      assignRef(elementRef, element);
    },
    [elementRef, ensureAccessibleValues],
  );

  useLayoutEffect(() => {
    const element = separatorElementRef.current;
    if (!element) return;

    ensureAccessibleValues(element);
    const observer = new MutationObserver(() => ensureAccessibleValues(element));
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["aria-valuemin", "aria-valuemax", "aria-valuenow"],
    });
    return () => observer.disconnect();
  }, [ensureAccessibleValues]);

  const handleClassName = cn(
    "relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
    className,
  );

  if (!mounted) {
    return (
      <div data-slot="resizable-handle-placeholder" className={handleClassName} aria-hidden="true">
        {withHandle ? <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" /> : null}
      </div>
    );
  }

  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      elementRef={accessibleElementRef}
      className={handleClassName}
      {...props}
    >
      {withHandle ? <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" /> : null}
    </ResizablePrimitive.Separator>
  );
}

function subscribeToHydration() {
  return () => undefined;
}

function getHydratedSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) {
    (ref as MutableRefObject<T | null>).current = value;
  }
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
