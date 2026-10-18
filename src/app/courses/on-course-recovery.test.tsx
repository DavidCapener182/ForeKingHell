import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OnCourseRecovery, type OnCourseArea } from "./on-course-recovery";

describe("on-course recovery destinations", () => {
  it.each<[OnCourseArea, string, string]>([
    ["courses", "Retry course view", "/courses"],
    ["rounds", "Retry round view", "/rounds"],
    ["play", "Retry play", "/courses"],
    ["records", "Retry record view", "/rounds"],
    ["lab", "Retry Performance Lab", "/bag"],
  ])("keeps %s failures recoverable within the workflow", (area, retryLabel, href) => {
    const html = renderToStaticMarkup(<OnCourseRecovery area={area} retry={() => {}} />);
    expect(html).toContain(retryLabel);
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain("<h1>");
    expect(html).toContain('<main id="main-content"');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("stack");
  });
  it("offers saved offline golf for interrupted play and rounds", () => {
    for (const area of ["play", "rounds"] as const)
      expect(renderToStaticMarkup(<OnCourseRecovery area={area} retry={() => {}} />)).toContain(
        'href="/offline"',
      );
  });
});
