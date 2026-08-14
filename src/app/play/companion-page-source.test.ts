import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/play/page.tsx"), "utf8");
const controlsSource = readFileSync(
  join(process.cwd(), "src/app/play/play-selection-controls.tsx"),
  "utf8",
);
const lazySetupSource = readFileSync(
  join(process.cwd(), "src/app/play/lazy-play-setup-drawer.tsx"),
  "utf8",
);
const setupExperienceSource = readFileSync(
  join(process.cwd(), "src/app/play/play-setup-experience.tsx"),
  "utf8",
);

describe("Play companion selection", () => {
  it("updates course and tee through an in-app transition rather than the redirect route", () => {
    expect(pageSource).toContain("LazyPlaySetupDrawer");
    expect(pageSource).not.toContain("href={`/play/select?courseId=");
    expect(controlsSource).toContain("selectCompanionPlayContextAction");
    expect(controlsSource).toContain("router.replace");
    expect(controlsSource).toContain("Updating course setup");
    expect(controlsSource).toContain("<Field");
    expect(controlsSource).toContain("<FieldLabel");
  });

  it("prioritises the active round, then presents one selected-course command centre", () => {
    expect(pageSource).toContain("activeRound ?");
    expect(pageSource).toContain("ActiveRoundMobile");
    expect(pageSource).toContain("SelectedCourseMobile");
    expect(pageSource).toContain("data-course-prep");
    expect(pageSource).toContain("ReadinessPanel");
    expect(pageSource).toContain("LazyPlaySetupDrawer");
    expect(pageSource).toContain("Course selected");
    expect(pageSource).toContain("Tee selected");
    expect(pageSource).toContain("Trusted bag available");
    expect(pageSource).toContain("Strategy ready");
    expect(pageSource).toContain("Course Twin mapped");
    expect(pageSource).toContain("Open Strategy");
    expect(pageSource).toContain("Course Twin");
    expect(pageSource).toContain("Start Round");
    expect(pageSource).toContain("Quick Bag");
    expect(pageSource).toContain("<AppEmptyState");
    expect(pageSource).toContain("Continue Round");
    expect(pageSource).not.toContain("OperationStepper");
    expect(pageSource).not.toContain("<DropdownMenu");
  });

  it("adds the desktop caddie briefing without turning Play into Course Twin", () => {
    expect(pageSource).toContain("data-play-desktop-command-centre");
    expect(pageSource).toContain("Pre-round command centre");
    expect(pageSource).toContain("Strategy summary");
    expect(pageSource).toContain("Key holes");
    expect(pageSource).toContain("Trusted clubs");
    expect(pageSource).toContain("Common miss");
    expect(pageSource).toContain("Recent course record");
    expect(pageSource).toContain("getCachedCourseWeather");
    expect(pageSource).toContain("gt(weatherSnapshots.expiresAt, new Date())");
    expect(pageSource).not.toContain("max-w-6xl");
    expect(pageSource).not.toContain("max-w-7xl");
  });

  it("defers Drawer and Select setup controls until the setup action is opened", () => {
    expect(pageSource).not.toContain("PlaySelectionControls");
    expect(pageSource).not.toContain('from "@/app/play/play-setup-drawer"');
    expect(pageSource).not.toContain("<PlaySetupDrawer");
    expect(lazySetupSource).toContain('import dynamic from "next/dynamic"');
    expect(lazySetupSource).toContain('import("@/app/play/play-setup-experience")');
    expect(lazySetupSource).toContain("{open ? <PlaySetupExperience");
    expect(setupExperienceSource).toContain("<Drawer open={open}");
    expect(setupExperienceSource).toContain("<PlaySelectionControls {...selection} />");
  });
});
