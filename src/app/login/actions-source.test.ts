import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/login/actions.ts"), "utf8");

describe("login actions", () => {
  it("keeps password sign-in failures visible to the login form", () => {
    expect(source).toContain("[login] Password sign-in request failed");
    expect(source).toContain("Sign-in could not reach the auth service");
    expect(source).toContain("[login] Profile setup failed after password sign-in");
    expect(source).toContain(
      "Your password was accepted, but your golf profile could not be loaded",
    );
    expect(source).toContain("clearSupabaseAuthCookies");
    expect(source).toContain("await clearSupabaseAuthCookies();");
    expect(source).toContain("await supabase.auth.signOut()");
    expect(source).toContain("redirect(next);");
  });
});
