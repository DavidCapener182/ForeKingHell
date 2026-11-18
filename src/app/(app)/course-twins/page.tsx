import Link from "next/link";
import { MapPinned } from "lucide-react";
import { CourseTwinCatalogue } from "@/app/course-twins/course-twin-catalogue";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { listAvailableCourseTwins } from "@/lib/course-twin-data";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function CourseTwinCataloguePage() {
  const userId = await requireCurrentUserId();
  const twins = await listAvailableCourseTwins(userId);
  return (
    <PageShell>
      <PageHeader
        title="Course Twin"
        description="Choose a course to explore its holes in 3D or replay your shots. Grade B uses real terrain with approximate putting contours."
        actions={
          <Button asChild variant="outline">
            <Link href="/courses">
              <MapPinned className="size-4" aria-hidden />
              All courses
            </Link>
          </Button>
        }
      />
      <CourseTwinCatalogue twins={twins} />
    </PageShell>
  );
}
