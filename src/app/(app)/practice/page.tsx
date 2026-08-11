import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

type PracticeSearchParams = Promise<{
  source?: string;
  time?: string;
  intent?: string;
  energy?: string;
  session?: string;
  balls?: string;
}>;

export default async function PracticePage({
  searchParams,
}: {
  searchParams?: PracticeSearchParams;
}) {
  const surface = await getRequestAppSurface();

  if (surface === "companion") {
    const { default: PracticeCompanionPage } = await import("./practice-companion-page");
    return <PracticeCompanionPage searchParams={searchParams} />;
  }

  const { default: PracticeWorkbenchPage } = await import("./practice-workbench-page");
  return <PracticeWorkbenchPage searchParams={searchParams} />;
}
