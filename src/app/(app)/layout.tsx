import { redirect } from "next/navigation";

import { PrivateAppShell } from "@/components/app/private-app-shell";
import { getAppShellData } from "@/lib/app-shell-data";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const data = await getAppShellData();
  if (!data.userId) redirect("/login");

  return <PrivateAppShell data={data}>{children}</PrivateAppShell>;
}
