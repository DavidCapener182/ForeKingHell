import { redirect } from "next/navigation";

import { getActivationJourney } from "@/lib/activation-journey";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type WelcomeSearchParams = Promise<{ resume?: string }>;

export default async function WelcomePage({
  searchParams,
}: {
  searchParams?: WelcomeSearchParams;
}) {
  const userId = await requireCurrentUserId();
  const [{ resume }, journey, surface] = await Promise.all([
    searchParams ?? Promise.resolve<{ resume?: string }>({}),
    getActivationJourney(userId),
    getRequestAppSurface(),
  ]);

  if (journey.established && resume !== "1") redirect("/today");

  if (surface === "companion") {
    const { default: WelcomeCompanionPage } = await import("./welcome-companion-page");
    return <WelcomeCompanionPage journey={journey} />;
  }

  const { default: WelcomeWorkbenchPage } = await import("./welcome-workbench-page");
  return <WelcomeWorkbenchPage journey={journey} />;
}
