import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MobileUnmeasuredSession } from "./mobile-unmeasured-session";
import type { SessionReviewMetadata } from "@/lib/session-review-metadata";
const session: SessionReviewMetadata = {
  id: "saved-activity",
  type: "range",
  source: "manual",
  date: new Date("2026-08-22T12:00:00Z"),
  courseName: null,
  location: "Practice range",
  notes: "Worked on start line.\nFelt comfortable.",
  equipmentNotes: "New grip",
  fileName: null,
  shotCount: 0,
};
describe("unmeasured mobile session", () => {
  it("shows saved notes and the linked plan without inventing performance", () => {
    const html = renderToStaticMarkup(
      <MobileUnmeasuredSession
        session={session}
        plan={{ id: "plan-1", title: "Driver start line" }}
      />,
    );
    expect(html).toContain("Worked on start line.");
    expect(html).toContain("New grip");
    expect(html).toContain("Activity saved");
    expect(html).toContain('href="/import?practicePlanId=plan-1"');
    expect(html).toContain('href="/practice?planId=plan-1"');
    expect(html).not.toContain("confidence");
    expect(html).not.toContain("improved");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    if (process.env.FKH_CAPTURE_EMPTY_SESSION === "1") {
      writeFileSync("/tmp/fkh-empty-session-fixture.html", html);
    }
  });
  it("prioritises the existing shots when measurements could not enter the review", () => {
    const html = renderToStaticMarkup(
      <MobileUnmeasuredSession session={{ ...session, shotCount: 4 }} plan={null} />,
    );
    expect(html).toContain("4 shots saved");
    expect(html).toContain('href="/shots?sessionId=saved-activity"');
    expect(html).not.toContain("Import measured shots");
    expect(html).not.toContain("no measured shots yet");
  });
  it("omits absent notes and plan sections", () => {
    const html = renderToStaticMarkup(
      <MobileUnmeasuredSession
        session={{ ...session, notes: null, equipmentNotes: null }}
        plan={null}
      />,
    );
    expect(html).not.toContain("Your notes");
    expect(html).not.toContain("Open practice plan");
    expect(html).toContain('href="/import"');
  });
});
