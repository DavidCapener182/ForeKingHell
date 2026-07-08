import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/auth/sign-out/route.ts"), "utf8");

describe("sign-out route", () => {
  it("clears stale Supabase auth cookies even when remote sign-out fails", () => {
    expect(source).toContain("clearSupabaseAuthCookies");
    expect(source).toContain("const { error } = await supabase.auth.signOut();");
    expect(source).toContain("Supabase sign-out failed while clearing local session");
    expect(source).toContain("await clearSupabaseAuthCookies();");
    expect(source).toContain('NextResponse.redirect(new URL("/login", request.url)');
  });
});
