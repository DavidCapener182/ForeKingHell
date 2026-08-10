"use client";

import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { seededUnit, terrainHeight } from "./course-twin-data";
import type { CourseTwinQuality } from "./course-twin-types";

const TREE_TEXTURES = [
  "/course-twins/common/vegetation/high-detail/tree-oak-hq.webp?v=1",
  "/course-twins/common/vegetation/high-detail/tree-birch-hq.webp?v=1",
  "/course-twins/common/vegetation/high-detail/tree-sycamore-hq.webp?v=1",
] as const;
const SHRUB_TEXTURE = "/course-twins/common/vegetation/high-detail/shrub-hawthorn-hq.webp?v=1";

TREE_TEXTURES.forEach((url) => useTexture.preload(url));
useTexture.preload(SHRUB_TEXTURE);

type PlantPlacement = {
  x: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  variant: number;
};

function makeTreePlacements(quality: CourseTwinQuality) {
  const random = seededUnit(97_113);
  const perSide = quality === "full" ? 66 : 37;
  const placements: PlantPlacement[] = [];

  for (const side of [-1, 1] as const) {
    for (let index = 0; index < perSide; index += 1) {
      const progress = (index + random() * 0.72) / perSide;
      const z = 49 - progress * 99;
      const edgeWave = Math.sin(z * 0.115 + side * 0.7) * 2.2;
      const x = side * (16.2 + random() * 10.5 + edgeWave * side);
      const height = 4.5 + random() * 4.7;
      placements.push({
        x,
        z,
        width: height * (0.72 + random() * 0.24),
        height,
        rotation: random() * Math.PI,
        variant: Math.floor(random() * TREE_TEXTURES.length),
      });
    }
  }

  const features = [
    [-11.7, -43, 9.2, 0],
    [12.9, -39.5, 8.1, 2],
    [-15.5, 8, 7.7, 0],
    [16.7, 18, 8.8, 2],
    [-13.8, 38, 7.1, 1],
  ] as const;
  for (const [x, z, height, variant] of features) {
    placements.push({
      x,
      z,
      width: height * 0.84,
      height,
      rotation: random() * Math.PI,
      variant,
    });
  }

  return placements;
}

function makeShrubPlacements(quality: CourseTwinQuality) {
  const random = seededUnit(48_901);
  const count = quality === "full" ? 92 : 48;
  const placements: PlantPlacement[] = [];
  for (let index = 0; index < count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const z = 47 - (index / count) * 98 + (random() - 0.5) * 4;
    const x = side * (12.6 + random() * 8.4 + Math.sin(z * 0.19) * 1.5);
    const height = 0.8 + random() * 1.35;
    placements.push({
      x,
      z,
      width: height * (1.35 + random() * 0.44),
      height,
      rotation: random() * Math.PI,
      variant: 0,
    });
  }
  return placements;
}

function useConfiguredPlantTextures() {
  const sources = useTexture([...TREE_TEXTURES, SHRUB_TEXTURE]);
  const maximumAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const textures = useMemo(
    () =>
      sources.map((source) => {
        const texture = source.clone();
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, maximumAnisotropy);
        texture.needsUpdate = true;
        return texture;
      }),
    [maximumAnisotropy, sources],
  );
  useEffect(
    () => () => {
      for (const texture of textures) texture.dispose();
    },
    [textures],
  );
  return textures;
}

export function CourseTwinFoliage({ quality }: { quality: CourseTwinQuality }) {
  const textures = useConfiguredPlantTextures();
  const treePlacements = useMemo(() => makeTreePlacements(quality), [quality]);
  const shrubPlacements = useMemo(() => makeShrubPlacements(quality), [quality]);
  const groups = useMemo(
    () =>
      TREE_TEXTURES.map((_, variant) => treePlacements.filter((tree) => tree.variant === variant)),
    [treePlacements],
  );

  return (
    <group>
      {groups.map((placements, variant) => (
        <CrossedPlantInstances
          key={TREE_TEXTURES[variant]}
          placements={placements}
          texture={textures[variant]}
          alphaTest={0.28}
          colour={["#fffdf4", "#f2f7ef", "#f7f2df"][variant] ?? "#ffffff"}
        />
      ))}
      <CrossedPlantInstances
        placements={shrubPlacements}
        texture={textures[3]}
        alphaTest={0.32}
        colour="#f0f5e8"
      />
      <FoliageGrounding placements={[...treePlacements, ...shrubPlacements]} />
    </group>
  );
}

function CrossedPlantInstances({
  placements,
  texture,
  alphaTest,
  colour,
}: {
  placements: PlantPlacement[];
  texture: THREE.Texture;
  alphaTest: number;
  colour: string;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
    plane.translate(0, 0.5, 0);
    return plane;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    let instance = 0;
    for (const placement of placements) {
      for (const crossRotation of [0, Math.PI / 2]) {
        dummy.position.set(
          placement.x,
          terrainHeight(placement.x, placement.z) + 0.025,
          placement.z,
        );
        dummy.rotation.set(0, placement.rotation + crossRotation, 0);
        dummy.scale.set(placement.width, placement.height, 1);
        dummy.updateMatrix();
        mesh.current.setMatrixAt(instance, dummy.matrix);
        instance += 1;
      }
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [placements]);

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, placements.length * 2]}>
      <meshBasicMaterial
        map={texture}
        alphaTest={alphaTest}
        color={colour}
        transparent={false}
        depthWrite
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function FoliageGrounding({ placements }: { placements: PlantPlacement[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.CircleGeometry(1, 18), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    placements.forEach((placement, index) => {
      dummy.position.set(
        placement.x + 0.35,
        terrainHeight(placement.x, placement.z) + 0.018,
        placement.z + 0.45,
      );
      dummy.rotation.set(-Math.PI / 2, 0, placement.rotation);
      dummy.scale.set(placement.width * 0.58, placement.width * 0.36, 1);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [placements]);

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, placements.length]} renderOrder={-1}>
      <meshBasicMaterial
        color="#123622"
        transparent
        opacity={0.11}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}
