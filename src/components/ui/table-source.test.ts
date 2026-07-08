import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("shared table semantics", () => {
  it("passes table descriptions through to the keyboard-focusable scroll container", () => {
    const source = readFileSync(join(process.cwd(), "src/components/ui/table.tsx"), "utf8");
    const tableBlock =
      source.match(/function Table\([\s\S]*?\n}\n\nfunction TableHeader/)?.[0] ?? "";

    expect(tableBlock).toContain('"aria-describedby": ariaDescribedBy');
    expect(tableBlock).toContain("aria-describedby={ariaDescribedBy}");
    expect(tableBlock).toContain('aria-label="Scrollable data table"');
    expect(tableBlock).toContain('data-slot="table-container"');
    expect(tableBlock).toContain("tabIndex={0}");
  });

  it("gives reusable table headers an explicit column scope by default", () => {
    const source = readFileSync(join(process.cwd(), "src/components/ui/table.tsx"), "utf8");
    const tableHeadBlock =
      source.match(/function TableHead\([\s\S]*?\n}\n\nfunction TableCell/)?.[0] ?? "";

    expect(tableHeadBlock).toContain('scope = "col"');
    expect(tableHeadBlock).toContain("scope={scope}");
  });

  it("maps selected row state onto accessible table-row selection", () => {
    const source = readFileSync(join(process.cwd(), "src/components/ui/table.tsx"), "utf8");
    const tableRowBlock =
      source.match(/function TableRow\([\s\S]*?\n}\n\nfunction TableHead/)?.[0] ?? "";

    expect(tableRowBlock).toContain('"data-state": dataState');
    expect(tableRowBlock).toContain('"aria-selected": ariaSelected');
    expect(tableRowBlock).toContain("data-state={dataState}");
    expect(tableRowBlock).toContain(
      'aria-selected={ariaSelected ?? (dataState === "selected" ? true : undefined)}',
    );
  });
});
