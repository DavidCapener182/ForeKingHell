import { describe, expect, it } from "vitest";
import {
  getClubBenchmarkDefinition,
  getClubDistanceBenchmark,
  compareClubCarryToBenchmark,
  BENCHMARK_REFERENCE_VERSION,
} from "@/lib/club-benchmarks";

describe("versioned legacy benchmark registry", () => {
  it("preserves exact internal carry bands and separates the legacy Tour anchor", () => {
    const driver = getClubBenchmarkDefinition("driver", "carryYd")!;
    expect(driver.version).toBe("lmwt-legacy-v1");
    expect(driver.bands.map((band) => band.value)).toEqual([180, 220, 250, 280, 296]);
    expect(driver.tourReference.value).toBe(275);
    expect(driver.tourReference.verified).toBe(false);
    expect(driver.sourceDate).toBeNull();
    expect(driver.source).toContain("internal");
    expect(driver.population).toContain("not measured population");
    expect(driver.impactSummary).toContain("preserved");
  });
  it("retains all wedge bands without inventing missing Tour values", () => {
    expect(getClubDistanceBenchmark("sw")?.levels.map((band) => band.yards)).toEqual([
      55, 80, 95, 115, 124,
    ]);
    expect(getClubBenchmarkDefinition("sw", "carryYd")?.tourReference.value).toBeNull();
    expect(getClubBenchmarkDefinition("sw", "clubSpeedMph")).toBeNull();
  });
  it("uses the mean threshold and numerical gap rather than individual-shot qualification", () => {
    const seven = getClubBenchmarkDefinition("7i", "carryYd")!;
    expect(compareClubCarryToBenchmark("7i", 157.9)?.yardsToNextLevel).toBe(7.1);
    expect(seven.nextLevelSemantics).toContain("individual shots need not all exceed");
    expect(seven.version).toBe(BENCHMARK_REFERENCE_VERSION);
  });
  it("qualifies above-reference flight and efficiency without prescribing increases", () => {
    expect(getClubBenchmarkDefinition("driver", "landAngleDeg")?.interpretation).toContain(
      "not necessarily a better flight",
    );
    expect(getClubBenchmarkDefinition("7i", "smashFactor")?.interpretation).toContain(
      "does not establish centred contact",
    );
  });
});
