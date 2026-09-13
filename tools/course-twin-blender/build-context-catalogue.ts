import { parkedCarClearOfPlay } from "../../src/lib/course-twin-scenery";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { courseTwinFeatureContains } from "../../src/lib/course-twin-surface";
import { createCourseTwinProjector } from "../../src/lib/course-twin-geometry";
import {
  createCourseTwinTerrainSampler,
  decodeCourseTwinHeightmap,
} from "../../src/lib/course-twin-terrain";
const registry: Record<string, string> = {};
const out = "public/course-twins/common/context-v1";
mkdirSync(out, { recursive: true });
for (const file of readdirSync("tools/course-twin-blender/.cache/context").filter((f) =>
  f.endsWith("-context.json"),
)) {
  const slug = file.replace("-context.json", "");
  const m = JSON.parse(readFileSync(`src/generated/course-twins/${slug}.json`, "utf8"));
  const data = JSON.parse(readFileSync(`tools/course-twin-blender/.cache/context/${file}`, "utf8"));
  const hm = m.terrain.heightmap;
  if (!hm) continue;
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
  const project = createCourseTwinProjector(m.origin.latitude, m.origin.longitude);
  const features = [];
  const buildings = [];
  const roads: {
    id: string;
    kind: string;
    width: number;
    widthInferred: boolean;
    points: [number, number, number][];
  }[] = [];
  const parking = [];
  const cars = [];
  for (const e of data.elements) {
    const ring = e.geometry.map((p: { lat: number; lon: number }) => {
      const q = project(p.lat, p.lon);
      q[1] = sample(q[0], q[2]);
      return q;
    });
    if (
      ring.length > 300 ||
      ring.some(
        (p: number[]) =>
          !p.every(Number.isFinite) ||
          p[0] < hm.localBounds.minX ||
          p[0] > hm.localBounds.maxX ||
          p[2] < hm.localBounds.minZ ||
          p[2] > hm.localBounds.maxZ,
      )
    )
      continue;
    const type = e.tags.golf;
    if (e.tags.highway) {
      if (
        e.tags.bridge === "yes" ||
        e.tags.tunnel === "yes" ||
        (e.tags.layer && e.tags.layer !== "0")
      )
        continue;
      const widths: Record<string, number> = {
        motorway: 12,
        trunk: 10,
        primary: 8,
        secondary: 7,
        tertiary: 6,
        residential: 5.5,
        unclassified: 5,
        service: 3.8,
        living_street: 4,
        pedestrian: 3,
        footway: 1.5,
        path: 1.3,
        cycleway: 2.5,
        track: 3,
      };
      const tagged = Number(e.tags.width);
      const width =
        Number.isFinite(tagged) && tagged >= 0.6 && tagged <= 20
          ? tagged
          : (widths[e.tags.highway] ?? 3);
      roads.push({
        id: `way/${e.id}`,
        kind: e.tags.highway,
        width,
        widthInferred: !Number.isFinite(tagged) || tagged <= 0,
        points: ring,
      });
      continue;
    }
    if (e.tags.amenity === "parking") {
      parking.push({ id: `way/${e.id}`, ring });
      const edges = ring
        .slice(1)
        .map((p: number[], i: number) => ({ dx: p[0] - ring[i][0], dz: p[2] - ring[i][2] }));
      const longest = edges.sort(
        (a: { dx: number; dz: number }, b: { dx: number; dz: number }) =>
          Math.hypot(b.dx, b.dz) - Math.hypot(a.dx, a.dz),
      )[0];
      const length = Math.hypot(longest.dx, longest.dz) || 1;
      const ux = longest.dx / length,
        uz = longest.dz / length,
        vx = -uz,
        vz = ux;
      const local = ring.map((p: number[]) => [p[0] * ux + p[2] * uz, p[0] * vx + p[2] * vz]);
      const bounds = {
        minX: Math.min(...local.map((p: number[]) => p[0])),
        maxX: Math.max(...local.map((p: number[]) => p[0])),
        minZ: Math.min(...local.map((p: number[]) => p[1])),
        maxZ: Math.max(...local.map((p: number[]) => p[1])),
      };
      const area = {
        id: "parking",
        type: "rough" as const,
        source: "osm",
        holeNumber: null,
        rings: [ring],
      };
      let i = 0;
      for (let v = bounds.minZ + 3; v < bounds.maxZ - 3 && cars.length < 160; v += 6.4)
        for (let u = bounds.minX + 2; u < bounds.maxX - 2 && cars.length < 160; u += 3.2) {
          i++;
          if ((i + Number(e.id)) % 5 > 1) continue;
          const x = u * ux + v * vx,
            z = u * uz + v * vz;
          if (
            ![
              [-1.5, -2.7],
              [1.5, -2.7],
              [-1.5, 2.7],
              [1.5, 2.7],
            ].every(([dx, dz]) =>
              courseTwinFeatureContains(area, x + dx * ux + dz * vx, z + dx * uz + dz * vz),
            )
          )
            continue;
          cars.push({
            x,
            y: sample(x, z) + 0.06,
            z,
            height: 1.48,
            widthScale: 1,
            tint: 0,
            variant: i % 6,
            rotation: -Math.atan2(uz, ux) + (i % 2) * Math.PI,
          });
        }
      continue;
    }
    if (["green", "bunker", "tee", "fairway", "rough"].includes(type))
      features.push({
        id: `context-osm-way-${e.id}`,
        type,
        source: "openstreetmap_context",
        holeNumber: null,
        rings: [ring],
      });
    else if (e.tags.building && buildings.length < 2000) {
      const height = Number(e.tags.height);
      const levels = Number(e.tags["building:levels"]);
      const tagged = Number.isFinite(height) && height >= 2 && height <= 60;
      buildings.push({
        id: `way/${e.id}`,
        ring: ring.slice(0, -1).map((p: number[]) => [p[0], p[2]]),
        base: Math.min(...ring.map((p: number[]) => p[1])),
        height: tagged ? height : Math.max(3, Math.min(18, (levels || 2) * 3)),
        heightInferred: !tagged,
      });
    }
  }
  const parkedCars = cars.filter(
    (car) =>
      parkedCarClearOfPlay(car, [...m.features, ...features]) &&
      !roads.some((road) =>
        road.points.slice(1).some((b: number[], i: number) => {
          const a = road.points[i];
          const dx = b[0] - a[0],
            dz = b[2] - a[2];
          const t = Math.max(
            0,
            Math.min(1, ((car.x - a[0]) * dx + (car.z - a[2]) * dz) / (dx * dx + dz * dz || 1)),
          );
          return Math.hypot(car.x - a[0] - t * dx, car.z - a[2] - t * dz) < road.width / 2 + 2.7;
        }),
      ),
  );
  const name = `${slug}.json`;
  writeFileSync(
    `${out}/${name}`,
    JSON.stringify({
      courseId: m.course.id,
      origin: m.origin,
      terrainSha256: hm.sha256,
      source: "OpenStreetMap contributors",
      license: "ODbL-1.0",
      sourceUrl: data.sourceUrl,
      sourceSha256: data.sourceSha256,
      retrievedAt: data.retrievedAt,
      decorativeOnly: true,
      roofShapeInferred: true,
      features,
      buildings,
      roads,
      parking,
      cars: parkedCars,
    }),
  );
  registry[m.course.id] = `/course-twins/common/context-v1/${name}`;
  console.log(
    slug,
    features.length,
    "surfaces",
    buildings.length,
    "buildings",
    roads.length,
    "roads",
    parkedCars.length,
    "cars",
  );
}
writeFileSync(
  "src/generated/course-twins/context-assets.json",
  JSON.stringify(registry, null, 2) + "\n",
);
