import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const commandSource = readFileSync(
  join(process.cwd(), "src/app/api/desktop-workbench/commands/route.ts"),
  "utf8",
);
const notificationSource = readFileSync(
  join(process.cwd(), "src/app/api/desktop-workbench/notifications/route.ts"),
  "utf8",
);

describe("desktop workbench public fallbacks", () => {
  it("keeps unauthenticated shell fetches quiet on public routes", () => {
    for (const source of [commandSource, notificationSource]) {
      const unauthenticatedBlock = source.match(/if \(!user\) \{[\s\S]*?\n  \}/)?.[0] ?? "";

      expect(unauthenticatedBlock).toContain("NextResponse.json({ items: [] })");
      expect(unauthenticatedBlock).not.toContain("Authentication required");
      expect(unauthenticatedBlock).not.toContain("status: 401");
    }
  });
});
