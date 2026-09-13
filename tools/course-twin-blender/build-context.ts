/** Offline OSM footprint conversion. Heights without tags are decorative estimates. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createCourseTwinProjector } from "../../src/lib/course-twin-geometry";
import {
  createCourseTwinTerrainSampler,
  decodeCourseTwinHeightmap,
} from "../../src/lib/course-twin-terrain";
const manifest = JSON.parse(readFileSync("src/generated/course-twins/aintree-v1.json", "utf8"));
const source = readFileSync("tools/course-twin-blender/.cache/context/aintree.json");
const osm = JSON.parse(source.toString());
if (osm.remark || !Array.isArray(osm.elements)) throw Error("Incomplete OSM response");
const hm = manifest.terrain.heightmap;
const bytes = readFileSync(`public${hm.url}`);
if (createHash("sha256").update(bytes).digest("hex") !== hm.sha256)
  throw Error("Heightfield mismatch");
const sample = createCourseTwinTerrainSampler(
  hm,
  decodeCourseTwinHeightmap(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    hm,
  ),
);
const project = createCourseTwinProjector(manifest.origin.latitude, manifest.origin.longitude);
type OsmWay = {
  type: string;
  id: number;
  nodes?: number[];
  geometry: { lat: number; lon: number }[];
  tags?: Record<string, string>;
};
const buildings = osm.elements
  .filter(
    (e: OsmWay) =>
      e.type === "way" &&
      e.nodes?.[0] === e.nodes?.at(-1) &&
      e.geometry?.length >= 4 &&
      e.geometry.length < 300,
  )
  .map((e: OsmWay) => {
    const ring = e.geometry
      .slice(0, -1)
      .map((p: { lat: number; lon: number }) => project(p.lat, p.lon));
    const height = Number(e.tags?.height);
    const levels = Number(e.tags?.["building:levels"]);
    const tagged = Number.isFinite(height) && height >= 2 && height <= 60;
    return {
      id: `way/${e.id}`,
      ring: ring.map((p: number[]) => [p[0], p[2]]),
      base: Math.min(...ring.map((p: number[]) => sample(p[0], p[2]))),
      height: tagged ? height : Math.max(3, Math.min(18, (levels || 2) * 3)),
      heightInferred: !tagged,
    };
  });
writeFileSync(
  "public/course-twins/common/blender-v1/aintree-buildings.json",
  JSON.stringify({
    courseId: manifest.course.id,
    origin: manifest.origin,
    source: "OpenStreetMap contributors",
    license: "ODbL-1.0",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    retrievedAt: new Date().toISOString(),
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    decorativeOnly: true,
    roofShapeInferred: true,
    buildings,
  }),
);
console.log(`${buildings.length} source footprints converted`);
