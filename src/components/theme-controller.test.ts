import { describe, expect, it, vi } from "vitest";

import {
  applyThemePreference,
  discardThemePreview,
  mobileThemeMediaQuery,
  previewThemePreference,
  themePreviewStorageKey,
} from "@/components/theme-controller";

function createRoot() {
  const classes = new Set<string>();
  const toggle = vi.fn((value: string, force?: boolean) => {
    if (force) classes.add(value);
    else classes.delete(value);
    return Boolean(force);
  });

  return {
    classes,
    root: {
      classList: { toggle },
      dataset: {} as DOMStringMap,
      style: {} as CSSStyleDeclaration,
    } as unknown as Pick<HTMLElement, "classList" | "dataset" | "style">,
  };
}

describe("applyThemePreference", () => {
  it("uses the shared authenticated-shell breakpoint for the mobile OS appearance", () => {
    expect(mobileThemeMediaQuery).toBe("(max-width: 1023px)");
  });

  it("applies Clubhouse Manager without enabling the dark class", () => {
    const { root, classes } = createRoot();
    const setAttribute = vi.fn();

    applyThemePreference(root, { setAttribute }, "clubhouse", true);

    expect(root.dataset).toMatchObject({
      themePreference: "clubhouse",
      theme: "clubhouse",
    });
    expect(classes.has("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");
    expect(setAttribute).toHaveBeenCalledWith("content", "#123a29");
  });

  it("stores a live preview until the Settings control unmounts", () => {
    const setItem = vi.fn();
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", {
      sessionStorage: { setItem },
      dispatchEvent,
    });

    previewThemePreference("clubhouse");

    expect(setItem).toHaveBeenCalledWith(themePreviewStorageKey, "clubhouse");
    expect(dispatchEvent).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("discards a settings preview and restores the saved preference", () => {
    const removeItem = vi.fn();
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", {
      sessionStorage: { removeItem },
      dispatchEvent,
    });
    vi.stubGlobal("document", {
      documentElement: {
        dataset: { savedThemePreference: "clubhouse" },
      },
    });

    discardThemePreview();

    expect(removeItem).toHaveBeenCalledWith(themePreviewStorageKey);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ detail: "clubhouse" }));
    vi.unstubAllGlobals();
  });

  it("uses dark colour-scheme behavior for Range Night and High Contrast", () => {
    for (const preference of ["range-night", "high-contrast"] as const) {
      const { root, classes } = createRoot();
      applyThemePreference(root, null, preference, false);
      expect(root.dataset.theme).toBe(preference);
      expect(classes.has("dark")).toBe(true);
      expect(root.style.colorScheme).toBe("dark");
    }
  });

  it("keeps system, light and dark behaviour unchanged", () => {
    const dark = createRoot();
    applyThemePreference(dark.root, null, "system", true);
    expect(dark.root.dataset.theme).toBe("dark");
    expect(dark.classes.has("dark")).toBe(true);
    expect(dark.root.style.colorScheme).toBe("dark");

    const light = createRoot();
    applyThemePreference(light.root, null, "light", true);
    expect(light.root.dataset.theme).toBe("light");
    expect(light.classes.has("dark")).toBe(false);
    expect(light.root.style.colorScheme).toBe("light");
  });

  it("uses only the OS light appearance on mobile while preserving the product preference", () => {
    const { root, classes } = createRoot();
    const setAttribute = vi.fn();

    applyThemePreference(root, { setAttribute }, "clubhouse", false, true);

    expect(root.dataset).toMatchObject({
      themePreference: "clubhouse",
      theme: "light",
    });
    expect(classes.has("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");
    expect(setAttribute).toHaveBeenCalledWith("content", "#f2f2f7");
  });

  it("uses only the OS dark appearance on mobile while preserving the product preference", () => {
    const { root, classes } = createRoot();
    const setAttribute = vi.fn();

    applyThemePreference(root, { setAttribute }, "outdoor", true, true);

    expect(root.dataset).toMatchObject({
      themePreference: "outdoor",
      theme: "dark",
    });
    expect(classes.has("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");
    expect(setAttribute).toHaveBeenCalledWith("content", "#000000");
  });

  it("lets the OS appearance override explicit light and dark preferences on mobile", () => {
    const savedDark = createRoot();
    applyThemePreference(savedDark.root, null, "dark", false, true);
    expect(savedDark.root.dataset).toMatchObject({ themePreference: "dark", theme: "light" });
    expect(savedDark.classes.has("dark")).toBe(false);

    const savedLight = createRoot();
    applyThemePreference(savedLight.root, null, "light", true, true);
    expect(savedLight.root.dataset).toMatchObject({ themePreference: "light", theme: "dark" });
    expect(savedLight.classes.has("dark")).toBe(true);
  });

  it("restores the selected product theme outside the mobile viewport", () => {
    const { root } = createRoot();

    applyThemePreference(root, null, "tour-broadcast", false, false);

    expect(root.dataset).toMatchObject({
      themePreference: "tour-broadcast",
      theme: "tour-broadcast",
    });
    expect(root.style.colorScheme).toBe("light");
  });
});
