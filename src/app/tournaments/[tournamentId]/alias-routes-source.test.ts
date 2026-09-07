import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(href);
  },
}));
import Leaderboard from "@/app/(app)/tournaments/[tournamentId]/leaderboard/page";
import Rounds from "@/app/(app)/tournaments/[tournamentId]/rounds/page";
import Rules from "@/app/(app)/tournaments/[tournamentId]/rules/page";
import Submit from "@/app/(app)/tournaments/[tournamentId]/submit/page";
describe("tournament alias routes", () => {
  it.each([
    { name: "leaderboard", Route: Leaderboard, tab: "board" },
    { name: "rounds", Route: Rounds, tab: "submit" },
    { name: "rules", Route: Rules, tab: "rules" },
    { name: "submit", Route: Submit, tab: "submit" },
  ])(
    "$name retains exact event/filter context and selects the canonical tab",
    async ({ name, Route, tab }) => {
      await expect(
        Route({
          params: Promise.resolve({ tournamentId: "event/id" }),
          searchParams: Promise.resolve({ tab: "wrong", filter: ["mine", "open"] }),
        }),
      ).rejects.toThrow(`/tournaments/event%2Fid?tab=${tab}&filter=mine&filter=open`);
      const source = readFileSync(
        join(process.cwd(), "src/app/(app)/tournaments/[tournamentId]", name, "page.tsx"),
        "utf8",
      );
      expect(source).not.toMatch(
        /#standings|#submit-round|#rules|PageShell|DesktopWorkbenchLayout/,
      );
    },
  );
});
