"use client";

import { useState } from "react";
import Link from "next/link";
import { Brain, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({
  pathname,
  isAdmin,
  embedded = false,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  embedded?: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const views = getWorkspaceViews(pathname, isAdmin);
  const activeView = views.find((view) => view.isActive) ?? views[0];
  const ActiveIcon = activeView.icon;

  function handleSelect() {
    setOpen(false);
    onNavigate?.();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={!embedded}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={embedded ? "ghost" : "outline"}
          className={cn(
            embedded
              ? "w-full justify-start"
              : "hidden size-8 px-0 lg:inline-flex xl:size-8 xl:justify-center 2xl:w-auto 2xl:min-w-[8.75rem] 2xl:justify-start 2xl:px-2.5",
          )}
          aria-label="Switch workspace view"
        >
          <ActiveIcon className="size-4" aria-hidden />
          <span className={cn("truncate", !embedded && "hidden 2xl:inline")}>
            {activeView.label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <DropdownMenuLabel>Workspace view</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.map((view) => {
          const Icon = view.icon;

          return (
            <DropdownMenuItem key={view.label} asChild onSelect={handleSelect}>
              <Link
                href={view.href}
                prefetch={false}
                aria-current={view.isActive ? "page" : undefined}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2"
              >
                <span className="grid size-8 place-items-center rounded-md bg-secondary text-secondary-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-sm font-semibold">{view.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{view.detail}</span>
                </span>
                {view.isActive ? (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    Active
                  </Badge>
                ) : null}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getWorkspaceViews(pathname: string, isAdmin: boolean) {
  const isCoachView =
    pathname.startsWith("/coach") ||
    pathname.startsWith("/practice") ||
    pathname.startsWith("/data-chat");
  const isAdminView = pathname.startsWith("/admin") || pathname.startsWith("/partners");

  return [
    {
      label: "Player workspace",
      href: "/dashboard",
      detail: "Command centre, play, analyse and social routes.",
      icon: UserRound,
      isActive: !isCoachView && !isAdminView,
    },
    {
      label: "Coach desk",
      href: "/coach",
      detail: "Diagnosis, drill plans and practice evidence.",
      icon: Brain,
      isActive: isCoachView,
    },
    ...(isAdmin
      ? [
          {
            label: "Admin console",
            href: "/admin",
            detail: "Moderation, provider health and operations.",
            icon: ShieldCheck,
            isActive: isAdminView,
          },
        ]
      : []),
  ];
}
