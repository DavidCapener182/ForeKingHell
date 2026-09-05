import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CourseTwinManifest } from "@/lib/course-twin-contract";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));
vi.mock("./course-twin-mobile-overhead", () => ({
  CourseTwinMobileOverhead: ({
    onEnable3d,
    rendererUnavailable,
  }: {
    onEnable3d?: () => void;
    rendererUnavailable?: boolean;
  }) => <output>{`mobile:unavailable=${rendererUnavailable}:retry=${Boolean(onEnable3d)}`}</output>,
}));
import { CourseTwinRuntime } from "./course-twin-runtime";

const manifest = {
  course: { id: "course", name: "Course" },
  terrain: {},
  bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 },
  holes: [],
} as unknown as CourseTwinManifest;

afterEach(() => vi.unstubAllGlobals());
describe("unavailable WebGL fallback", () => {
  it.each([390, 1440])("offers no reload loop at %ipx", (width) => {
    vi.stubGlobal("window", {
      innerWidth: width,
      location: { href: "https://example.test/play/course?quality=balanced" },
      matchMedia: (query: string) => ({ matches: query.includes("max-width") && width < 1024 }),
    });
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
    const html = renderToStaticMarkup(<CourseTwinRuntime manifest={manifest} replay={null} />);
    if (width < 1024) expect(html).toContain("mobile:unavailable=true:retry=false");
    else {
      expect(html).toContain("3D is unavailable on this device.");
      expect(html).not.toContain("Try balanced 3D");
    }
  });
});
