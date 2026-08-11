import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  const surface = await getRequestAppSurface();

  if (surface === "companion") {
    const { default: TodayCompanionPage } = await import("./today-companion-page");
    return <TodayCompanionPage />;
  }

  const { default: TodayWorkbenchPage } = await import("./today-workbench-page");
  return <TodayWorkbenchPage searchParams={searchParams} />;
}
