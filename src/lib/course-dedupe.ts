export function dedupeCoursesByName<T extends { canonicalCourseId?: string | null; googlePlaceId?: string | null; name: string }>(
  courseRows: T[],
  preference: (course: T) => number,
) {
  const byName = new Map<string, T>();

  for (const course of courseRows) {
    const key = courseDedupeKey(course);
    const current = byName.get(key);

    if (!current || preference(course) > preference(current)) {
      byName.set(key, course);
    }
  }

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function courseDedupeKey(course: { canonicalCourseId?: string | null; googlePlaceId?: string | null; name: string }) {
  if (course.canonicalCourseId) {
    return `canonical:${course.canonicalCourseId}`;
  }

  if (course.googlePlaceId) {
    return `google:${course.googlePlaceId}`;
  }

  return `name:${normalisedCourseName(course.name)}`;
}

export function normalisedCourseName(name: string) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}
