import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  courseTwinEsriImageryUrl,
  courseTwinHighDetailRuntimeUrl,
} from "@/lib/course-twin-imagery";

const builderSource = readFileSync(
  resolve(process.cwd(), "scripts/course-twin/build-bootle-terrain.mjs"),
  "utf8",
);
const bootlePackage = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/generated/course-twins/bootle-v3.json"), "utf8"),
) as { imagery: { pixelHeight: number; pixelWidth: number; url: string } };
const aintreePackage = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/generated/course-twins/aintree-v1.json"), "utf8"),
) as {
  course: { id: string };
  terrain: {
    imagery: {
      attribution: string;
      geographicBounds: {
        minLatitude: number;
        maxLatitude: number;
        minLongitude: number;
        maxLongitude: number;
      };
      kind: "aerial_reference";
      url: string;
    };
  };
};
const routeSource = readFileSync(
  resolve(process.cwd(), "src/app/api/course-twins/[courseId]/imagery/route.ts"),
  "utf8",
);
const sceneSource = readFileSync(
  resolve(process.cwd(), "src/app/play/[courseId]/course-twin-scene.tsx"),
  "utf8",
);
const packagedCourseTwins = readdirSync(resolve(process.cwd(), "src/generated/course-twins"))
  .filter((fileName) => fileName.endsWith("-v1.json"))
  .map((fileName) =>
    JSON.parse(
      readFileSync(resolve(process.cwd(), "src/generated/course-twins", fileName), "utf8"),
    ),
  ) as Array<typeof aintreePackage>;

describe("Bootle Course Twin imagery", () => {
  it("keeps enough aerial resolution for closer simulator framing", () => {
    const imageryPath = resolve("public", bootlePackage.imagery.url.replace(/^\//, ""));
    const imagery = readFileSync(imageryPath);

    expect(bootlePackage.imagery).toMatchObject({
      url: "/course-twins/bootle-v3/imagery.jpg",
      pixelWidth: 4096,
      pixelHeight: 2970,
    });
    expect(imagery.byteLength).toBeGreaterThan(2_000_000);
    expect(builderSource).toContain("const imageryWidth = 4096");
    expect(builderSource).not.toContain("const imageryWidth = 1536");
  });

  it("requests progressive 4K detail for any compatible lower-resolution course", () => {
    const imagery = aintreePackage.terrain.imagery;
    const detailUrl = courseTwinEsriImageryUrl(imagery.geographicBounds);

    expect(detailUrl?.searchParams.get("size")).toMatch(/^4096,2\d{3}$/);
    expect(courseTwinHighDetailRuntimeUrl(aintreePackage.course.id, imagery)).toBe(
      `/api/course-twins/${aintreePackage.course.id}/imagery`,
    );
    expect(routeSource).toContain("getCourseTwinManifest({ userId: user.id, courseId })");
    expect(routeSource).toContain('cache: "no-store"');
    expect(routeSource).toContain("stale-while-revalidate=2592000");
    expect(sceneSource).toContain("useProgressiveCourseImagery");
    expect(sceneSource).toContain("highDetailTexture ?? texture");
  });

  it("covers every packaged Course Twin rather than a single named course", () => {
    expect(packagedCourseTwins.length).toBeGreaterThan(20);

    for (const manifest of packagedCourseTwins) {
      expect(
        courseTwinHighDetailRuntimeUrl(manifest.course.id, manifest.terrain.imagery),
        manifest.course.id,
      ).toBe(`/api/course-twins/${manifest.course.id}/imagery`);
      expect(
        courseTwinEsriImageryUrl(manifest.terrain.imagery.geographicBounds)?.searchParams.get(
          "size",
        ),
        manifest.course.id,
      ).toMatch(/^(4096,\d+|\d+,4096)$/);
    }
  });
});
