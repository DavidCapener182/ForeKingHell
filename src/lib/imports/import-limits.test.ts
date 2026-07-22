import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { findOversizedImportField, MAX_IMPORT_CSV_FIELD_LENGTH } from "@/lib/imports/import-limits";

describe("import field limits", () => {
  it("enforces the field scan at the server-side persistence boundary", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/imports/save-rapsodo-import.ts"),
      "utf8",
    );

    expect(source).toContain("findOversizedImportField(input.rawCsvText)");
    expect(source).toContain("MAX_IMPORT_CSV_FIELD_LENGTH.toLocaleString");
  });

  it("accepts ordinary quoted CSV fields and escaped quotes", () => {
    expect(findOversizedImportField('Club,Notes\n7i,"tight, repeated ""draw"""')).toBeNull();
  });

  it("reports only the row and column of an oversized field", () => {
    const oversized = "x".repeat(MAX_IMPORT_CSV_FIELD_LENGTH + 1);

    expect(findOversizedImportField(`Club,Notes\n7i,"${oversized}"`)).toEqual({
      columnNumber: 2,
      rowNumber: 2,
    });
  });

  it("counts embedded newlines inside a quoted field without changing its location", () => {
    expect(findOversizedImportField('Club,Notes\n7i,"abc\ndef"', 5)).toEqual({
      columnNumber: 2,
      rowNumber: 2,
    });
  });
});
