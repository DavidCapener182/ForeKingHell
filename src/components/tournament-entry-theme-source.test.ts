import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const modalSource = readFileSync(
  join(process.cwd(), "src/components/tournament-entry-modal.tsx"),
  "utf8",
);
const termsSource = readFileSync(
  join(process.cwd(), "src/components/tournament-entry-terms.tsx"),
  "utf8",
);

describe("tournament entry theme contract", () => {
  it("keeps the Drawer, terms and submit actions on semantic shadcn tokens", () => {
    expect(modalSource).toContain("<Drawer");
    expect(modalSource).toContain("<Button");
    expect(termsSource).toContain("<Checkbox");
    expect(termsSource).toContain("bg-card/80");

    for (const source of [modalSource, termsSource]) {
      expect(source).not.toMatch(
        /(?:bg|text|border)-(?:white|black|slate|emerald|green|amber|orange|red|rose|sky|blue|indigo|violet|purple)(?:-\d+|\/)|(?:bg|text|border)-\[#/,
      );
    }
  });
});
