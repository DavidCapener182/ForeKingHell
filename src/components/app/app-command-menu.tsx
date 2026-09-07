"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { buildDesktopNavGroups } from "@/components/app/nav-items";

// Both surfaces use the same authorised entity loader, filtering, persistence
// and palette. The compatibility export no longer maintains a second catalogue.
const SharedCommandCentre = dynamic(
  () =>
    import("@/components/app/desktop-workbench-chrome").then(
      (module) => module.DesktopWorkbenchChrome,
    ),
  { ssr: false },
);

export function AppCommandMenu({
  isAdmin,
  enableKeyboardShortcut = true,
}: {
  isAdmin: boolean;
  enableKeyboardShortcut?: boolean;
}) {
  const navGroups = useMemo(() => buildDesktopNavGroups(isAdmin), [isAdmin]);
  return (
    <SharedCommandCentre
      navGroups={navGroups}
      isAdmin={isAdmin}
      commandOnly
      enableKeyboardShortcut={enableKeyboardShortcut}
    />
  );
}

export function openAppCommandMenu() {
  window.dispatchEvent(new Event("fkh:open-command-centre"));
}
