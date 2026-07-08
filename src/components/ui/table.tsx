"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Table({
  className,
  containerClassName,
  "aria-describedby": ariaDescribedBy,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div
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

function TableRow({
  className,
  "aria-selected": ariaSelected,
  "aria-keyshortcuts": ariaKeyShortcuts,
  "data-state": dataState,
  tabIndex,
  ...props
}: React.ComponentProps<"tr">) {
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
