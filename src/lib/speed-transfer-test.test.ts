import { describe, expect, it } from "vitest";

import {
  buildPersonalDriverCorridor,
  buildSpeedTransferMetadata,
  readSpeedTransferMetadata,
  withSpeedTransferMetadata,
} from "@/lib/speed-transfer-test";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const SHOT_IDS = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000003",
  "20000000-0000-4000-8000-000000000004",
  "20000000-0000-4000-8000-000000000005",
] as const;

describe("speed transfer-test metadata", () => {
  it("persists one explicit shot-session link and exactly five unique shots", () => {
    const corridor = buildPersonalDriverCorridor([-12, -10, -8, -6, -4, 2, 4, 6, 8, 10, 12]);
    const transferTest = buildSpeedTransferMetadata({
      shotSessionId: SESSION_ID,
      shotIds: SHOT_IDS,
      linkedAtIso: "2026-08-22T18:00:00.000Z",
      corridor,
    });
    const metadata = withSpeedTransferMetadata({ entryMode: "readings" }, transferTest);

    expect(metadata).toMatchObject({ entryMode: "readings", transferTest });
    expect(readSpeedTransferMetadata(metadata)).toEqual(transferTest);
    expect(readSpeedTransferMetadata(metadata)?.corridor).toEqual(corridor);
  });

  it("rejects duplicate, partial, and malformed transfer links", () => {
    expect(() =>
      buildSpeedTransferMetadata({
        shotSessionId: SESSION_ID,
        shotIds: [...SHOT_IDS.slice(0, 4), SHOT_IDS[0]],
      }),
    ).toThrow("five unique shot UUIDs");
    expect(readSpeedTransferMetadata({ transferTest: { version: 1 } })).toBeNull();
  });

  it("can clear a prior link without discarding unrelated session metadata", () => {
    const metadata = withSpeedTransferMetadata(
      {
        entryMode: "readings",
        transferTest: buildSpeedTransferMetadata({
          shotSessionId: SESSION_ID,
          shotIds: SHOT_IDS,
          linkedAtIso: "2026-08-22T18:00:00.000Z",
        }),
      },
      null,
    );

    expect(metadata).toEqual({ entryMode: "readings" });
  });
});

describe("personal Driver transfer corridor", () => {
  it("uses the central 80 percent around the golfer's median", () => {
    const corridor = buildPersonalDriverCorridor([-22, -16, -12, -9, -5, -2, 1, 4, 7, 10, 14, 18]);

    expect(corridor).toMatchObject({
      centreSideCarryYd: -0.5,
      sampleSize: 12,
      basis: "personal_80_percent",
    });
    expect(corridor.minSideCarryYd).toBeLessThan(-10);
    expect(corridor.maxSideCarryYd).toBeGreaterThan(10);
  });

  it("uses an honest provisional Driver corridor below ten historical samples", () => {
    expect(buildPersonalDriverCorridor([-4, 2, 6])).toEqual({
      minSideCarryYd: -30,
      maxSideCarryYd: 30,
      centreSideCarryYd: 0,
      halfWidthYd: 30,
      sampleSize: 3,
      basis: "provisional_driver",
    });
  });

  it("caps an established personal corridor at thirty yards each side", () => {
    const corridor = buildPersonalDriverCorridor([
      -100, -80, -50, -40, -30, 0, 20, 40, 60, 80, 100,
    ]);

    expect(corridor.halfWidthYd).toBe(30);
  });
});
