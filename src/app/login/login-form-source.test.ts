import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/login/login-form.tsx"), "utf8");

describe("login form", () => {
  it("routes validation and auth failures through visible app messages", () => {
    expect(source).toContain("noValidate");
    expect(source).not.toContain("minLength={6}");
    expect(source).toContain('id="password-login-message"');
    expect(source).toContain('id="magic-login-message"');
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="assertive"');
    expect(source).toContain('passwordState.status === "idle" ? error');
  });
});
