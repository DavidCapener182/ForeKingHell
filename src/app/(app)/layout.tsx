import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CompanionLaunchScreen } from "@/components/app/companion-brand";
import { PrivateAppShell } from "@/components/app/private-app-shell";
import { getAppShellData } from "@/lib/app-shell-data";
import { getRequestAppSurface } from "@/lib/app-surface-server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<CompanionLaunchScreen />}>
      <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
    </Suspense>
  );
}

async function AuthenticatedAppShell({ children }: { children: React.ReactNode }) {
  const [data, surface] = await Promise.all([getAppShellData(), getRequestAppSurface()]);
  if (!data.userId) redirect("/login");

  return (
    <PrivateAppShell data={data} surface={surface}>
      {children}
    </PrivateAppShell>
  );
}
