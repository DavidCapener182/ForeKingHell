import { createRoot } from "react-dom/client";
import type { CourseTwinManifest } from "@/lib/course-twin-contract";
import { SharedTwinView } from "@/app/share/course-twin/[token]/shared-twin-view";
const manifest: CourseTwinManifest = {
  schemaVersion: 1,
  packageVersion: 1,
  minimumRuntimeVersion: "1",
  course: {
    id: "synthetic-course",
    name: "Synthetic mapped course with long identity and preserved evidence",
    country: "UK",
  },
  origin: { latitude: 53, longitude: -3, elevationM: 0, coordinateSystem: "LOCAL_ENU_METRES" },
  bounds: { minX: 0, maxX: 400, minZ: 0, maxZ: 400 },
  terrain: {
    kind: "prototype_semantic",
    resolutionM: null,
    verticalDatum: null,
    warning: "Synthetic geometry only",
    heightmap: null,
    imagery: null,
  },
  quality: {
    grade: "B",
    mappedHoles: 2,
    expectedHoles: 18,
    mappedFeatures: 0,
    verified: false,
    warnings: ["Approximate, unverified putting contours; this is synthetic fixture geometry."],
  },
  supportedModes: ["replay"],
  holes: [1, 2].map((n) => ({
    holeNumber: n,
    par: 4,
    yards: 300,
    strokeIndex: null,
    tee: [0, 0, n * 100],
    green: [300, 0, n * 100],
    centerline: [
      [0, 0, n * 100],
      [300, 0, n * 100],
    ],
  })),
  features: [],
  attribution: [],
};

const replace = history.replaceState.bind(history);
history.replaceState = (data, unused, url) => { replace(data, unused, url); window.dispatchEvent(new PopStateEvent("popstate")); };
createRoot(document.getElementById("root")!).render(
  <SharedTwinView
    title="Synthetic shared replay with a long course name"
    manifest={manifest}
    replay={null}
    initialHoleNumber={2}
  />,
);
