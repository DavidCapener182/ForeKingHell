import type { CourseTwinPuttingSurface, CourseTwinTerrainAsset } from "@/lib/course-twin-contract";

export type CourseTwinTerrainSampler = (x: number, z: number) => number;

export function decodeCourseTwinHeightmap(
  buffer: ArrayBuffer,
  asset: CourseTwinTerrainAsset,
): Float32Array {
  const expectedBytes = asset.width * asset.height * Float32Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength !== expectedBytes) {
    throw new Error(
      `Terrain package size mismatch: expected ${expectedBytes} bytes, received ${buffer.byteLength}.`,
    );
  }

  const values = new Float32Array(asset.width * asset.height);
  const view = new DataView(buffer);
  for (let index = 0; index < values.length; index += 1) {
    const value = view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true);
    if (!Number.isFinite(value)) throw new Error(`Terrain package sample ${index} is not finite.`);
    values[index] = value;
  }
  return values;
}

export function createCourseTwinTerrainSampler(
  asset: CourseTwinTerrainAsset,
  values: Float32Array,
  puttingSurfaces: CourseTwinPuttingSurface[] = [],
): CourseTwinTerrainSampler {
  if (values.length !== asset.width * asset.height) {
    throw new Error("Terrain sample count does not match its manifest dimensions.");
  }

  const { minX, maxX, minZ, maxZ } = asset.localBounds;
  const widthSpan = Math.max(Number.EPSILON, maxX - minX);
  const depthSpan = Math.max(Number.EPSILON, maxZ - minZ);

  return (x, z) => {
    const puttingSurface = puttingSurfaces.find((surface) =>
      pointIsInsideBounds(x, z, surface.localBounds),
    );
    if (puttingSurface) return samplePuttingSurface(puttingSurface, x, z);
    const column = clamp(((x - minX) / widthSpan) * (asset.width - 1), 0, asset.width - 1);
    const row = clamp(((z - minZ) / depthSpan) * (asset.height - 1), 0, asset.height - 1);
    const left = Math.floor(column);
    const right = Math.min(asset.width - 1, left + 1);
    const top = Math.floor(row);
    const bottom = Math.min(asset.height - 1, top + 1);
    const horizontal = column - left;
    const vertical = row - top;
    const topValue = lerp(
      values[top * asset.width + left],
      values[top * asset.width + right],
      horizontal,
    );
    const bottomValue = lerp(
      values[bottom * asset.width + left],
      values[bottom * asset.width + right],
      horizontal,
    );
    return lerp(topValue, bottomValue, vertical);
  };
}

function samplePuttingSurface(surface: CourseTwinPuttingSurface, x: number, z: number) {
  const { minX, maxX, minZ, maxZ } = surface.localBounds;
  const column = clamp(
    ((x - minX) / Math.max(Number.EPSILON, maxX - minX)) * (surface.width - 1),
    0,
    surface.width - 1,
  );
  const row = clamp(
    ((z - minZ) / Math.max(Number.EPSILON, maxZ - minZ)) * (surface.height - 1),
    0,
    surface.height - 1,
  );
  const left = Math.floor(column);
  const right = Math.min(surface.width - 1, left + 1);
  const top = Math.floor(row);
  const bottom = Math.min(surface.height - 1, top + 1);
  const horizontal = column - left;
  const vertical = row - top;
  return lerp(
    lerp(
      surface.elevationsM[top * surface.width + left],
      surface.elevationsM[top * surface.width + right],
      horizontal,
    ),
    lerp(
      surface.elevationsM[bottom * surface.width + left],
      surface.elevationsM[bottom * surface.width + right],
      horizontal,
    ),
    vertical,
  );
}

function pointIsInsideBounds(
  x: number,
  z: number,
  bounds: CourseTwinPuttingSurface["localBounds"],
) {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}
