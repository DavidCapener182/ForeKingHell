import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const shellWidths = {
  "6xl": "max-w-none",
  "7xl": "max-w-none",
  wide: "max-w-none",
  full: "max-w-none",
};

type PageShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  size?: keyof typeof shellWidths;
};

export function PageShell({
  children,
  className,
  contentClassName,
  size = "full",
}: PageShellProps) {
  return (
    <main
      id="main-content"
      suppressHydrationWarning
      className={cn(
        "min-h-screen px-4 py-4 pb-[calc(8.75rem+env(safe-area-inset-bottom))] text-foreground sm:px-6 sm:pt-6 lg:px-8 lg:pb-8",
        className,
      )}
    >
      <div
        className={cn(
          // Keep app content full-width; see AGENTS.md layout contract.
          "mx-auto flex min-w-0 w-full flex-col gap-4 sm:gap-5 lg:gap-6 [&>*]:min-w-0",
          shellWidths[size],
          contentClassName,
          "!max-w-none",
        )}
      >
        {children}
      </div>
    </main>
  );
}
