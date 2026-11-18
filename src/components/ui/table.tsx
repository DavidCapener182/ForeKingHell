"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Table({
  className,
  containerClassName,
  "aria-describedby": ariaDescribedBy,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  const viewport = React.useRef<HTMLDivElement>(null);
  const viewportId = React.useId();
  const [edges, setEdges] = React.useState({ left: false, right: false });
  const measure = React.useCallback(() => {
    const node = viewport.current;
    if (!node) return;
    const left = node.scrollLeft > 1;
    const right = node.scrollWidth - node.clientWidth - node.scrollLeft > 1;
    setEdges((old) => (old.left === left && old.right === right ? old : { left, right }));
  }, []);
  React.useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);
  function scrollColumns(direction: number) {
    const node = viewport.current;
    if (node) node.scrollBy({ left: direction * Math.max(1, node.clientWidth * 0.8) });
  }
  return (
    <>
      {(edges.left || edges.right) && (
        <div className="flex flex-wrap items-center justify-end gap-2 px-2 py-1 text-sm">
          <span className="mr-auto text-muted-foreground">
            More columns{" "}
            {edges.left && edges.right
              ? "in both directions"
              : edges.left
                ? "to the left"
                : "to the right"}
          </span>
          <button
            type="button"
            aria-label="Show previous columns"
            aria-controls={viewportId}
            disabled={!edges.left}
            onClick={() => scrollColumns(-1)}
            className="min-h-11 min-w-11 rounded-md border font-semibold disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Show next columns"
            aria-controls={viewportId}
            disabled={!edges.right}
            onClick={() => scrollColumns(1)}
            className="min-h-11 min-w-11 rounded-md border font-semibold disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
      <div
        ref={viewport}
        id={viewportId}
        onScroll={measure}
        data-slot="table-container"
        tabIndex={0}
        aria-label="Scrollable data table"
        aria-describedby={ariaDescribedBy}
        className={cn("data-table-scroll relative w-full overflow-x-auto", containerClassName)}
      >
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          aria-describedby={ariaDescribedBy}
          {...props}
        />
      </div>
    </>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

type TableRowProps = React.ComponentProps<"tr"> & {
  "data-state"?: string;
};

function TableRow({
  className,
  "aria-selected": ariaSelected,
  "aria-keyshortcuts": ariaKeyShortcuts,
  "data-state": dataState,
  tabIndex,
  ...props
}: TableRowProps) {
  const rowKeyShortcuts =
    tabIndex !== undefined ? "Enter Space ArrowDown ArrowUp Home End" : undefined;

  return (
    <tr
      data-slot="table-row"
      data-state={dataState}
      aria-selected={ariaSelected ?? (dataState === "selected" ? true : undefined)}
      aria-keyshortcuts={ariaKeyShortcuts ?? rowKeyShortcuts}
      tabIndex={tabIndex}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, scope = "col", ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn(
        "h-9 px-3 text-left align-middle font-semibold whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
