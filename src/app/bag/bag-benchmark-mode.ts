/** Keep the optional evidence load and every downstream replacement behind one switch. */
export async function loadBagBenchmarkMode<
  TClub,
  TEvidence extends { intelligence: unknown },
  TRow,
>({
  enabled,
  loadBag,
  loadEvidence,
  applyEvidence,
  buildLegacyRows,
  buildEvidenceRows,
}: {
  enabled: boolean;
  loadBag: () => Promise<TClub[]>;
  loadEvidence: () => Promise<TEvidence>;
  applyEvidence: (bag: TClub[], evidence: TEvidence) => TClub[];
  buildLegacyRows: (bag: TClub[]) => TRow[];
  buildEvidenceRows: (bag: TClub[], evidence: TEvidence) => TRow[];
}): Promise<{
  bag: TClub[];
  benchmarkRows: TRow[];
  intelligence: TEvidence["intelligence"] | undefined;
}> {
  const [legacyBag, evidence] = await Promise.all([
    loadBag(),
    enabled ? loadEvidence() : Promise.resolve(null),
  ]);
  if (evidence === null) {
    return { bag: legacyBag, benchmarkRows: buildLegacyRows(legacyBag), intelligence: undefined };
  }
  const bag = applyEvidence(legacyBag, evidence);
  return {
    bag,
    benchmarkRows: buildEvidenceRows(bag, evidence),
    intelligence: evidence.intelligence,
  };
}
