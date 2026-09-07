import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CourseTwinRuntime } from "@/app/play/[courseId]/course-twin-runtime";
import { CourseTwinComms } from "@/app/play/[courseId]/course-twin-comms";
import { CourseTwinViewOptions } from "@/app/play/[courseId]/course-twin-view-options";
import type { CourseTwinManifest } from "@/lib/course-twin-contract";
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
history.replaceState = (data, unused, url) => {
  replace(data, unused, url);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
function Fixture() {
  const [hole, setHole] = useState(1);
  const [camera, setCamera] = useState<"aerial" | "golfer">("aerial");
  return (
    <main>
      <CourseTwinRuntime
        manifest={manifest}
        replay={null}
        readOnly
        initialMode="replay"
        initialHoleNumber={2}
      />
      <section className="bg-[#07150e] p-4 text-white" aria-label="Fixture view settings">
        <CourseTwinViewOptions
          key={`${hole}:${camera}`}
          holes={manifest.holes}
          selectedHole={hole}
          camera={camera}
          locked={false}
          onApply={(h, c) => {
            setHole(h);
            setCamera(c);
          }}
          onResetCamera={() => {}}
        />
      </section>
      <section className="bg-[#07150e] p-4 text-white" aria-label="Fixture room">
        <CourseTwinComms roomId="synthetic-room" currentUserId="synthetic-user" members={[]} />
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
