import { redirect } from "next/navigation";
import { canonicalRouteHref, type RouteQuery } from "@/lib/canonical-route-query";

type CourseTournamentsPageProps = {
  params: Promise<{ courseId: string }>;
  searchParams?: Promise<RouteQuery>;
};

export default async function CourseTournamentsPage({
  params,
  searchParams,
}: CourseTournamentsPageProps) {
  const { courseId } = await params;
  redirect(canonicalRouteHref("/tournaments", await searchParams, { courseId }));
}
