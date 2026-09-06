import { describe, expect, it } from "vitest";
import {
  assessFlightEvidence,
  withDirectionalConfidence,
  directionIsUsable,
} from "./session-data-confidence";
const reported = {
  id: "shot",
  carryYd: 183.8,
  sideCarryYd: -41.2,
  launchDirectionDeg: -0.2,
  clubPathDeg: 4.4,
  faceAngleDeg: -1.3,
  spinRate: null,
  spinAxis: null,
  sourceRawJson: { "Side Carry": "-41.2", "Launch Direction": "-0.2", "Club Path": "4.4" },
};
describe("flight evidence and independent metric confidence", () => {
  it("recognises the reported 41.2-yard endpoint and modelled face without declaring an impossible shot", () => {
    const result = assessFlightEvidence(reported);
    expect(result).toMatchObject({
      endpointSource: "source_reported",
      faceSource: "modelled",
      faceToPathDeg: -5.7,
      directionConfidence: "limited",
      needsReview: true,
      directionUsable: true,
    });
    expect(result.reasons.join(" ")).toContain("does not prove a misread");
  });
  it("missing spin alone never deletes or rewrites a reported endpoint", () => {
    expect(withDirectionalConfidence(reported)).toBe(reported);
    expect(assessFlightEvidence({ ...reported, sideCarryYd: 5 })).toMatchObject({
      needsReview: false,
      directionUsable: true,
    });
  });
  it.each(["misaligned", "possibly_misaligned"] as const)(
    "%s preserves distance while suppressing target-relative fields",
    (alignment) => {
      const raw = {
        ...reported,
        ballSpeedMph: 135.2,
        clubSpeedMph: 90.7,
        dataConfidence: { alignment },
      };
      const usable = withDirectionalConfidence(raw);
      expect(usable).toMatchObject({
        carryYd: 183.8,
        ballSpeedMph: 135.2,
        clubSpeedMph: 90.7,
        sideCarryYd: null,
        launchDirectionDeg: null,
        faceAngleDeg: null,
        clubPathDeg: null,
      });
      expect(raw.sideCarryYd).toBe(-41.2);
    },
  );
  it("a per-shot review affects only that shot and can be reversed", () => {
    const dataConfidence = {
      directionReviews: { shot: { status: "questionable" as const, updatedAt: "now" } },
    };
    expect(directionIsUsable(dataConfidence, "shot")).toBe(false);
    expect(directionIsUsable(dataConfidence, "other")).toBe(true);
    expect(
      assessFlightEvidence({
        ...reported,
        dataConfidence: { directionReviews: { shot: { status: "confirmed", updatedAt: "now" } } },
      }),
    ).toMatchObject({ needsReview: false, directionConfidence: "supported" });
  });
  it("confirming an endpoint does not override session misalignment", () => {
    expect(
      assessFlightEvidence({
        ...reported,
        dataConfidence: {
          alignment: "misaligned",
          directionReviews: { shot: { status: "confirmed", updatedAt: "now" } },
        },
      }).directionUsable,
    ).toBe(false);
  });
  it("a supplied face and zero spin axis are not mistaken for missing evidence", () => {
    expect(
      assessFlightEvidence({
        ...reported,
        sourceRawJson: { ...reported.sourceRawJson, "Face Angle": "-1.3" },
        spinRate: 2200,
        spinAxis: 0,
      }),
    ).toMatchObject({ faceSource: "source_reported", needsReview: false });
  });
  it("missing and non-finite values cannot produce a curvature diagnosis", () => {
    expect(assessFlightEvidence({ carryYd: NaN, sideCarryYd: null })).toMatchObject({
      directionConfidence: "unavailable",
      needsReview: false,
      curvatureResidualYd: null,
    });
  });
});
