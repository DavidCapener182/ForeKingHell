import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const welcome = readFileSync(join(root, "src/app/(app)/welcome/page.tsx"), "utf8");
const activation = readFileSync(join(root, "src/lib/activation-journey.ts"), "utf8");
const progressCard = readFileSync(
  join(root, "src/components/app/activation-progress-card.tsx"),
  "utf8",
);

describe("first-use journey", () => {
  it("uses real account state, supports resume, and never imports demo data", () => {
    expect(welcome).toContain("getActivationJourney(userId)");
    expect(welcome).toContain("dismissWelcomeAction");
    expect(progressCard).toContain('href="/welcome?resume=1"');
    expect(activation).toContain("providerAccounts");
    expect(activation).toContain("practicePlans");
    expect(activation).not.toContain("marketingDemo");
  });

  it("uses a native mobile setup checklist and keeps desktop composition separate", () => {
    expect(welcome).toContain("<MobileAppShell>");
    expect(welcome).toContain("MobileWelcomeJourney");
    expect(welcome).toContain("IOSGroupedList");
    expect(welcome).toContain("IOSInlineStatus");
    expect(welcome).toContain('next?.href ?? "/today"');
    expect(welcome).toContain('className="hidden gap-6 py-6 lg:grid"');
  });
});
