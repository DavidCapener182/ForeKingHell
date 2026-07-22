import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { dataGovernanceManifest } from "@/lib/data-governance-manifest";

describe("data governance manifest", () => {
  it("classifies every schema table or view exactly once", () => {
    const schemaSource = readFileSync(join(process.cwd(), "src/db/schema.ts"), "utf8");
    const schemaDatasets = Array.from(
      schemaSource.matchAll(/export const (\w+) = pg(?:Table|View)\(/g),
      (match) => match[1],
    ).sort();
    const manifestDatasets = dataGovernanceManifest.map((entry) => entry.dataset).sort();

    expect(new Set(manifestDatasets).size).toBe(manifestDatasets.length);
    expect(manifestDatasets).toEqual(schemaDatasets);
  });

  it("gives every dataset an explicit owner, export, deletion and retention decision", () => {
    for (const entry of dataGovernanceManifest) {
      expect(entry.table).toMatch(/^fkh_/);
      expect(typeof entry.export).toBe("boolean");
      expect(entry.deletion).toMatch(/^(cascade|explicit|retain|anonymize)$/);
      expect(entry.retention).toMatch(
        /^(account-lifetime|user-controlled|legal|operational|permanent)$/,
      );
      if (entry.export) expect(entry.ownerFields.length).toBeGreaterThan(0);
      for (const rule of entry.exportRules ?? []) {
        expect(entry.ownerFields).toContain(rule.ownerField);
        if (rule.requiredField) expect(rule.allowedValues?.length).toBeGreaterThan(0);
      }
    }
  });

  it("exports coach-only notes to their author but not to the player", () => {
    const entry = dataGovernanceManifest.find(
      (candidate) => candidate.dataset === "coachPlayerInteractions",
    );

    expect(entry?.exportRules).toEqual([
      { ownerField: "coachUserId" },
      {
        ownerField: "playerUserId",
        requiredField: "visibility",
        allowedValues: ["player_visible"],
      },
    ]);
  });
});
