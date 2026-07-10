import { describe, expect, it } from "vitest";

import { csvCell } from "@/lib/csv";

describe("csvCell", () => {
  it.each(["=2+2", "+SUM(A1:A2)", "-10+20", "@SUM(A1:A2)", "\t=cmd", "\r=cmd"])(
    "neutralises spreadsheet formula input %j",
    (value) => {
      const serialised = csvCell(value);

      expect(serialised).toBe(`"'${value.replace(/\s+/g, " ").trim().replace(/"/g, '""')}"`);
    },
  );

  it("escapes quotes and keeps ordinary values unchanged", () => {
    expect(csvCell('Driver "stock"')).toBe('"Driver ""stock"""');
    expect(csvCell("286 yd")).toBe('"286 yd"');
    expect(csvCell("-12.5")).toBe('"-12.5"');
    expect(csvCell("Driver\nstock")).toBe('"Driver stock"');
  });
});
