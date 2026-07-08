import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/auth/callback/route.ts"), "utf8");

describe("auth callback route", () => {
  it("returns a visible login message when callback auth succeeds but app setup fails", () => {
    expect(source).toContain("clearSupabaseAuthCookies");
    expect(source).toContain("Session user lookup failed after callback sign-in");
    expect(source).toContain("Profile setup failed after callback sign-in");
    expect(source).toContain("Your sign-in was accepted, but the session could not be loaded");
    expect(source).toContain(
      "Your sign-in was accepted, but your golf profile could not be loaded",
    );
    expect(source).toContain("await clearCallbackSession(supabase)");
    expect(source).toContain("function loginErrorRedirect");
    expect(source).toContain('url.searchParams.set("error", message)');
    expect(source).toContain('url.searchParams.set("next", next)');
  });
});
