import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(join(process.cwd(), "src/app/login/page.tsx"), "utf8");
const formSource = readFileSync(join(process.cwd(), "src/app/login/login-form.tsx"), "utf8");

describe("mobile Apple login", () => {
  it("uses a neutral grouped canvas and keeps the aerial treatment desktop-only", () => {
    expect(pageSource).toContain("bg-[#F2F2F7]");
    expect(pageSource).toContain('className="ios-public-auth');
    expect(pageSource).toContain("lg:bg-[#07110B]");
    expect(pageSource).toContain('className="-z-20 hidden');
    expect(pageSource).toContain("lg:block");
    expect(pageSource).toContain("rounded-[14px] bg-white");
    expect(pageSource).toContain("border-[#D9D9DE]");
    expect(pageSource).toContain("font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text'");
  });

  it("retains the existing desktop composition from the 1024px breakpoint", () => {
    expect(pageSource).toContain("lg:grid-cols-[minmax(0,1fr)_460px]");
    expect(pageSource).toContain("lg:min-h-screen");
    expect(pageSource).toContain("lg:shadow-2xl");
    expect(pageSource).toContain("lg:font-[var(--font-ui-source)]");
    expect(formSource).toContain("lg:h-12");
    expect(formSource).toContain("lg:rounded-lg");
  });

  it("uses readable type and touch-sized controls for every mobile sign-in path", () => {
    expect(pageSource).toContain("text-[2.125rem]");
    expect(pageSource).toContain("text-[17px]");
    expect(pageSource).toContain("min-h-11");
    expect(formSource.match(/h-\[3\.125rem\]/g)?.length).toBeGreaterThanOrEqual(5);
    expect(formSource).toContain("focus-visible:ring-[#087A42]");
  });

  it("preserves the authentication choices and factual account-data copy", () => {
    expect(formSource).toContain("action={passwordAction}");
    expect(formSource).toContain("action={signInWithOAuthAction}");
    expect(formSource).toContain("action={magicAction}");
    expect(formSource).toContain('value="google"');
    expect(formSource).toContain('value="apple"');
    expect(pageSource).toContain("Your shot data stays scoped to your account.");
    expect(pageSource).toContain("Read the data notice");
    expect(pageSource).toContain('href="/privacy"');
  });
});
