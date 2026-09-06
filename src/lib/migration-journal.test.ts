import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Drizzle migration journal", () => {
  it("contains every numbered SQL migration in order", () => {
    const root = process.cwd();
    const journal = JSON.parse(
      readFileSync(resolve(root, "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string }> };

    for (const entry of journal.entries) {
      expect(entry.idx).toBe(journal.entries.indexOf(entry));
      expect(existsSync(resolve(root, `drizzle/${entry.tag}.sql`))).toBe(true);
    }

    expect(journal.entries.at(-1)?.tag).toBe("0059_session_data_confidence");
  });
});
