import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/app/global-command-centre.tsx"),
  "utf8",
);

describe("global command centre contract", () => {
  it("uses central metadata and supports keyboard, dialog and mobile-shell entrypoints", () => {
    expect(source).toContain('from "@/components/app/route-metadata"');
    expect(source).toContain('event.key.toLowerCase() === "k"');
    expect(source).toContain('event.key === "/"');
    expect(source).toContain('role="listbox"');
    expect(source).toContain("routesAvailableTo(isAdmin)");
    expect(source).toContain('"Quick actions"');
  });
});
