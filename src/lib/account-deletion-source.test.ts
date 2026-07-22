import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(join(process.cwd(), "src/app/settings/actions.ts"), "utf8");
const login = readFileSync(join(process.cwd(), "src/app/login/page.tsx"), "utf8");

describe("permanent account deletion source contract", () => {
  it("requires recent authentication and permits the reauthentication screen", () => {
    expect(actions).toContain("isRecentSignIn(currentUser.lastSignInAt)");
    expect(actions).toContain("reason=reauth_required");
    expect(login).toContain('first(params.reason) !== "reauth_required"');
  });

  it("revokes sessions, removes the auth identity, clears cookies, and returns a receipt", () => {
    expect(actions).toContain('signOut({ scope: "global" })');
    expect(actions).toContain("auth.admin.deleteUser");
    expect(actions).toContain("clearSupabaseAuthCookies");
    expect(actions).toContain("randomUUID()");
  });

  it("keeps reset separate from permanent deletion", () => {
    expect(actions).toContain("export async function resetGolfDataAction");
    expect(actions).toContain('nullableString(formData, "confirmation") !== "RESET"');
    expect(actions).toContain("onboardingCompletedAt: null");
  });
});
