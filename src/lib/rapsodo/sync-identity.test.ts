import { describe, expect, it } from "vitest";

import { buildRapsodoSyncSessionKey, hashRapsodoExportCsv } from "@/lib/rapsodo/sync-identity";

describe("Rapsodo sync identity", () => {
  it("keys remote sync rows by provider kind and provider session id", () => {
    expect(buildRapsodoSyncSessionKey("practice", "abc")).toBe("practice:abc");
    expect(buildRapsodoSyncSessionKey("simulation", "abc")).toBe("simulation:abc");
    expect(buildRapsodoSyncSessionKey("practice", "abc")).not.toBe(
      buildRapsodoSyncSessionKey("simulation", "abc"),
    );
  });

  it("hashes exported CSV content for duplicate import detection", () => {
    const csv = "Club Type,Carry Distance\nDriver,240";

    expect(hashRapsodoExportCsv(csv)).toHaveLength(64);
    expect(hashRapsodoExportCsv(csv)).toBe(hashRapsodoExportCsv(csv));
    expect(hashRapsodoExportCsv(csv)).not.toBe(hashRapsodoExportCsv(`${csv}\n7 Iron,150`));
  });
});
