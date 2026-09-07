import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import surfaceStyles from "./surface-visibility.module.css";

type MobileAppShellProps = ComponentProps<"section">;

export function MobileAppShell({ children, className, ...props }: MobileAppShellProps) {
  return (
    <section
      {...props}
      className={cn(
        "ios-mobile-screen -mx-4 -mt-4 min-h-0 content-start overflow-x-clip px-4 pb-0 pt-3 text-foreground sm:-mx-6 sm:px-6 [&>*]:min-w-0",
        surfaceStyles.companionScreen,
        className,
      )}
    >
      {children}
    </section>
  );
}
type MobileTopBarProps = {
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function MobileTopBar({ title, leading, actions, className }: MobileTopBarProps) {
  return (
    <header className={cn("ios-large-title min-w-0", className)}>
      <div className="min-w-0">
        {leading ? <div className="mb-1 flex min-w-0 items-center gap-1.5">{leading}</div> : null}
        <h1 className="min-w-0 break-words" data-mobile-route-label>
          {title}
        </h1>
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1.5">{actions}</div>
    </header>
  );
}
