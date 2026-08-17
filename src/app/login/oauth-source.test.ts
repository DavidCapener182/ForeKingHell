import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actionsSource = readFileSync(join(process.cwd(), "src/app/login/actions.ts"), "utf8");

describe("OAuth login action", () => {
  it("accepts Google as the only configured social provider", () => {
    expect(actionsSource).toContain('if (provider !== "google")');
    expect(actionsSource).not.toContain('provider !== "apple"');
  });
});
