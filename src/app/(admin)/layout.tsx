import { redirect } from "next/navigation";

import { PrivateAppShell } from "@/components/app/private-app-shell";
import { getAppShellData } from "@/lib/app-shell-data";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const data = await getAppShellData();
  if (!data.userId) redirect("/login");
  if (!data.isAdmin) redirect("/today");

  return <PrivateAppShell data={data}>{children}</PrivateAppShell>;
}
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
