"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function openAppCommandMenu() {
  window.dispatchEvent(new Event("fkh:open-command-centre"));
}

export function AppCommandTrigger({ compact = false }: { compact?: boolean }) {
  return (
    <SidebarMenuButton
      type="button"
      size={compact ? "sm" : "default"}
      tooltip="Search LM World Tour (Command K or Ctrl K)"
      onClick={openAppCommandMenu}
      aria-label="Search LM World Tour, Command K or Control K"
      className={cn(
        "border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        compact && "h-8",
      )}
    >
      <Search className="size-4" aria-hidden />
      <span>Search</span>
      <Kbd className="ml-auto border-sidebar-border bg-sidebar text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
        ⌘K
      </Kbd>
    </SidebarMenuButton>
  );
}

export function AppCommandContentTrigger({
  label = "Search actions",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={openAppCommandMenu}
      className={cn("min-h-11 justify-start gap-2 text-muted-foreground", className)}
    >
      <Search className="size-4" aria-hidden />
      <span>{label}</span>
      <Kbd className="ml-auto">⌘K</Kbd>
    </Button>
  );
}
