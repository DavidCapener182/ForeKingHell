import { describe, expect, it } from "vitest";

import {
  buildEstablishedClubProfile,
  triageImportedShotQuality,
  type EstablishedClubProfile,
  type ImportedShotForTriage,
} from "@/lib/imports/shot-quality-triage";

const establishedProfile = (
  overrides: Partial<EstablishedClubProfile> = {},
): EstablishedClubProfile => ({
  clubType: "7i",
  sampleSize: 24,
  carryYd: { median: 147, medianAbsoluteDeviation: 4, p25: 143, p75: 151 },
  ballSpeedMph: { median: 105, medianAbsoluteDeviation: 3, p25: 102, p75: 108 },
  smashFactor: { median: 1.38, medianAbsoluteDeviation: 0.03, p25: 1.35, p75: 1.41 },
  ...overrides,
});

const shot = (overrides: Partial<ImportedShotForTriage> = {}): ImportedShotForTriage => ({
  club: { type: "7i", rawLabel: "7 Iron", provenance: "source" },
  carryYd: 147,
  totalYd: 151,
  ballSpeedMph: 105,
  clubSpeedMph: 76,
  smashFactor: 1.38,
  shotCategory: "full",
  ...overrides,
});

describe("triageImportedShotQuality", () => {
  it("quarantines only an impossible total-distance field and keeps the genuine carry", () => {
    const input = shot({ carryYd: 136.8, totalYd: 8.8 });
    const result = triageImportedShotQuality(input, establishedProfile());

    expect(result.classification).toBe("bad_data_field");
    expect(result.fieldQuarantines).toEqual([
      expect.objectContaining({ field: "totalYd", value: 8.8, code: "total_below_carry" }),
    ]);
    expect(input.carryYd).toBe(136.8);
    expect(input.totalYd).toBe(8.8);
  });

  it("quarantines a reported smash value that contradicts measured ball and club speed", () => {
    const result = triageImportedShotQuality(
      shot({ ballSpeedMph: 100, clubSpeedMph: 80, smashFactor: 1.5 }),
      establishedProfile(),
    );

    expect(result.classification).toBe("bad_data_field");
    expect(result.fieldQuarantines).toEqual([
      expect.objectContaining({ field: "smashFactor", code: "smash_speed_mismatch" }),
    ]);
  });

  it.each([
    {
      label: "7.7-yard PW top",
      input: shot({
        club: { type: "pw", rawLabel: "PW", provenance: "source" },
        carryYd: 7.7,
        totalYd: 9,
        ballSpeedMph: 28,
        clubSpeedMph: 55,
        smashFactor: 0.51,
      }),
      profile: establishedProfile({
        clubType: "pw",
        carryYd: { median: 110, medianAbsoluteDeviation: 5, p25: 105, p75: 116 },
        ballSpeedMph: { median: 84, medianAbsoluteDeviation: 4, p25: 80, p75: 88 },
        smashFactor: { median: 1.25, medianAbsoluteDeviation: 0.04, p25: 1.2, p75: 1.29 },
      }),
    },
    {
      label: "102.8-yard 5W with 1.02 smash",
      input: shot({
        club: { type: "5w", rawLabel: "5 Wood", provenance: "mapped_source" },
        carryYd: 102.8,
        totalYd: 112,
        ballSpeedMph: 84,
        clubSpeedMph: 82.4,
        smashFactor: 1.02,
      }),
      profile: establishedProfile({
        clubType: "5w",
        carryYd: { median: 178, medianAbsoluteDeviation: 7, p25: 170, p75: 185 },
        ballSpeedMph: { median: 119, medianAbsoluteDeviation: 4, p25: 115, p75: 123 },
        smashFactor: { median: 1.43, medianAbsoluteDeviation: 0.03, p25: 1.4, p75: 1.46 },
      }),
    },
    {
      label: "103.9-yard 6i with low ball speed",
      input: shot({
        club: { type: "6i", rawLabel: "6 Iron", provenance: "source" },
        carryYd: 103.9,
        totalYd: 111,
        ballSpeedMph: 85.5,
        clubSpeedMph: 75,
        smashFactor: 1.14,
      }),
      profile: establishedProfile({
        clubType: "6i",
        carryYd: { median: 151, medianAbsoluteDeviation: 4, p25: 147, p75: 154 },
        ballSpeedMph: { median: 108, medianAbsoluteDeviation: 3, p25: 105, p75: 111 },
      }),
    },
    {
      label: "140-yard driver despite normal ball speed",
      input: shot({
        club: { type: "driver", rawLabel: "Driver", provenance: "source" },
        carryYd: 140,
        totalYd: 151,
        ballSpeedMph: 130.5,
        clubSpeedMph: 89,
        smashFactor: 1.47,
      }),
      profile: establishedProfile({
        clubType: "driver",
        carryYd: { median: 199, medianAbsoluteDeviation: 6, p25: 193, p75: 204 },
        ballSpeedMph: { median: 130, medianAbsoluteDeviation: 2.5, p25: 127, p75: 132 },
        smashFactor: { median: 1.46, medianAbsoluteDeviation: 0.02, p25: 1.44, p75: 1.48 },
      }),
    },
  ])("suggests review for a likely mishit: $label", ({ input, profile }) => {
    const result = triageImportedShotQuality(input, profile);

    expect(result.classification).toBe("likely_mishit");
    expect(result.evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "carry_far_below_profile" })]),
    );
    expect(result.profileUsed).toBe(true);
    expect(result.fieldQuarantines).toEqual([]);
  });

  it.each([
    {
      clubType: "5i",
      carryYd: 120.3,
      median: 158,
      mad: 5,
      p05: 125,
      p25: 152,
      p75: 163,
    },
    {
      clubType: "5i",
      carryYd: 123.6,
      median: 158,
      mad: 5,
      p05: 125,
      p25: 152,
      p75: 163,
    },
    {
      clubType: "7i",
      carryYd: 122.5,
      median: 147,
      mad: 4,
      p05: 125,
      p25: 143,
      p75: 151,
    },
    {
      clubType: "7i",
      carryYd: 124.7,
      median: 147,
      mad: 4,
      p05: 125,
      p25: 143,
      p75: 151,
    },
  ])(
    "keeps the weak $clubType $carryYd-yard strike in a confirm-only review tier",
    ({ clubType, carryYd, median, mad, p05, p25, p75 }) => {
      const result = triageImportedShotQuality(
        shot({
          club: { type: clubType, rawLabel: clubType, provenance: "source" },
          carryYd,
          totalYd: carryYd + 5,
          ballSpeedMph: 95,
          clubSpeedMph: null,
        }),
        establishedProfile({
          clubType,
          carryYd: { median, medianAbsoluteDeviation: mad, p05, p25, p75 },
          ballSpeedMph: { median: 110, medianAbsoluteDeviation: 4, p25: 102, p75: 115 },
        }),
      );

      expect(result.classification).toBe("needs_review");
      expect(result.evidence[0]?.code).toBe("carry_far_below_profile");
    },
  );

  it("does not suggest a low-tail carry when strike signals remain healthy", () => {
    const result = triageImportedShotQuality(
      shot({ carryYd: 124, ballSpeedMph: 106, smashFactor: 1.38 }),
      establishedProfile({
        carryYd: { median: 147, medianAbsoluteDeviation: 4, p05: 125, p25: 143, p75: 151 },
      }),
    );

    expect(result.classification).toBe("stock_quality");
  });

  it.each([6.6, 9.8, 16.4, 19.7, 20.8, 27.4, 33.9, 50.3])(
    "treats a trusted-source SW shot at %s yards as partial, not a mishit",
    (carryYd) => {
      const result = triageImportedShotQuality(
        shot({
          club: { type: "sw", rawLabel: "SW", provenance: "source" },
          carryYd,
          totalYd: carryYd + 1,
          ballSpeedMph: null,
          clubSpeedMph: null,
          smashFactor: null,
        }),
      );

      expect(result.classification).toBe("partial_shot");
      expect(result.fieldQuarantines).toEqual([]);
    },
  );

  it("does not call a slow golfer's established full SW strike partial just because it is short", () => {
    const result = triageImportedShotQuality(
      shot({
        club: { type: "sw", rawLabel: "SW", provenance: "source" },
        carryYd: 50.3,
        totalYd: 52,
      }),
      establishedProfile({
        clubType: "sw",
        carryYd: { median: 55, medianAbsoluteDeviation: 4, p25: 51, p75: 59 },
      }),
    );

    expect(result.classification).toBe("stock_quality");
  });

  it("never marks an exceptional long strike bad solely for being above its profile", () => {
    const result = triageImportedShotQuality(
      shot({
        club: { type: "5i", rawLabel: "5 Iron", provenance: "source" },
        carryYd: 173,
        totalYd: 180,
        ballSpeedMph: 121,
        clubSpeedMph: 83,
        smashFactor: 1.46,
      }),
      establishedProfile({
        clubType: "5i",
        carryYd: { median: 157, medianAbsoluteDeviation: 6, p25: 151, p75: 162 },
        ballSpeedMph: { median: 112, medianAbsoluteDeviation: 4, p25: 108, p75: 116 },
      }),
    );

    expect(result.classification).toBe("stock_quality");
    expect(result.evidence).toEqual([]);
  });

  it("keeps an ordinary low-side strike inside the conservative review boundary", () => {
    const result = triageImportedShotQuality(
      shot({ carryYd: 132, totalYd: 136, ballSpeedMph: 99, smashFactor: 1.31 }),
      establishedProfile(),
    );

    expect(result.classification).toBe("stock_quality");
    expect(result.evidence).toEqual([]);
  });

  it("requires a sufficiently established, matching profile before using distance signals", () => {
    const weakShot = shot({ carryYd: 103, totalYd: 110, ballSpeedMph: 84, smashFactor: 1.1 });

    expect(
      triageImportedShotQuality(weakShot, establishedProfile({ sampleSize: 19 })).classification,
    ).toBe("stock_quality");
    expect(
      triageImportedShotQuality(weakShot, establishedProfile({ sampleSize: Number.NaN }))
        .classification,
    ).toBe("stock_quality");
    expect(
      triageImportedShotQuality(weakShot, establishedProfile({ clubType: "6i" })).classification,
    ).toBe("stock_quality");
    expect(
      triageImportedShotQuality(
        shot({ ...weakShot, club: { type: "7i", rawLabel: null, provenance: "inferred" } }),
        establishedProfile(),
      ).classification,
    ).toBe("stock_quality");
  });

  it("honours an explicit partial category without requiring a distance profile", () => {
    const result = triageImportedShotQuality(
      shot({ shotCategory: "pitch", carryYd: 82, totalYd: 84 }),
    );

    expect(result.classification).toBe("partial_shot");
    expect(result.evidence).toEqual([
      expect.objectContaining({ code: "explicit_partial_category" }),
    ]);
  });

  it("builds robust profiles only after twenty trusted rows", () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      carryYd: 140 + index,
      ballSpeedMph: 100 + index / 2,
      smashFactor: 1.3 + index / 100,
    }));

    expect(buildEstablishedClubProfile("7i", rows.slice(0, 19))).toBeNull();
    expect(buildEstablishedClubProfile("7i", rows)).toMatchObject({
      clubType: "7i",
      sampleSize: 20,
      carryYd: {
        median: 149.5,
        p05: 140.95,
        p25: 144.75,
        p75: 154.25,
      },
    });
  });

  it("allows a conservative five-shot profile only when it is scoped to the current import", () => {
    const rows = [148, 149, 150, 151, 103].map((carryYd) => ({
      carryYd,
      ballSpeedMph: carryYd === 103 ? 85.5 : 108,
      smashFactor: carryYd === 103 ? 1.14 : 1.36,
    }));
    const sessionProfile = buildEstablishedClubProfile("6i", rows, {
      scope: "import_session",
    });

    expect(sessionProfile).toMatchObject({
      clubType: "6i",
      sampleSize: 5,
      scope: "import_session",
    });
    expect(
      triageImportedShotQuality(
        shot({
          club: { type: "6i", rawLabel: "6i", provenance: "source" },
          carryYd: 103,
          ballSpeedMph: 85.5,
          smashFactor: 1.14,
        }),
        sessionProfile,
      ).classification,
    ).toBe("likely_mishit");
  });
});
