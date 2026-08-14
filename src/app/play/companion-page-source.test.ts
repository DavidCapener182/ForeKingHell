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

  it("shows setup guidance only until the selected-course decision is ready", () => {
    expect(pageSource).toContain("data-play-setup-guide");
    expect(pageSource).toContain("OperationStepper");
    expect(pageSource).toContain("LazyPlaySetupDrawer");
    expect(pageSource).toContain("<ButtonGroup");
    expect(pageSource).toContain("<DropdownMenu");
    expect(pageSource).toContain("buttonVariants({");
    expect(pageSource).not.toContain("<DropdownMenuTrigger asChild>");
    expect(pageSource).toContain('aria-label="More play actions"');
    expect(pageSource).not.toContain("grid-cols-4");
    expect(pageSource).toContain("<AppEmptyState");
    expect(pageSource).toContain("playReady ?");
    expect(pageSource).toContain("selected && !playReady ?");
    expect(pageSource).toContain("Continue Round");
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
