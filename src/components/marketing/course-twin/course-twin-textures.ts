"use client";

import { useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { seededUnit } from "./course-twin-data";
import type { CourseTwinQuality } from "./course-twin-types";

const fullSurfaceUrls = [
  "/course-twins/common/materials/high-detail/Grass001-Color.webp?v=1",
  "/course-twins/common/materials/Grass001-NormalGL.jpg?v=1",
  "/course-twins/common/materials/Grass001-Roughness.jpg?v=1",
  "/course-twins/common/materials/high-detail/Grass005-Color.webp?v=1",
  "/course-twins/common/materials/Grass005-NormalGL.jpg?v=1",
  "/course-twins/common/materials/Grass005-Roughness.jpg?v=1",
  "/course-twins/common/materials/high-detail/Grass008-Color.webp?v=1",
  "/course-twins/common/materials/Grass008-NormalGL.jpg?v=1",
  "/course-twins/common/materials/Grass008-Roughness.jpg?v=1",
  "/course-twins/common/materials/high-detail/Ground080-Color.webp?v=1",
  "/course-twins/common/materials/Ground080-NormalGL.jpg?v=1",
  "/course-twins/common/materials/Ground080-Roughness.jpg?v=1",
] as const;

const compactSurfaceUrls = [
  "/course-twins/common/materials/Grass001-Color.jpg?v=1",
  "/course-twins/common/materials/Grass001-NormalGL.jpg?v=1",
  "/course-twins/common/materials/Grass001-Roughness.jpg?v=1",
  "/course-twins/common/materials/Grass005-Color.jpg?v=1",
  "/course-twins/common/materials/Grass005-NormalGL.jpg?v=1",
  "/course-twins/common/materials/Grass005-Roughness.jpg?v=1",
  "/course-twins/common/materials/Grass008-Color.jpg?v=1",
  "/course-twins/common/materials/Grass008-NormalGL.jpg?v=1",
  "/course-twins/common/materials/Grass008-Roughness.jpg?v=1",
  "/course-twins/common/materials/Ground080-Color.jpg?v=1",
  "/course-twins/common/materials/Ground080-NormalGL.jpg?v=1",
  "/course-twins/common/materials/Ground080-Roughness.jpg?v=1",
] as const;

export type CourseSurfaceMapSet = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
};

export type CourseTwinTextures = {
  rough: CourseSurfaceMapSet;
  fairway: CourseSurfaceMapSet;
  green: CourseSurfaceMapSet;
  sand: CourseSurfaceMapSet;
  path: CourseSurfaceMapSet;
  water: THREE.Texture;
  waterBump: THREE.Texture;
};

function configureTexture(
  source: THREE.Texture,
  repeat: readonly [number, number],
  anisotropy: number,
  colour = false,
) {
  const texture = source.clone();
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = anisotropy;
  texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createPatternTexture(kind: "path" | "path-height" | "water" | "water-height") {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Course Twin texture canvas unavailable");

  const random = seededUnit(kind.includes("water") ? 7_313 : 4_029);
  const height = kind.endsWith("height");
  const water = kind.startsWith("water");
  context.fillStyle = height ? "#808080" : water ? "#315f60" : "#8f7b5a";
  context.fillRect(0, 0, size, size);

  if (water) {
    for (let line = 0; line < 110; line += 1) {
      const y = random() * size;
      const amplitude = 1.5 + random() * 3;
      context.beginPath();
      for (let x = -8; x <= size + 8; x += 8) {
        const waveY = y + Math.sin(x * 0.085 + random() * 0.3) * amplitude;
        if (x === -8) context.moveTo(x, waveY);
        else context.lineTo(x, waveY);
      }
      context.strokeStyle = height
        ? `rgba(${110 + Math.floor(random() * 70)}, ${110 + Math.floor(random() * 70)}, ${110 + Math.floor(random() * 70)}, 0.45)`
        : `rgba(151, 207, 190, ${0.035 + random() * 0.08})`;
      context.lineWidth = height ? 1.2 : 0.8;
      context.stroke();
    }
  } else {
    for (let mark = 0; mark < 1_800; mark += 1) {
      const shade = 78 + Math.floor(random() * 85);
      const alpha = 0.08 + random() * 0.24;
      context.fillStyle = height
        ? `rgba(${shade}, ${shade}, ${shade}, ${alpha})`
        : random() > 0.5
          ? `rgba(65, 49, 31, ${alpha})`
          : `rgba(202, 178, 128, ${alpha})`;
      const radius = 0.4 + random() * 1.6;
      context.fillRect(random() * size, random() * size, radius, radius * 0.65);
    }
    context.strokeStyle = height ? "rgba(190,190,190,.22)" : "rgba(58,45,28,.11)";
    for (let track = 0; track < 9; track += 1) {
      context.beginPath();
      const x = (track / 8) * size + (random() - 0.5) * 9;
      context.moveTo(x, 0);
      context.bezierCurveTo(x + 3, 80, x - 4, 170, x + 2, size);
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = height ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function buildMapSet(
  sources: readonly [THREE.Texture, THREE.Texture, THREE.Texture],
  repeat: readonly [number, number],
  anisotropy: number,
): CourseSurfaceMapSet {
  return {
    map: configureTexture(sources[0], repeat, anisotropy, true),
    normalMap: configureTexture(sources[1], repeat, anisotropy),
    roughnessMap: configureTexture(sources[2], repeat, anisotropy),
  };
}

export function useCourseTwinTextures(quality: CourseTwinQuality): CourseTwinTextures {
  const sources = useTexture(
    quality === "compact" ? [...compactSurfaceUrls] : [...fullSurfaceUrls],
  );
  const maximumAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const anisotropy = Math.min(maximumAnisotropy, quality === "compact" ? 4 : 8);

  const textures = useMemo(() => {
    const path = createPatternTexture("path");
    const pathHeight = createPatternTexture("path-height");
    path.repeat.set(2.5, 24);
    pathHeight.repeat.set(2.5, 24);
    path.anisotropy = anisotropy;
    pathHeight.anisotropy = anisotropy;

    const water = createPatternTexture("water");
    const waterBump = createPatternTexture("water-height");
    water.repeat.set(3, 7);
    waterBump.repeat.set(3, 7);
    water.anisotropy = anisotropy;
    waterBump.anisotropy = anisotropy;

    return {
      rough: buildMapSet([sources[0], sources[1], sources[2]], [17, 27], anisotropy),
      fairway: buildMapSet([sources[3], sources[4], sources[5]], [7, 40], anisotropy),
      green: buildMapSet([sources[6], sources[7], sources[8]], [7, 10], anisotropy),
      sand: buildMapSet([sources[9], sources[10], sources[11]], [4.5, 7], anisotropy),
      path: {
        map: path,
        normalMap: pathHeight,
        roughnessMap: pathHeight,
      },
      water,
      waterBump,
    } satisfies CourseTwinTextures;
  }, [anisotropy, sources]);

  useEffect(
    () => () => {
      for (const maps of [
        textures.rough,
        textures.fairway,
        textures.green,
        textures.sand,
        textures.path,
      ]) {
        maps.map.dispose();
        maps.normalMap.dispose();
        if (maps.roughnessMap !== maps.normalMap) maps.roughnessMap.dispose();
      }
      textures.water.dispose();
      textures.waterBump.dispose();
    },
    [textures],
  );

  return textures;
}
