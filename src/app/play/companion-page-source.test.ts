import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/(app)/play/page.tsx"), "utf8");
const controlsSource = readFileSync(
  join(process.cwd(), "src/app/play/play-selection-controls.tsx"),
  "utf8",
);

describe("Play companion selection", () => {
  it("updates course and tee through an in-app transition rather than the redirect route", () => {
    expect(pageSource).toContain("PlaySelectionControls");
    expect(pageSource).not.toContain("href={`/play/select?courseId=");
    expect(controlsSource).toContain("selectCompanionPlayContextAction");
    expect(controlsSource).toContain("router.replace");
    expect(controlsSource).toContain("Updating course setup");
  });

  it("shows setup guidance only until the selected-course decision is ready", () => {
    expect(pageSource).toContain("data-play-setup-guide");
    expect(pageSource).toContain("OperationStepper");
    expect(pageSource).toContain("PlaySetupDrawer");
    expect(pageSource).toContain("playReady ?");
    expect(pageSource).toContain("!playReady ?");
    expect(pageSource).toContain("Continue Round");
  });
});
