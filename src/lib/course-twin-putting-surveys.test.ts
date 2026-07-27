import { describe, expect, it } from "vitest";

import {
  type CourseTwinPuttingSurveyInput,
  validatePuttingSurvey,
} from "@/lib/course-twin-putting-surveys";

const survey: CourseTwinPuttingSurveyInput = {
  holeNumber: 5,
  sourceName: "Licensed total-station survey",
  sourceUrl: "https://example.test/bootle/5",
  capturedAt: "2026-07-01T12:00:00.000Z",
  coordinateSystem: "EPSG:4326",
  gridSpacingM: 0.25,
  verticalAccuracyMm: 8,
  grid: {
    bounds: {
      minLatitude: 53.48,
      maxLatitude: 53.48001,
      minLongitude: -2.97,
      maxLongitude: -2.96999,
    },
    width: 2,
    height: 2,
    elevationsM: [10, 10.01, 10.02, 10.03],
  },
};

describe("Course Twin putting survey validation", () => {
  it("accepts a bounded north-to-south EPSG:4326 elevation grid", () => {
    expect(validatePuttingSurvey(survey)).toMatchObject({
      holeNumber: 5,
      gridSpacingM: 0.25,
      verticalAccuracyMm: 8,
    });
  });

  it("rejects mismatched sample counts, unsafe URLs and future captures", () => {
    expect(() =>
      validatePuttingSurvey({ ...survey, grid: { ...survey.grid, elevationsM: [1] } }),
    ).toThrow(/grid/i);
    expect(() => validatePuttingSurvey({ ...survey, sourceUrl: "file:///tmp/green.csv" })).toThrow(
      /HTTPS/i,
    );
    expect(() =>
      validatePuttingSurvey({ ...survey, capturedAt: "2099-01-01T00:00:00.000Z" }),
    ).toThrow(/capture date/i);
  });
});
