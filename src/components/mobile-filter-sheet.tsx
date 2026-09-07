import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ActiveFilterChips } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerClose,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function MobileFilterSheet({
  children,
  label = "Filter",
  activeCount = 0,
  className,
}: {
  children: ReactNode;
  label?: string;
  activeCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("lg:hidden", className)}>
      <Drawer>
        <DrawerTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "premium-command-surface min-h-11 w-full justify-center rounded-lg shadow-sm",
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {label}
          {activeCount > 0 ? (
            <Badge variant="secondary" className="ml-1 rounded-full px-1.5 py-0 text-[11px]">
              {activeCount}
            </Badge>
          ) : null}
        </DrawerTrigger>
        <DrawerContent className="max-h-[86dvh]">
          <DrawerHeader className="text-left">
            <div className="flex items-center justify-between gap-3">
              <DrawerTitle>{label}</DrawerTitle>
              <DrawerClose className="min-h-11 min-w-11 px-2 text-sm font-semibold text-primary">
                Done
              </DrawerClose>
            </div>
            <DrawerDescription>Refine the current view without leaving the page.</DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="overflow-y-auto px-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
            {children}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export function MobileFilterCommandSheet({
  children,
  chips,
  label = "Filter",
  activeCount,
  className,
}: {
  children: ReactNode;
  chips?: Array<{ label: string; href?: string }>;
  label?: string;
  activeCount?: number;
  className?: string;
}) {
  const count = activeCount ?? chips?.length ?? 0;

  return (
    <div className={cn("grid gap-3 lg:hidden", className)}>
      <MobileFilterSheet label={label} activeCount={count}>
        {children}
      </MobileFilterSheet>
      {chips?.length ? <ActiveFilterChips items={chips} /> : null}
    </div>
  );
}
