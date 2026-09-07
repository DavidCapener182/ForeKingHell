import { redirect } from "next/navigation";
import { canonicalRouteHref, type RouteQuery } from "@/lib/canonical-route-query";

type CourseRecordAliasPageProps = {
  params: Promise<{ recordId: string }>;
  searchParams?: Promise<RouteQuery>;
};

export default async function CourseRecordAliasPage({
  params,
  searchParams,
}: CourseRecordAliasPageProps) {
  const { recordId } = await params;
  redirect(
    canonicalRouteHref(`/course-records/${encodeURIComponent(recordId)}`, await searchParams),
  );
}
