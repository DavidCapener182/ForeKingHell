import { createRoot } from "react-dom/client";
import { CourseTwinCatalogue } from "@/app/course-twins/course-twin-catalogue";
const warning =
  "Environment Agency LiDAR terrain with approximate, unverified putting contours. This deliberately long synthetic quality note must remain completely readable on narrow screens; local hazards and green conditions must be checked before play.";
const twins = [
  {
    courseId: "fixture-course-b",
    name: "Synthetic long course name with western championship greens and practice facilities",
    country: "United Kingdom",
    grade: "B",
    mappedHoles: 18,
    terrainResolutionM: 1,
    warning,
    previewImageUrl: "https://twin.fixture/broken.png",
  },
  {
    courseId: "fixture-course-a",
    name: "Synthetic surveyed course",
    country: "United Kingdom",
    grade: "A",
    mappedHoles: 9,
    terrainResolutionM: 0.5,
    warning: null,
    previewImageUrl: "https://twin.fixture/valid.svg",
  },
  {
    courseId: "fixture-course-c",
    name: "Synthetic incomplete metadata",
    country: null,
    grade: "C",
    mappedHoles: null,
    terrainResolutionM: null,
    warning: null,
    previewImageUrl: null,
  },
];
createRoot(document.getElementById("root")!).render(
  <main className="p-4">
    <h1>Course Twin</h1>
    <CourseTwinCatalogue twins={location.search.includes("empty") ? [] : twins} />
  </main>,
);
