import { describe, expect, it } from "vitest";

import {
  browserCourseTwinDeviceSignals,
  courseTwinRenderQuality,
  courseTwin2dUrl,
} from "@/lib/course-twin-performance";

const capableDesktop = {
  reducedMotion: false,
  saveData: false,
  effectiveType: "4g",
  deviceMemoryGb: 8,
  hardwareConcurrency: 8,
  viewportWidth: 1440,
};

describe("Course Twin render policy", () => {
  it("keeps the selected replay hole and session when switching to 2D", () => {
    const url = new URL(
      courseTwin2dUrl(
        "https://example.test/play/course?sessionId=measured&quality=high&hole=1",
        7,
        "replay",
        "measured-shot",
      ),
    );
    expect(url.pathname).toBe("/play/course");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sessionId: "measured",
      quality: "2d",
      hole: "7",
      mode: "replay",
      shot: "measured-shot",
    });
    expect(new URL(courseTwin2dUrl(url.toString(), 9, "play")).searchParams.get("mode")).toBe(
      "strategy",
    );
    expect(new URL(courseTwin2dUrl(url.toString(), 9, "play")).searchParams.has("shot")).toBe(
      false,
    );
  });
  it("uses high quality on capable desktops and balanced quality on mobile", () => {
    expect(courseTwinRenderQuality(capableDesktop)).toBe("high");
    expect(courseTwinRenderQuality({ ...capableDesktop, viewportWidth: 390 })).toBe("balanced");
  });

  it("uses the 2D fallback for reduced motion, data saver and constrained phones", () => {
    expect(courseTwinRenderQuality({ ...capableDesktop, reducedMotion: true })).toBe("fallback");
    expect(courseTwinRenderQuality({ ...capableDesktop, saveData: true })).toBe("fallback");
    expect(
      courseTwinRenderQuality({
        ...capableDesktop,
        viewportWidth: 390,
        deviceMemoryGb: 4,
        hardwareConcurrency: 4,
      }),
    ).toBe("fallback");
  });

  it("supports deterministic acceptance-test and user overrides", () => {
    expect(courseTwinRenderQuality({ ...capableDesktop, override: "2d" })).toBe("fallback");
    expect(courseTwinRenderQuality({ ...capableDesktop, override: "balanced" })).toBe("balanced");
    expect(courseTwinRenderQuality({ ...capableDesktop, override: "high" })).toBe("high");
  });

  it("provides deterministic neutral signals during server rendering", () => {
    expect(browserCourseTwinDeviceSignals()).toEqual({
      override: null,
      reducedMotion: false,
      saveData: false,
      effectiveType: null,
      deviceMemoryGb: null,
      hardwareConcurrency: null,
      viewportWidth: 1024,
    });
  });
});
