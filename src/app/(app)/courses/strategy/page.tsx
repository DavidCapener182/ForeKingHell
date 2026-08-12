import { getRequestAppSurface } from "@/lib/app-surface-server";

export const dynamic = "force-dynamic";

type StrategySearchParams = Promise<{
  mode?: string;
  courseId?: string;
  roundId?: string;
  saved?: string;
  teeSetId?: string;
}>;

export default async function CourseStrategyPage({
  searchParams,
}: {
  searchParams?: StrategySearchParams;
}) {
  const surface = await getRequestAppSurface();

  if (surface === "companion") {
    const { default: CourseStrategyCompanionPage } =
      await import("./course-strategy-companion-page");
    return <CourseStrategyCompanionPage searchParams={searchParams} />;
  }

  const { default: CourseStrategyWorkbenchPage } = await import("./course-strategy-workbench-page");
  return <CourseStrategyWorkbenchPage searchParams={searchParams} />;
}
