import { describe, expect, it, vi } from "vitest";
import { loadBagBenchmarkMode } from "./bag-benchmark-mode";

function fixture() {
  const trend = { status: "improving", deltaYd: 4 };
  const legacyBag = [
    { id: "synthetic-driver", stock: { carryYd: 190 }, stockTrend: trend as typeof trend | null },
  ];
  const legacyRows = [{ clubId: "synthetic-driver", carryYd: 210, method: "legacy" }];
  const evidence = {
    intelligence: { version: "synthetic-evidence" },
    currentCarryYd: 180,
    potentialCarryYd: 220,
  };
  const loadBag = vi.fn(async () => legacyBag);
  const loadEvidence = vi.fn(async () => evidence);
  const applyEvidence = vi.fn((bag: typeof legacyBag, loaded: typeof evidence) =>
    bag.map((club) => ({ ...club, stock: { carryYd: loaded.currentCarryYd }, stockTrend: null })),
  );
  const buildLegacyRows = vi.fn(() => legacyRows);
  const buildEvidenceRows = vi.fn((bag: typeof legacyBag, loaded: typeof evidence) => [
    { clubId: bag[0]!.id, carryYd: loaded.potentialCarryYd, method: "evidence" },
  ]);
  return {
    legacyBag,
    legacyRows,
    trend,
    evidence,
    loadBag,
    loadEvidence,
    applyEvidence,
    buildLegacyRows,
    buildEvidenceRows,
  };
}

describe("Bag benchmark feature mode (synthetic data)", () => {
  it("does not read evidence or replace legacy stock, trend, benchmark or gapping inputs when disabled", async () => {
    const f = fixture();
    f.loadEvidence.mockRejectedValue(new Error("Evidence is unavailable and must not be queried"));
    const result = await loadBagBenchmarkMode({ enabled: false, ...f });
    expect(f.loadBag).toHaveBeenCalledOnce();
    expect(f.loadEvidence).not.toHaveBeenCalled();
    expect(f.applyEvidence).not.toHaveBeenCalled();
    expect(f.buildEvidenceRows).not.toHaveBeenCalled();
    expect(f.buildLegacyRows).toHaveBeenCalledExactlyOnceWith(f.legacyBag);
    expect(result.bag).toBe(f.legacyBag);
    expect(result.bag[0]!.stock).toBe(f.legacyBag[0]!.stock);
    expect(result.bag[0]!.stockTrend).toBe(f.trend);
    expect(result.benchmarkRows).toBe(f.legacyRows);
    expect(result.intelligence).toBeUndefined();
    // Downstream gapping receives the selected Bag unchanged, rather than evidence-only carry.
    expect(result.bag.map((club) => club.stock.carryYd)).toEqual([190]);
  });
  it("loads and applies one evidence snapshot to stock, benchmarks and the optional panel when enabled", async () => {
    const f = fixture();
    const result = await loadBagBenchmarkMode({ enabled: true, ...f });
    expect(f.loadEvidence).toHaveBeenCalledOnce();
    expect(f.applyEvidence).toHaveBeenCalledExactlyOnceWith(f.legacyBag, f.evidence);
    expect(f.buildLegacyRows).not.toHaveBeenCalled();
    expect(f.buildEvidenceRows).toHaveBeenCalledExactlyOnceWith(result.bag, f.evidence);
    expect(result.bag).not.toBe(f.legacyBag);
    expect(result.bag[0]!.stockTrend).toBeNull();
    expect(result.bag.map((club) => club.stock.carryYd)).toEqual([180]);
    expect(result.benchmarkRows).toEqual([
      { clubId: "synthetic-driver", carryYd: 220, method: "evidence" },
    ]);
    expect(result.intelligence).toBe(f.evidence.intelligence);
    expect(f.legacyBag[0]!.stock.carryYd).toBe(190);
    expect(f.legacyBag[0]!.stockTrend).toBe(f.trend);
  });
  it("preserves evidence failure when enabled instead of silently switching calculation modes", async () => {
    const f = fixture();
    f.loadEvidence.mockRejectedValue(new Error("Evidence unavailable"));
    await expect(loadBagBenchmarkMode({ enabled: true, ...f })).rejects.toThrow(
      "Evidence unavailable",
    );
    expect(f.buildLegacyRows).not.toHaveBeenCalled();
    expect(f.applyEvidence).not.toHaveBeenCalled();
  });
});
