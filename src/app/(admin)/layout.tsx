import { redirect } from "next/navigation";

import { PrivateAppShell } from "@/components/app/private-app-shell";
import { getAppShellData } from "@/lib/app-shell-data";
import { getRequestAppSurface } from "@/lib/app-surface-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [data, surface] = await Promise.all([getAppShellData(), getRequestAppSurface()]);
  if (!data.userId) redirect("/login");
  if (!data.isAdmin) redirect("/today");

  return (
    <PrivateAppShell data={data} surface={surface}>
      {children}
    </PrivateAppShell>
  );
}
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
