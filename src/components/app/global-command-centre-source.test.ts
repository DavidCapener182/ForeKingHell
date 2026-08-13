import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/app/app-command-menu.tsx"), "utf8");
const trigger = readFileSync(
  join(process.cwd(), "src/components/app/app-command-trigger.tsx"),
  "utf8",
);
const compatibilityExport = readFileSync(
  join(process.cwd(), "src/components/app/global-command-centre.tsx"),
  "utf8",
);

describe("global command centre contract", () => {
  it("uses central metadata and official command composition for every entrypoint", () => {
    expect(source).toContain('from "@/components/app/route-metadata"');
    expect(source).toContain('event.key.toLowerCase() === "k"');
    expect(source).toContain('event.key === "/"');
    expect(source).toContain("CommandDialog");
    expect(source).toContain("CommandInput");
    expect(source).toContain("CommandList");
    expect(source).toContain("CommandEmpty");
    expect(source).toContain("CommandGroup");
    expect(source).toContain("CommandItem");
    expect(source).toContain("CommandShortcut");
    expect(source).toContain("routesAvailableTo(isAdmin)");
    expect(source).toContain('"Quick actions"');
    expect(source).toContain('label: "Recent"');
    expect(trigger).toContain("AppCommandTrigger");
    expect(trigger).toContain("Command K or Ctrl K");
    expect(compatibilityExport).toContain("AppCommandMenu as GlobalCommandCentre");
  });
});
