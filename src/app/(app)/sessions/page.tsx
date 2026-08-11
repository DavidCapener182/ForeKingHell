import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const surface = await getRequestAppSurface();

  if (surface === "companion") {
    const { default: SessionsCompanionPage } = await import("./sessions-companion-page");
    return <SessionsCompanionPage />;
  }

  const { default: SessionsWorkbenchPage } = await import("./sessions-workbench-page");
  return <SessionsWorkbenchPage />;
}
