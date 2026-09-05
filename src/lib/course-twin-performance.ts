export type CourseTwinRenderQuality = "fallback" | "balanced" | "high";

export function courseTwin2dUrl(currentUrl: string, hole: number, mode: string, shotId?: string) {
  const url = new URL(currentUrl);
  url.searchParams.set("quality", "2d");
  url.searchParams.set("hole", String(hole));
  url.searchParams.set("mode", mode === "replay" ? "replay" : "strategy");
  if (mode === "replay" && shotId) url.searchParams.set("shot", shotId);
  else url.searchParams.delete("shot");
  return url.toString();
}

export type CourseTwinDeviceSignals = {
  override?: string | null;
  reducedMotion: boolean;
  saveData: boolean;
  effectiveType?: string | null;
  deviceMemoryGb?: number | null;
  hardwareConcurrency?: number | null;
  viewportWidth: number;
};

export function courseTwinRenderQuality(signals: CourseTwinDeviceSignals): CourseTwinRenderQuality {
  if (signals.override === "2d" || signals.override === "fallback") return "fallback";
  if (signals.override === "balanced") return "balanced";
  if (signals.override === "high") return "high";

  if (
    signals.reducedMotion ||
    signals.saveData ||
    signals.effectiveType === "slow-2g" ||
    signals.effectiveType === "2g"
  ) {
    return "fallback";
  }

  const constrainedMemory =
    signals.deviceMemoryGb !== null &&
    signals.deviceMemoryGb !== undefined &&
    signals.deviceMemoryGb <= 4;
  const constrainedCpu =
    signals.hardwareConcurrency !== null &&
    signals.hardwareConcurrency !== undefined &&
    signals.hardwareConcurrency <= 4;

  if (signals.viewportWidth <= 430 && constrainedMemory && constrainedCpu) return "fallback";
  if (signals.viewportWidth < 1024 || constrainedMemory || constrainedCpu) return "balanced";
  return "high";
}

export function browserCourseTwinDeviceSignals(): CourseTwinDeviceSignals {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      override: null,
      reducedMotion: false,
      saveData: false,
      effectiveType: null,
      deviceMemoryGb: null,
      hardwareConcurrency: null,
      viewportWidth: 1024,
    };
  }

  const navigatorWithHints = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };

  return {
    override: new URL(window.location.href).searchParams.get("quality"),
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: navigatorWithHints.connection?.saveData === true,
    effectiveType: navigatorWithHints.connection?.effectiveType ?? null,
    deviceMemoryGb: navigatorWithHints.deviceMemory ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    viewportWidth: window.innerWidth,
  };
}
