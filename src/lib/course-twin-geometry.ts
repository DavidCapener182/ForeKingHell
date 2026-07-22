import type { CourseTwinPoint } from "@/lib/course-twin-contract";

const METRES_PER_DEGREE_LATITUDE = 111_320;

export function createCourseTwinProjector(originLat: number, originLng: number) {
  const metresPerDegreeLongitude =
    METRES_PER_DEGREE_LATITUDE * Math.cos((originLat * Math.PI) / 180);

  return (latitude: number, longitude: number): CourseTwinPoint => [
    (longitude - originLng) * metresPerDegreeLongitude,
    0,
    (originLat - latitude) * METRES_PER_DEGREE_LATITUDE,
  ];
}

export function courseTwinBoundsForPoints(points: CourseTwinPoint[], padding = 80) {
  if (points.length === 0) {
    return { minX: -padding, maxX: padding, minZ: -padding, maxZ: padding };
  }

  const xs = points.map((point) => point[0]);
  const zs = points.map((point) => point[2]);
  return {
    minX: Math.min(...xs) - padding,
    maxX: Math.max(...xs) + padding,
    minZ: Math.min(...zs) - padding,
    maxZ: Math.max(...zs) + padding,
  };
}

export function averageCourseTwinCoordinate(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}
