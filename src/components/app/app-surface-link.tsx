"use client";

import type { ComponentProps } from "react";
import { appSurfaceHref } from "@/lib/app-surface-navigation";

type AppSurfaceLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: `/surface/${string}`;
  preserveLocation?: boolean;
};

/** Surface changes need a document navigation so the server remounts the selected app shell. */
export function AppSurfaceLink({
  href,
  preserveLocation = false,
  onClick,
  ...props
}: AppSurfaceLinkProps) {
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !preserveLocation) return;
        const surface = href.startsWith("/surface/companion") ? "companion" : "workbench";
        // Keep native navigation (including beforeunload draft protection) and the hash.
        event.currentTarget.href = appSurfaceHref(
          surface,
          `${window.location.pathname}${window.location.search}${window.location.hash}`,
        );
      }}
    />
  );
}
