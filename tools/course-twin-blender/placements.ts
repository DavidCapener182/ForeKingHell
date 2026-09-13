import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import {
  buildTreeInstances,
  buildBushInstances,
} from "../../src/lib/course-twin-vegetation-placement";
import { sceneryClearOfPlay } from "../../src/lib/course-twin-scenery";
import {
  createCourseTwinTerrainSampler,
  decodeCourseTwinHeightmap,
} from "../../src/lib/course-twin-terrain";
import type { CourseTwinManifest } from "../../src/lib/course-twin-contract";

const file = resolve(process.argv[2] ?? "src/generated/course-twins/arscott-v1.json");
const source = readFileSync(file);
const manifest: CourseTwinManifest = JSON.parse(source.toString());
const hm = manifest.terrain.heightmap;
if (!hm || !hm.url.startsWith("/course-twins/") || hm.url.includes(".."))
  throw new Error("A local packaged heightfield is required");
const bytes = readFileSync(resolve("public", hm.url.slice(1)));
if (createHash("sha256").update(bytes).digest("hex") !== hm.sha256)
  throw new Error("Heightfield checksum mismatch");
const samples = decodeCourseTwinHeightmap(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  hm,
);
const sample = createCourseTwinTerrainSampler(hm, samples);
const bounds = hm.localBounds;
const trees = buildTreeInstances(manifest.features, manifest.holes, bounds, sample).filter((p) =>
  sceneryClearOfPlay(p, manifest.features),
);
const bushes = buildBushInstances(manifest.features, manifest.holes, bounds, sample).filter((p) =>
  sceneryClearOfPlay(p, manifest.features),
);
mkdirSync("tools/course-twin-blender/scenes", { recursive: true });
const output = `tools/course-twin-blender/scenes/${basename(file, ".json")}-placements.json`;
writeFileSync(
  output,
  JSON.stringify(
    {
      schemaVersion: 1,
      courseId: manifest.course.id,
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      coordinateSystem: "x east, y up, z south; metres",
      decorativeOnly: true,
      inferredPlacement: true,
      trees,
      bushes,
    },
    null,
    2,
  ),
);
console.log(`${output}: ${trees.length} trees, ${bushes.length} bushes`);
