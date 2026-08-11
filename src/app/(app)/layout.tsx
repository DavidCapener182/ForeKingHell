import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { PrivateAppShell } from "@/components/app/private-app-shell";
import { getAppShellData } from "@/lib/app-shell-data";
import { getRequestAppSurface } from "@/lib/app-surface-server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [data, surface] = await Promise.all([getAppShellData(), getRequestAppSurface()]);
  if (!data.userId) redirect("/login");

  return (
    <PrivateAppShell data={data} surface={surface}>
      {children}
    </PrivateAppShell>
  );
}
