import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/analyse/page.tsx"), "utf8");

describe("Analyse hub", () => {
  it("routes the six product questions to detailed evidence instead of duplicating charts", () => {
    for (const question of [
      "What is improving?",
      "What is getting worse?",
      "Which pattern costs the most?",
      "How confident is the system?",
      "What should I practise next?",
      "Where is the next action?",
    ]) {
      expect(source).toContain(`question="${question}"`);
    }

    for (const href of ["/progress", "/analyse/compare", "/shots", "/bag", "/coach", "/practice"]) {
      expect(source).toContain(`href="${href}"`);
    }

    expect(source).toContain("analysisConfidence({");
    expect(source).toContain("Open session impact");
    expect(source).toContain("Open analysis workspace");
    expect(source).toContain('href="/analyse/workspace"');
  });
});
