import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/courses/page.tsx"), "utf8");
const toolbarSource = readFileSync(
  join(process.cwd(), "src/app/courses/course-directory-toolbar.tsx"),
  "utf8",
);

describe("courses desktop workspace source", () => {
  it("renders only the loading tree for the request surface", () => {
    const loading =
      source.match(/function CoursesPageLoading[\s\S]*?function SortableCourseHead/)?.[0] ?? "";

    expect(source).toContain("<CoursesPageLoading surface={surface} />");
    expect(loading).toContain('surface === "companion"');
    expect(loading).toContain("<MobileAppShell>");
    expect(loading).toContain('<div className="grid gap-4">');
    expect(loading).toContain("<Skeleton");
    expect(loading).not.toContain('className="hidden');
    expect(loading).not.toContain("animate-pulse");
    expect(loading).not.toContain("bg-[#E5E7EB]");
  });

  it("renders one semantic shadcn companion directory and shared responsive filter", () => {
    const mobile = source.slice(
      source.indexOf("<MobileAppShell>"),
      source.indexOf("<DesktopWorkbenchLayout"),
    );
    const mobileHeader = source.match(/<MobileTopBar[\s\S]*?\/>/)?.[0] ?? "";

    expect(mobile).toContain("<CourseDirectoryControls");
    expect(mobile).toContain('surface="companion"');
    expect(source).toContain("getRequestAppSurface");
    expect(source).toContain('surface === "companion"');
    const companionBranch = source.indexOf('if (surface === "companion")');
    const desktopRuntimeImport = source.indexOf(
      'await import("@/components/app/desktop-workbench")',
    );
    expect(companionBranch).toBeGreaterThanOrEqual(0);
    expect(desktopRuntimeImport).toBeGreaterThan(companionBranch);
    expect(source).toMatch(
      /import type \{[\s\S]*?DesktopSavedViewSuggestion,[\s\S]*?DesktopWorkbenchColumn,[\s\S]*?\} from "@\/components\/app\/desktop-workbench"/,
    );
    expect(source).not.toMatch(
      /import \{[\s\S]*?DesktopInsightRail[\s\S]*?\} from "@\/components\/app\/desktop-workbench"/,
    );
    expect(mobile).toContain("data-course-companion-directory");
    expect(mobile).toContain("data-course-companion-readiness");
    expect(mobile).toContain("<Card");
    expect(mobile).toContain("<Item");
    expect(mobile).toContain("<AppEmptyState");
    expect(source).toContain("mobileCourseHref");
    expect(source).toContain("mobileCourseValue");
    expect(source).not.toContain("<CourseCard");
    expect(source).not.toContain('key: "favourites", label: "Favourites"');
    expect(source).not.toContain('className="hidden lg:contents"');
    expect(source).not.toContain('className="hidden gap-4 lg:grid"');
    expect(mobileHeader).toContain('title="Courses"');
    expect(mobileHeader).not.toContain("leading=");
    expect(mobile).not.toContain("<BottomSheet");
    expect(mobile).not.toContain("<IOSGroupedList");
    expect(mobile).not.toContain("<IOSListRow");
    expect(mobile).not.toContain("<IOSDisclosureGroup");
    expect(mobile).not.toContain("<NativeListSection");
    expect(mobile).not.toMatch(/<input\b/);
    expect(mobile).not.toMatch(/bg-\[#|text-white|border-slate|bg-white/);

    expect(toolbarSource).toContain("CourseDirectoryControls");
    expect(toolbarSource).toContain("<ResponsiveFilterPanel");
    expect(toolbarSource).toContain("<InputGroup");
    expect(toolbarSource).toContain("<InputGroupInput");
    expect(toolbarSource).toContain("<FieldLabel");
    expect(toolbarSource).toContain("<Button");
    expect(toolbarSource).not.toMatch(/<input\b/);
    expect(toolbarSource).not.toMatch(/bg-\[#|text-white|border-slate|bg-white/);
  });

  it("keeps the course directory as a desktop workbench with shared wide-monitor rail", () => {
    const layoutBlock =
      source.match(/<DesktopWorkbenchLayout[\s\S]*?<\/DesktopWorkbenchLayout>/)?.[0] ?? "";

    expect(layoutBlock).toContain('scope="courses"');
    expect(layoutBlock).not.toContain("railBreakpoint=");
    expect(layoutBlock).toContain("DesktopInsightRail");
    expect(layoutBlock).toContain('title="AI course rail"');
    expect(layoutBlock).toContain("rail={");
    expect(source).toContain("CourseDataQualityPanel");
    expect(source).toContain("CourseFollowFeaturePanel");
  });

  it("keeps the course library as a controlled exportable table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain("courseWorkbenchColumns");
    expect(source).toContain("courseSuggestedViews");
    expect(source).toContain('viewKey="courses"');
    expect(source).toContain('scope="courses"');
    expect(source).toContain('exportTableId="courses"');
    expect(source).toContain('exportFileName="forekinghell-courses-view.csv"');
    expect(source).toContain('data-workbench-scope="courses"');
    expect(source).toContain('data-workbench-export-table="courses"');
    expect(source).toContain('mainTableLabel="Course library table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of [
      "course",
      "provider",
      "quality",
      "records",
      "champion",
      "tees",
      "holes",
      "rounds",
      "actions",
    ]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("adds the shadcn directory toolbar, view toggle, course cards and action menus", () => {
    expect(source).toContain("CourseDirectoryControls");
    expect(source).toContain("ConnectedMetricBar");
    expect(source).toContain("CourseDirectoryGrid");
    expect(source).toContain("data-course-directory-grid");
    expect(source).toContain("CourseActionsMenu");
    expect(source).toContain("DropdownMenu");
    expect(source).toContain("className={buttonVariants");
    expect(source).not.toContain("<DropdownMenuTrigger asChild>");
    expect(source).toContain("AppEmptyState");
    expect(source).toContain("parseCourseDirectoryView");
  });

  it("uses semantic shadcn quality evidence instead of the legacy light-only panel", () => {
    const qualityPanel =
      source.match(/function CourseDataQualityPanel[\s\S]*?async function getCoursesData/)?.[0] ??
      "";

    expect(qualityPanel).toContain("<Card data-course-data-quality>");
    expect(qualityPanel).toContain("<ConnectedMetricBar");
    expect(qualityPanel).toContain("<Alert>");
    expect(qualityPanel).not.toContain("<DataPanel");
    expect(qualityPanel).not.toContain("<DataPair");
    expect(qualityPanel).not.toContain("bg-[#F5F6F4]");
    expect(qualityPanel).not.toContain("bg-white");
    expect(qualityPanel).not.toContain("border-slate");
  });

  it("keeps ordinary table focus, hole status and sort controls semantic across themes", () => {
    const directoryTable = source.slice(
      source.indexOf('data-workbench-export-table="courses"'),
      source.indexOf("function CourseDataQualityPanel"),
    );
    const sortHead =
      source.match(/function SortableCourseHeadLink[\s\S]*?function courseSortHref/)?.[0] ?? "";

    expect(directoryTable).toContain("focus-visible:ring-ring");
    expect(directoryTable).toContain("var(--status-success-foreground)");
    expect(directoryTable).toContain("var(--status-warning-foreground)");
    expect(directoryTable).not.toMatch(/(?:ring|text)-(?:emerald|amber)-\d{2,3}/);
    expect(sortHead).toContain('active ? "text-primary"');
    expect(sortHead).not.toContain("text-emerald-");
  });

  it("does not carry a second mobile directory inside the desktop workbench", () => {
    const desktop = source.slice(source.indexOf("<DesktopWorkbenchLayout"));

    expect(desktop).not.toContain("MobileMetricStrip");
    expect(desktop).not.toContain("MobileFilterSheet");
    expect(desktop).not.toContain("MobileHorizontalRail");
    expect(desktop).not.toContain("MobileDataCard");
    expect(desktop).not.toContain("MobileDataList");
    expect(desktop).toContain("CourseDirectoryControls");
    expect(desktop).toContain('surface="workbench"');
    expect(desktop).toContain("ConnectedMetricBar");
  });
});
