import assert from "node:assert/strict";
import { test } from "node:test";

import { localManifestFromCompletion, packageSlugForCourse } from "./local-catalogue.mjs";

test("local catalogue keeps stable pilot slugs and derives deterministic course slugs", () => {
  assert.equal(
    packageSlugForCourse({
      courseId: "4de11156-16fd-4a36-84e0-fadda53456b0",
      name: "Aintree Golf Centre",
    }),
    "aintree-v1",
  );
  assert.equal(
    packageSlugForCourse({ courseId: "course-2", name: "St. David's & Coast Golf Club" }),
    "st-david-s-coast-golf-club-v1",
  );
});

test("local catalogue rewrites generated assets to immutable public package paths", () => {
  const manifest = localManifestFromCompletion(
    {
      manifest: {
        course: { id: "course-1", name: "Example" },
        terrain: {
          heightmap: { url: "terrain.f32", sha256: "terrain" },
          imagery: { url: "imagery.jpg", sha256: "imagery" },
        },
      },
    },
    "example-v1",
  );
  assert.equal(manifest.terrain.heightmap.url, "/course-twins/example-v1/terrain.f32");
  assert.equal(manifest.terrain.imagery.url, "/course-twins/example-v1/imagery.jpg");
});
