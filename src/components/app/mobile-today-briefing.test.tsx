import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MobileTodayActivities } from "./mobile-today-activities";
import { TodayPrimaryAnswer } from "./today-primary-answer";
import { MobileTodayGreeting } from "./mobile-today-greeting";

describe("Today companion briefing", () => {
  it("shows import as the next step for finished activity without an empty current-activity section", () => {
    const html = renderToStaticMarkup(
      <MobileTodayActivities
        accountId="owner"
        plan={{ id: "saved-plan", title: "7 iron gates", status: "awaiting_import" }}
        round={null}
      />,
    );
    expect(html).toContain("Add measured shots");
    expect(html).toContain("/import?practicePlanId=saved-plan");
    expect(html).not.toContain("Resume Range Mode");
    expect(html).not.toContain("Current activity");
  });
  it("keeps an active round reachable and offers Quick Bag for the next shot", () => {
    const html = renderToStaticMarkup(
      <MobileTodayActivities
        accountId="owner"
        plan={null}
        round={{ id: "round-id", courseName: "Saved course" }}
      />,
    );
    expect(html).toContain("/rounds/round-id");
    expect(html).toContain("/quick-bag");
    expect(html).not.toContain("Prepare your next round");
  });
  it("labels low evidence as a baseline and defers the detailed chart until requested", () => {
    const html = renderToStaticMarkup(
      <TodayPrimaryAnswer
        accountId="owner"
        serverState={{
          eyebrow: "Focus",
          title: "Practise SW control",
          reason: "Existing recommendation",
          status: "Low",
          tone: "attention",
          href: "/practice?intent=confidence",
          action: "Build practice",
        }}
        facts={[
          { label: "Session", value: "45 min" },
          { label: "Club", value: "Sand Wedge" },
          { label: "Evidence", value: "4 trusted shots" },
        ]}
        evidenceDate="22 August 2026"
        evidenceContent={<div>Heavy chart evidence</div>}
      />,
    );
    expect(html).toContain("Sand Wedge baseline");
    expect(html).toContain("4 trusted shots");
    expect(html).toContain("22 August 2026");
    expect(html).toContain('aria-label="Why this recommendation?"');
    expect(html).not.toContain("Heavy chart evidence");
    expect(html).not.toContain('href="#today-evidence"');
  });
  it("renders the date and greeting on the server without a late extra title row", () => {
    const html = renderToStaticMarkup(<MobileTodayGreeting initialNow="2026-09-05T08:00:00Z" />);
    expect(html).toContain("Saturday 5 September");
    expect(html).toContain("Good morning");
    expect(html).not.toContain("Your golf companion");
  });
});
