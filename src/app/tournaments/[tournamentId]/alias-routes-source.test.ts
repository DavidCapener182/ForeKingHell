import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(app)/tournaments/[tournamentId]");

describe("tournament alias routes", () => {
  it("points legacy subroutes at unified mobile and desktop tab states", () => {
    const aliases = [
      { file: "leaderboard/page.tsx", target: "`/tournaments/${tournamentId}?tab=board`" },
      { file: "rounds/page.tsx", target: "`/tournaments/${tournamentId}?tab=submit`" },
      { file: "rules/page.tsx", target: "`/tournaments/${tournamentId}?tab=rules`" },
      { file: "submit/page.tsx", target: "`/tournaments/${tournamentId}?tab=submit`" },
    ];

    for (const alias of aliases) {
      const source = readFileSync(join(routeDir, alias.file), "utf8");

      expect(source).toContain('import { redirect } from "next/navigation";');
      expect(source).toContain("const { tournamentId } = await params;");
      expect(source).toContain(`redirect(${alias.target})`);
      expect(source).not.toContain("#standings");
      expect(source).not.toContain("#submit-round");
      expect(source).not.toContain("#rules");
      expect(source).not.toContain("PageShell");
      expect(source).not.toContain("DesktopWorkbenchLayout");
    }
  });
});
