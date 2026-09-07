import { expect, it } from "vitest";
import { buildWorkbenchBreadcrumbItems as crumbs } from "./workbench-breadcrumbs";
it("retains course and record parents with exact entity identities", () => {
  expect(
    crumbs({ label: "Courses", href: "/courses" }, "/courses/course-a/records/record-b"),
  ).toEqual([
    { label: "Courses", href: "/courses" },
    { label: "Course detail", href: "/courses/course-a" },
    { label: "Course records", href: "/courses/course-a/records" },
    { label: "Record detail" },
  ]);
});
it("keeps club analytics and event rules connected to their parent", () => {
  expect(crumbs(undefined, "/bag/club-a/analytics")).toEqual([
    { label: "Club profile", href: "/bag/club-a" },
    { label: "Club analytics" },
  ]);
  expect(crumbs(undefined, "/tournaments/event-a/rules")).toEqual([
    { label: "Event detail", href: "/tournaments/event-a" },
    { label: "Event rules" },
  ]);
});
it("avoids duplicate parent links and does not invent unknown detail labels", () => {
  expect(crumbs({ label: "Course detail", href: "/courses/a" }, "/courses/a/holes")).toHaveLength(
    2,
  );
  expect(crumbs({ label: "Unknown", href: "/unknown" }, "/unknown")).toEqual([
    { label: "Unknown", href: "/unknown" },
  ]);
  expect(crumbs(undefined, "/sessions/saved-session")).toEqual([{ label: "Session review" }]);
});
