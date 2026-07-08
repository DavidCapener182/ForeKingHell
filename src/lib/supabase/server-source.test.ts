import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/supabase/server.ts"), "utf8");

describe("Supabase server helpers", () => {
  it("can clear project-scoped auth and PKCE cookies", () => {
    expect(source).toContain("export async function clearSupabaseAuthCookies()");
    expect(source).toContain("const authStorageKey = `sb-${projectRef}-auth-token`;");
    expect(source).toContain("`${authStorageKey}-code-verifier`");
    expect(source).toContain("cookie.name === prefix || cookie.name.startsWith(`${prefix}.`)");
    expect(source).toContain("cookieStore.delete(cookie.name);");
  });
});
