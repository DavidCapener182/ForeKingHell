import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/login/page.tsx"), "utf8");
const formSource = readFileSync(join(process.cwd(), "src/app/login/login-form.tsx"), "utf8");

describe("mobile Apple login", () => {
  it("uses adaptive iOS system surfaces and keeps the aerial treatment desktop-only", () => {
    expect(pageSource).toContain('className="ios-public-auth');
    expect(pageSource).toContain("bg-[var(--ios-background)]");
    expect(pageSource).toContain("bg-[var(--ios-grouped-surface)]");
    expect(pageSource).toContain("text-[var(--ios-label)]");
    expect(pageSource).toContain("text-[var(--ios-secondary-label)]");
    expect(pageSource).toContain("border-[var(--ios-separator)]");
    expect(pageSource).toContain("lg:bg-[#07110B]");
    expect(pageSource).toContain('className="-z-20 hidden');
    expect(pageSource).toContain("lg:block");
    expect(pageSource).toContain("font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text'");
  });

  it("uses semantic system tokens for every mobile sign-in surface and action", () => {
    expect(formSource).toContain("bg-[var(--ios-secondary-surface)]");
    expect(formSource).toContain("bg-[var(--ios-grouped-surface)]");
    expect(formSource).toContain("bg-[var(--ios-action)]");
    expect(formSource).toContain("hover:bg-[var(--ios-action-pressed)]");
    expect(formSource).toContain("placeholder:text-[var(--ios-tertiary-label)]");
    expect(formSource).toContain("focus-visible:ring-[var(--ios-tint)]");

    for (const legacyMobileColour of [
      "#F2F2F7",
      "#EFEFF4",
      "#F7F7F8",
      "#087A42",
      "#056735",
      "#111113",
      "#55555B",
      "#66666C",
      "#333338",
      "#C7C7CC",
      "#8E8E93",
      "#6C6C70",
      "#D9D9DE",
    ]) {
      expect(`${pageSource}\n${formSource}`).not.toContain(legacyMobileColour);
    }
  });

  it("retains the existing desktop composition from the 1024px breakpoint", () => {
    expect(pageSource).toContain("lg:grid-cols-[minmax(0,1fr)_460px]");
    expect(pageSource).toContain("lg:min-h-screen");
    expect(pageSource).toContain("lg:shadow-2xl");
    expect(pageSource).toContain("lg:font-[var(--font-ui-source)]");
    expect(pageSource).toContain("lg:bg-[#0B7A3B]");
    expect(formSource).toContain("lg:bg-[#0B7A3B]");
    expect(formSource).toContain("lg:h-12");
    expect(formSource).toContain("lg:rounded-lg");
  });

  it("uses readable type and touch-sized controls for every mobile sign-in path", () => {
    expect(pageSource).toContain("text-[2.125rem]");
    expect(pageSource).toContain("text-[17px]");
    expect(pageSource).toContain("min-h-11");
    expect(formSource.match(/h-\[3\.125rem\]/g)?.length).toBeGreaterThanOrEqual(5);
    expect(formSource).toContain("focus-visible:ring-[var(--ios-tint)]");
  });

  it("preserves the supported authentication choices and factual account-data copy", () => {
    expect(formSource).toContain("action={passwordAction}");
    expect(formSource).toContain("action={signInWithOAuthAction}");
    expect(formSource).toContain("action={magicAction}");
    expect(formSource).toContain('value="google"');
    expect(formSource).not.toContain('value="apple"');
    expect(formSource).not.toContain("Continue with Apple");
    expect(pageSource).not.toContain("Google, Apple");
    expect(pageSource).toContain("Your shot data stays scoped to your account.");
    expect(pageSource).toContain("Read the data notice");
    expect(pageSource).toContain('aria-label="Read the data notice"');
    expect(pageSource).toContain('href="/privacy"');
  });
});
