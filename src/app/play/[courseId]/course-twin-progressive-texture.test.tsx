import { afterEach, expect, it, vi } from "vitest";
import { Texture, TextureLoader, SRGBColorSpace, type WebGLRenderer } from "three";
import { loadCourseTexture } from "./course-twin-progressive-texture";
const gl = { capabilities: { getMaxAnisotropy: () => 4 } } as WebGLRenderer;
afterEach(() => vi.restoreAllMocks());
it("retains the existing image after an optional impostor fails and disposes it exactly once", () => {
  const pending: {
    url: string;
    loaded: (t: Texture<HTMLImageElement>) => void;
    failed: () => void;
  }[] = [];
  vi.spyOn(TextureLoader.prototype, "load").mockImplementation(
    (url, onLoad, _progress, onError) => {
      pending.push({
        url,
        loaded: onLoad!,
        failed: () => onError?.(new Error("missing optional image")),
      });
      return new Texture<HTMLImageElement>();
    },
  );
  const loaded = vi.fn();
  const cleanup = loadCourseTexture("/new.png", gl, loaded, "/existing.webp");
  pending[0].failed();
  expect(pending.map((p) => p.url)).toEqual(["/new.png", "/existing.webp"]);
  const fallback = new Texture<HTMLImageElement>();
  const dispose = vi.spyOn(fallback, "dispose");
  pending[1].loaded(fallback);
  expect(loaded).toHaveBeenCalledWith(fallback);
  expect(fallback.colorSpace).toBe(SRGBColorSpace);
  cleanup();
  cleanup();
  expect(dispose).toHaveBeenCalledOnce();
});
it("disposes a late image from the previous course without displaying it", () => {
  const callbacks: ((t: Texture<HTMLImageElement>) => void)[] = [];
  vi.spyOn(TextureLoader.prototype, "load").mockImplementation((_url, onLoad) => {
    callbacks.push(onLoad!);
    return new Texture<HTMLImageElement>();
  });
  const oldLoaded = vi.fn();
  const oldCleanup = loadCourseTexture("/course-a.png", gl, oldLoaded);
  oldCleanup();
  const currentLoaded = vi.fn();
  const cleanup = loadCourseTexture("/course-b.png", gl, currentLoaded);
  const late = new Texture<HTMLImageElement>();
  const dispose = vi.spyOn(late, "dispose");
  callbacks[0](late);
  expect(dispose).toHaveBeenCalledOnce();
  expect(oldLoaded).not.toHaveBeenCalled();
  const current = new Texture<HTMLImageElement>();
  callbacks[1](current);
  expect(currentLoaded).toHaveBeenCalledWith(current);
  cleanup();
});
