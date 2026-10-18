import { describe, expect, it } from "vitest";
import { normaliseSourceRawJson } from "./source-raw-json";

describe("historical source record decoding", () => {
  it("recovers an encoded source object without changing its readings", () => {
    const raw = { "Apex (ft)": "90", "Club Speed": "80", __lmwtMetricProvenance: "{}" };
    expect(normaliseSourceRawJson(raw)).toEqual(raw);
    expect(normaliseSourceRawJson(JSON.stringify(raw))).toEqual(raw);
  });
  it("does not turn malformed, nested or non-object data into evidence", () => {
    for (const raw of [null, undefined, 1, "broken", "[]", "null", '"encoded twice"'])
      expect(normaliseSourceRawJson(raw)).toEqual({});
    expect(normaliseSourceRawJson({ Apex: "90", nested: { unit: "ft" }, numeric: 90 })).toEqual({
      Apex: "90",
    });
  });
});
