import { describe, expect, it } from "vitest";

import {
  loadLocalCourseTwinManifest,
  localCourseTwinMetadataByCourseId,
} from "@/generated/course-twins/local-catalogue";

const AINTREE_ID = "4de11156-16fd-4a36-84e0-fadda53456b0";

describe("local Course Twin catalogue", () => {
  it("keeps the directory index lightweight and manifest-free", () => {
    const metadata = localCourseTwinMetadataByCourseId[AINTREE_ID];

    expect(metadata).toMatchObject({
      courseId: AINTREE_ID,
      name: "Aintree Golf Centre",
      grade: "B",
      mappedHoles: 9,
    });
    expect(Object.keys(metadata).sort()).toEqual([
      "courseId",
      "grade",
      "mappedHoles",
      "name",
      "previewImageUrl",
      "terrainResolutionM",
    ]);
    expect(metadata).not.toHaveProperty("holes");
    expect(metadata).not.toHaveProperty("features");
  });

  it("loads a complete manifest only through the course-specific loader", async () => {
    const manifest = await loadLocalCourseTwinManifest(AINTREE_ID);

    expect(manifest?.course.id).toBe(AINTREE_ID);
    expect(manifest?.holes).toHaveLength(9);
    expect(await loadLocalCourseTwinManifest("missing-course")).toBeNull();
  });
});
