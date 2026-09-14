"use client";
import { useEffect, useState } from "react";
import * as THREE from "three";

/** Optional image lifetime is independent of React, including late loads after a course change. */
export function loadCourseTexture(
  url: string,
  gl: THREE.WebGLRenderer,
  onLoaded: (texture: THREE.Texture) => void,
  fallbackUrl?: string,
) {
  let active = true;
  let loadedTexture: THREE.Texture | null = null;
  const loader = new THREE.TextureLoader();
  const load = (assetUrl: string) =>
    loader.load(
      assetUrl,
      (texture) => {
        loadedTexture = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = gl.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
        if (active) onLoaded(texture);
        else texture.dispose();
      },
      undefined,
      () => {
        if (active && fallbackUrl && assetUrl !== fallbackUrl) load(fallbackUrl);
      },
    );
  load(url);
  return () => {
    if (!active) return;
    active = false;
    loadedTexture?.dispose();
  };
}

export function useProgressiveCourseImagery(
  url: string | null,
  gl: THREE.WebGLRenderer,
  fallbackUrl?: string,
) {
  const [loaded, setLoaded] = useState<{ texture: THREE.Texture; url: string } | null>(null);
  useEffect(() => {
    if (!url) return;
    return loadCourseTexture(url, gl, (texture) => setLoaded({ texture, url }), fallbackUrl);
  }, [url, gl, fallbackUrl]);
  return loaded?.url === url ? loaded.texture : null;
}
