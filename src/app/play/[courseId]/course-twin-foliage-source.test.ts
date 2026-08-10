import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(
  resolve(process.cwd(), "src/app/play/[courseId]/course-twin-scene.tsx"),
  "utf8",
);
const vegetationLedgerSource = readFileSync(
  resolve(process.cwd(), "public/course-twins/common/vegetation/assets.json"),
  "utf8",
);
const materialsLedgerSource = readFileSync(
  resolve(process.cwd(), "public/course-twins/common/materials/assets.json"),
  "utf8",
);

const highDetailAssets = [
  "tree-oak-hq.webp",
  "tree-birch-hq.webp",
  "tree-sycamore-hq.webp",
  "shrub-hawthorn-hq.webp",
] as const;

const highDetailSurfaceMaps = [
  ["Grass001", "rough"],
  ["Grass005", "fairway"],
  ["Grass008", "green"],
  ["Ground080", "bunker"],
] as const;

describe("Course Twin high-detail foliage", () => {
  it("uses high-detail local alpha assets in the instanced authenticated renderer", () => {
    for (const asset of highDetailAssets) {
      expect(sceneSource).toContain(`/course-twins/common/vegetation/high-detail/${asset}`);
      expect(
        statSync(resolve(process.cwd(), "public/course-twins/common/vegetation/high-detail", asset))
          .size,
      ).toBeGreaterThan(150_000);
    }

    expect(sceneSource).toContain("InstancedVegetationBillboard");
    expect(sceneSource).toContain("InstancedBillboardPlane");
    expect(sceneSource).toContain("alphaTest={0.34}");

    const billboardSource = sceneSource.slice(
      sceneSource.indexOf("function InstancedBillboardPlane"),
    );
    expect(billboardSource).toContain("<meshStandardMaterial");
    expect(billboardSource).toContain("transparent");
    expect(billboardSource).not.toContain("vertexColors");
  });

  it("keeps the high-detail assets local, alpha-bearing and documented", async () => {
    expect(vegetationLedgerSource).toContain(
      "Course Twin High-detail British Parkland Foliage Billboards",
    );
    expect(vegetationLedgerSource).toContain("soft alpha matting and despill");
    expect(vegetationLedgerSource).toContain("alpha WebP for browser delivery");

    const metadata = await Promise.all(
      highDetailAssets.map((asset) =>
        sharp(
          resolve(process.cwd(), "public/course-twins/common/vegetation/high-detail", asset),
        ).metadata(),
      ),
    );

    for (const asset of metadata) {
      expect(asset.format).toBe("webp");
      expect(asset.hasAlpha).toBe(true);
      expect(asset.width).toBe(1024);
    }
  });

  it("gives rough, fairway, green and bunker their own high-detail PBR material treatment", async () => {
    expect(sceneSource).toContain("const highDetailSurfaceMaps");
    expect(sceneSource).toContain("courseBlendedNormal");
    expect(sceneSource).toContain("courseSurfaceRoughness");
    expect(sceneSource).toContain("normal = normalize(tbn * courseBlendedNormal)");
    expect(sceneSource).toContain("course-surface-normal-atlas.webp");
    expect(sceneSource).toContain("course-surface-roughness-atlas.webp");
    expect(sceneSource).toContain("courseSurfaceRoughnessAtlas");

    for (const [material, surface] of highDetailSurfaceMaps) {
      expect(sceneSource).toContain(`${surface}: {`);
      expect(sceneSource).toContain(`high-detail/${material}-Color.webp`);
      expect(sceneSource).toContain(`metresPerTile: pbrSurfaceAssets.${surface}.metresPerTile`);
    }

    expect(materialsLedgerSource).toContain("Course Twin High-detail Surface Material Derivatives");
    expect(materialsLedgerSource).toContain("CC0 1.0");

    const colourMetadata = await Promise.all(
      highDetailSurfaceMaps.map(([material]) =>
        sharp(
          resolve(
            process.cwd(),
            "public/course-twins/common/materials/high-detail",
            `${material}-Color.webp`,
          ),
        ).metadata(),
      ),
    );
    const atlasMetadata = await Promise.all(
      ["course-surface-normal-atlas.webp", "course-surface-roughness-atlas.webp"].map((asset) =>
        sharp(
          resolve(process.cwd(), "public/course-twins/common/materials/high-detail", asset),
        ).metadata(),
      ),
    );

    for (const asset of colourMetadata) {
      expect(asset.format).toBe("webp");
      expect(asset.width).toBe(1536);
    }
    expect(atlasMetadata[0]).toMatchObject({ format: "webp", width: 2048, height: 2048 });
    expect(atlasMetadata[1]).toMatchObject({ format: "webp", width: 1024, height: 1024 });
  });
});
