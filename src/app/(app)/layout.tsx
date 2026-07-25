import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { PrivateAppShell } from "@/components/app/private-app-shell";
import { getAppShellData } from "@/lib/app-shell-data";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const data = await getAppShellData();
  if (!data.userId) redirect("/login");

  return <PrivateAppShell data={data}>{children}</PrivateAppShell>;
}
