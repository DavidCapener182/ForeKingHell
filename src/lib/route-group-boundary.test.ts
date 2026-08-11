import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("public and authenticated route groups", () => {
  it("keeps the root document free of private shell and database imports", () => {
    const layout = source("src/app/layout.tsx");
    expect(layout).not.toContain("getAppShellData");
    expect(layout).not.toContain("AppShell");
    expect(layout).not.toContain('from "@/db/');
    expect(layout).toContain("ThemeBootstrapScript");
  });

  it("enforces one authenticated shell and a separate admin boundary", () => {
    const appLayout = source("src/app/(app)/layout.tsx");
    const adminLayout = source("src/app/(admin)/layout.tsx");
    expect(appLayout).toContain("getAppShellData(), getRequestAppSurface()");
    expect(appLayout).toContain("Promise.all");
    expect(appLayout).toContain('redirect("/login")');
    expect(adminLayout).toContain("if (!data.isAdmin)");
    expect(adminLayout).toContain('redirect("/today")');
  });

  it("preserves public URLs while physically separating private route entries", () => {
    expect(existsSync(join(root, "src/app/login/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/share/report/[token]/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(app)/today/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(app)/goals/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/(admin)/admin/page.tsx"))).toBe(true);
  });
});
