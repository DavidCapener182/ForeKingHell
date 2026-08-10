import type {
  CourseTwinGeographicBounds,
  CourseTwinImageryAsset,
} from "@/lib/course-twin-contract";

const HIGH_DETAIL_MAXIMUM_DIMENSION = 4096;

export function courseTwinHighDetailImageSize(bounds: CourseTwinGeographicBounds) {
  const longitudeSpan = bounds.maxLongitude - bounds.minLongitude;
  const latitudeSpan = bounds.maxLatitude - bounds.minLatitude;
  if (
    !Number.isFinite(longitudeSpan) ||
    !Number.isFinite(latitudeSpan) ||
    longitudeSpan <= 0 ||
    latitudeSpan <= 0 ||
    longitudeSpan > 0.25 ||
    latitudeSpan > 0.25
  ) {
    return null;
  }

  const aspectRatio = longitudeSpan / latitudeSpan;
  return aspectRatio >= 1
    ? {
        width: HIGH_DETAIL_MAXIMUM_DIMENSION,
        height: Math.max(1, Math.round(HIGH_DETAIL_MAXIMUM_DIMENSION / aspectRatio)),
      }
    : {
        width: Math.max(1, Math.round(HIGH_DETAIL_MAXIMUM_DIMENSION * aspectRatio)),
        height: HIGH_DETAIL_MAXIMUM_DIMENSION,
      };
}

export function courseTwinEsriImageryUrl(bounds: CourseTwinGeographicBounds) {
  const size = courseTwinHighDetailImageSize(bounds);
  if (!size) return null;

  const url = new URL(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export",
  );
  for (const [key, value] of Object.entries({
    bbox: `${bounds.minLongitude},${bounds.minLatitude},${bounds.maxLongitude},${bounds.maxLatitude}`,
    bboxSR: "4326",
    imageSR: "4326",
    size: `${size.width},${size.height}`,
    format: "jpg",
    transparent: "false",
    f: "image",
  })) {
    url.searchParams.set(key, value);
  }
  return url;
}

export function courseTwinHighDetailRuntimeUrl(courseId: string, imagery: CourseTwinImageryAsset) {
  const alreadyHighDetail =
    (imagery.pixelWidth ?? 0) >= HIGH_DETAIL_MAXIMUM_DIMENSION ||
    (imagery.pixelHeight ?? 0) >= HIGH_DETAIL_MAXIMUM_DIMENSION;
  if (alreadyHighDetail || !courseTwinCanUseEsriDetail(imagery)) return null;
  return `/api/course-twins/${encodeURIComponent(courseId)}/imagery`;
}

export function courseTwinCanUseEsriDetail(imagery: CourseTwinImageryAsset) {
  const source = `${imagery.url} ${imagery.attribution}`.toLowerCase();
  return source.includes("esri") || source.includes("arcgis");
}
