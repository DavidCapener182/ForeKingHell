import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/tournaments/[tournamentId]");

describe("tournament desktop alias routes", () => {
  it("keeps legacy tournament subroutes pointed at the unified event workbench", () => {
    const aliases = [
      { file: "leaderboard/page.tsx", target: "`/tournaments/${tournamentId}#standings`" },
      { file: "rounds/page.tsx", target: "`/tournaments/${tournamentId}#submit-round`" },
      { file: "rules/page.tsx", target: "`/tournaments/${tournamentId}#rules`" },
      { file: "submit/page.tsx", target: "`/tournaments/${tournamentId}#submit-round`" },
    ];

    for (const alias of aliases) {
      const source = readFileSync(join(routeDir, alias.file), "utf8");

      expect(source).toContain('import { redirect } from "next/navigation";');
      expect(source).toContain("const { tournamentId } = await params;");
      expect(source).toContain(`redirect(${alias.target})`);
      expect(source).not.toContain("PageShell");
      expect(source).not.toContain("DesktopWorkbenchLayout");
    }
  });
});
