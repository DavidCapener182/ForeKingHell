import "server-only";
import { getCourseTwinManifest } from "@/lib/course-twin-data";

/** Optional imagery must not turn a storage outage into an unavailable Play briefing. */
export async function getOptionalMobileCoursePreview(userId: string, courseId: string) {
  try {
    const manifest = await getCourseTwinManifest({ userId, courseId });
    return manifest?.terrain.imagery ?? null;
  } catch {
    return null;
  }
}
