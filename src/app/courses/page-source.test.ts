import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/courses/page.tsx"), "utf8");
const librarySource = readFileSync(
  join(process.cwd(), "src/app/courses/course-library.tsx"),
  "utf8",
);
const detailSource = readFileSync(
  join(process.cwd(), "src/app/(app)/courses/[courseId]/page.tsx"),
  "utf8",
);
const favouritesSource = readFileSync(
  join(process.cwd(), "src/app/courses/use-course-favourites.ts"),
  "utf8",
);

describe("course library source", () => {
  it("frames Courses as a catalogue rather than a management dashboard", () => {
    expect(pageSource).toContain("Course library");
    expect(pageSource).toContain("Find your next course");
    expect(pageSource).toContain("<CourseLibrary");
    expect(pageSource).toContain("<PageShell");
    expect(pageSource).not.toContain("DesktopInsightRail");
    expect(pageSource).not.toContain("CourseDataQualityPanel");
    expect(pageSource).not.toContain("CourseFollowFeaturePanel");
    expect(pageSource).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
  });

  it("uses real course evidence for catalogue readiness", () => {
    expect(pageSource).toContain("lastPlayedAt");
    expect(pageSource).toContain("listAvailableCourseTwins");
    expect(pageSource).toContain("strategyReady: holeCount >= 9 && teeSetCount > 0");
    expect(pageSource).toContain("const holeNumbers = new Map<string, Set<number>>()");
    expect(pageSource).toContain("courseLocationLabel");
  });

  it("provides all requested search, filter, favourite and view controls", () => {
    expect(librarySource).toContain('placeholder="Search courses, towns or countries"');
    for (const label of [
      "Played",
      "Favourite",
      "Course Twin",
      "Strategy ready",
      "Records",
      "Location",
    ]) {
      expect(librarySource).toContain(label);
    }
    expect(librarySource).toContain('value="grid"');
    expect(librarySource).toContain('value="table"');
    expect(favouritesSource).toContain("forekinghell-course-favourites");
    expect(favouritesSource).toContain("window.localStorage");
    expect(favouritesSource).toContain("useSyncExternalStore");
  });

  it("renders catalogue cards and a compact professional table", () => {
    expect(librarySource).toContain("data-course-grid");
    expect(librarySource).toContain("data-course-table");
    expect(librarySource).toContain("<CoursePreview");
    expect(librarySource).toContain("Last played");
    expect(librarySource).toContain("View course");
    expect(librarySource).toContain("/api/courses/google/map");
    expect(librarySource).toContain("<TableHeader>");
    expect(librarySource).toContain("<TableBody>");
  });

  it("has distinct empty-library, no-result and favourite-empty states", () => {
    expect(pageSource).toContain("Your course library is empty");
    expect(librarySource).toContain("No courses match this view");
    expect(librarySource).toContain("Favourite a course from the library");
    expect(librarySource).toContain("Clear search and filters");
  });
});

describe("selected course detail source", () => {
  it("provides the requested separate course profile and sections", () => {
    expect(detailSource).toContain("Course profile");
    for (const label of ["Overview", "Holes", "Strategy", "Course Twin", "Records", "Rounds"]) {
      expect(detailSource).toContain(`label: "${label}"`);
    }
    expect(detailSource).toContain("CourseOverview");
    expect(detailSource).toContain("CourseTwinTab");
    expect(detailSource).toContain("CourseRoundsTab");
    expect(detailSource).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
  });

  it("keeps unavailable Course Twin and round history states honest", () => {
    expect(detailSource).toContain("Course Twin is not ready yet");
    expect(detailSource).toContain("No rounds saved for this course");
    expect(detailSource).toContain("listAvailableCourseTwins");
    expect(detailSource).toContain("No playable package yet");
  });
});
