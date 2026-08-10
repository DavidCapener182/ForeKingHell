"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { CART_PATH, COURSE_CENTRE_LINE, FAIRWAY_WIDTHS, terrainHeight } from "./course-twin-data";
import {
  createCourseStripGeometry,
  createIrregularDiscGeometry,
  createIrregularRingGeometry,
  createTerrainGeometry,
} from "./course-twin-geometry";
import type { CourseTwinTextures } from "./course-twin-textures";
import type { CourseTwinQuality } from "./course-twin-types";

const ROUGH_NORMAL_SCALE = new THREE.Vector2(0.9, 0.9);
const FAIRWAY_NORMAL_SCALE = new THREE.Vector2(0.64, 0.64);
const FIRST_CUT_NORMAL_SCALE = new THREE.Vector2(0.56, 0.56);
const GREEN_NORMAL_SCALE = new THREE.Vector2(0.46, 0.46);
const SAND_NORMAL_SCALE = new THREE.Vector2(0.92, 0.92);
const PATH_NORMAL_SCALE = new THREE.Vector2(0.28, 0.28);
const WATER_NORMAL_SCALE = new THREE.Vector2(0.26, 0.26);

export function CourseTwinTerrain({
  quality,
  textures,
}: {
  quality: CourseTwinQuality;
  textures: CourseTwinTextures;
}) {
  const geometries = useMemo(() => {
    const full = quality === "full";
    const firstCutWidths = FAIRWAY_WIDTHS.map((width) => width * 1.22);
    const fringeCentre = [-2.4, -41.3] as const;
    return {
      terrain: createTerrainGeometry(full ? 92 : 58, full ? 144 : 90),
      firstCut: createCourseStripGeometry({
        points: COURSE_CENTRE_LINE,
        widths: firstCutWidths,
        samples: full ? 108 : 68,
        edgeSeed: 3.4,
        elevation: 0.032,
      }),
      fairway: createCourseStripGeometry({
        points: COURSE_CENTRE_LINE,
        widths: FAIRWAY_WIDTHS,
        samples: full ? 120 : 76,
        edgeSeed: 8.7,
        elevation: 0.061,
      }),
      path: createCourseStripGeometry({
        points: CART_PATH,
        widths: [0.9, 1.05, 1.2, 1.1, 1.05, 1.18, 0.92],
        samples: full ? 86 : 54,
        edgeSeed: 16.8,
        elevation: 0.07,
      }),
      fringe: createIrregularDiscGeometry({
        centre: fringeCentre,
        radii: [7.4, 6.4],
        rotation: -0.14,
        segments: full ? 64 : 44,
        rings: full ? 5 : 3,
        seed: 12,
        elevation: 0.075,
      }),
      green: createIrregularDiscGeometry({
        centre: fringeCentre,
        radii: [5.9, 4.8],
        rotation: -0.14,
        segments: full ? 68 : 46,
        rings: full ? 6 : 4,
        seed: 12,
        elevation: 0.105,
      }),
      teeSurround: createIrregularDiscGeometry({
        centre: [0.5, 42.5],
        radii: [5.8, 4.7],
        rotation: 0.04,
        segments: full ? 48 : 36,
        seed: 23,
        elevation: 0.055,
      }),
      tee: createIrregularDiscGeometry({
        centre: [0.5, 42.4],
        radii: [3.3, 2.35],
        rotation: 0.04,
        segments: full ? 48 : 34,
        seed: 23,
        elevation: 0.09,
      }),
      waterBank: createIrregularDiscGeometry({
        centre: [11.5, -16.8],
        radii: [7.2, 15.2],
        rotation: -0.18,
        segments: full ? 68 : 46,
        rings: full ? 5 : 3,
        seed: 31,
        elevation: 0.005,
      }),
      water: createIrregularDiscGeometry({
        centre: [11.8, -16.9],
        radii: [5.7, 13.5],
        rotation: -0.18,
        segments: full ? 72 : 48,
        rings: full ? 6 : 4,
        seed: 31,
        elevation: 0.045,
      }),
      bunkerOne: createIrregularDiscGeometry({
        centre: [-9.6, -28.7],
        radii: [4.5, 7.2],
        rotation: 0.42,
        segments: full ? 60 : 40,
        rings: full ? 5 : 3,
        seed: 44,
        elevation: 0.07,
        bowlDepth: 0.22,
      }),
      bunkerOneLip: createIrregularRingGeometry({
        centre: [-9.6, -28.7],
        radii: [4.9, 7.65],
        thickness: 0.78,
        rotation: 0.42,
        segments: full ? 60 : 40,
        seed: 44,
        elevation: 0.17,
      }),
      bunkerTwo: createIrregularDiscGeometry({
        centre: [4.3, -36.2],
        radii: [3.2, 5.2],
        rotation: -0.48,
        segments: full ? 54 : 38,
        rings: full ? 5 : 3,
        seed: 57,
        elevation: 0.07,
        bowlDepth: 0.18,
      }),
      bunkerTwoLip: createIrregularRingGeometry({
        centre: [4.3, -36.2],
        radii: [3.58, 5.58],
        thickness: 0.65,
        rotation: -0.48,
        segments: full ? 54 : 38,
        seed: 57,
        elevation: 0.16,
      }),
      bunkerThree: createIrregularDiscGeometry({
        centre: [-7.1, 4.2],
        radii: [2.4, 4.2],
        rotation: -0.32,
        segments: full ? 46 : 34,
        rings: full ? 4 : 3,
        seed: 73,
        elevation: 0.065,
        bowlDepth: 0.12,
      }),
      bunkerThreeLip: createIrregularRingGeometry({
        centre: [-7.1, 4.2],
        radii: [2.72, 4.52],
        thickness: 0.55,
        rotation: -0.32,
        segments: full ? 46 : 34,
        seed: 73,
        elevation: 0.14,
      }),
    };
  }, [quality]);

  useEffect(
    () => () => {
      Object.values(geometries).forEach((geometry) => geometry.dispose());
    },
    [geometries],
  );

  const flagHeight = terrainHeight(-2.1, -41.5) + 0.16;

  return (
    <group>
      <mesh geometry={geometries.terrain} receiveShadow>
        <meshStandardMaterial
          map={textures.rough.map}
          normalMap={textures.rough.normalMap}
          normalScale={ROUGH_NORMAL_SCALE}
          roughnessMap={textures.rough.roughnessMap}
          roughness={0.94}
          color="#aeb7a0"
          vertexColors
        />
      </mesh>

      <mesh geometry={geometries.firstCut} receiveShadow>
        <meshStandardMaterial
          map={textures.rough.map}
          normalMap={textures.rough.normalMap}
          normalScale={FIRST_CUT_NORMAL_SCALE}
          roughnessMap={textures.rough.roughnessMap}
          roughness={0.88}
          color="#b6bea3"
        />
      </mesh>
      <mesh geometry={geometries.fairway} receiveShadow>
        <meshStandardMaterial
          map={textures.fairway.map}
          normalMap={textures.fairway.normalMap}
          normalScale={FAIRWAY_NORMAL_SCALE}
          roughnessMap={textures.fairway.roughnessMap}
          roughness={0.82}
          color="#ddc6bc"
          onBeforeCompile={(shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <map_fragment>",
              `#include <map_fragment>
              float courseLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
              diffuseColor.rgb = mix(vec3(courseLuma), diffuseColor.rgb, 0.66);
              float mowingBand = step(0.5, fract(vMapUv.y * 0.125));
              diffuseColor.rgb *= mix(0.94, 1.045, mowingBand);`,
            );
          }}
          customProgramCacheKey={() => "marketing-fairway-grade-v1"}
        />
      </mesh>

      <mesh geometry={geometries.teeSurround} receiveShadow>
        <meshStandardMaterial
          map={textures.rough.map}
          normalMap={textures.rough.normalMap}
          normalScale={ROUGH_NORMAL_SCALE}
          roughnessMap={textures.rough.roughnessMap}
          roughness={0.9}
          color="#b8c1a6"
        />
      </mesh>
      <mesh geometry={geometries.tee} receiveShadow>
        <meshStandardMaterial
          map={textures.fairway.map}
          normalMap={textures.fairway.normalMap}
          normalScale={FAIRWAY_NORMAL_SCALE}
          roughnessMap={textures.fairway.roughnessMap}
          roughness={0.78}
          color="#d4d5bf"
        />
      </mesh>

      <mesh geometry={geometries.fringe} receiveShadow>
        <meshStandardMaterial
          map={textures.fairway.map}
          normalMap={textures.fairway.normalMap}
          normalScale={FAIRWAY_NORMAL_SCALE}
          roughnessMap={textures.fairway.roughnessMap}
          roughness={0.79}
          color="#c5cbb2"
        />
      </mesh>
      <mesh geometry={geometries.green} receiveShadow>
        <meshStandardMaterial
          map={textures.green.map}
          normalMap={textures.green.normalMap}
          normalScale={GREEN_NORMAL_SCALE}
          roughnessMap={textures.green.roughnessMap}
          roughness={0.73}
          color="#d3dbc1"
        />
      </mesh>

      <mesh geometry={geometries.path} receiveShadow>
        <meshStandardMaterial
          map={textures.path.map}
          normalMap={textures.path.normalMap}
          normalScale={PATH_NORMAL_SCALE}
          roughnessMap={textures.path.roughnessMap}
          roughness={0.96}
          color="#c6b792"
        />
      </mesh>

      <mesh geometry={geometries.waterBank} receiveShadow>
        <meshStandardMaterial color="#776b50" roughness={0.98} />
      </mesh>
      <mesh geometry={geometries.water}>
        <meshPhysicalMaterial
          map={textures.water}
          bumpMap={textures.waterBump}
          bumpScale={0.12}
          normalScale={WATER_NORMAL_SCALE}
          color="#c4ded8"
          roughness={0.32}
          metalness={0.04}
          clearcoat={0.28}
          clearcoatRoughness={0.3}
        />
      </mesh>

      <Bunker surface={geometries.bunkerOne} lip={geometries.bunkerOneLip} textures={textures} />
      <Bunker surface={geometries.bunkerTwo} lip={geometries.bunkerTwoLip} textures={textures} />
      <Bunker
        surface={geometries.bunkerThree}
        lip={geometries.bunkerThreeLip}
        textures={textures}
      />

      <group position={[-2.1, flagHeight, -41.5]}>
        <mesh position={[0, 1.75, 0]}>
          <cylinderGeometry args={[0.035, 0.045, 3.5, 8]} />
          <meshStandardMaterial color="#f6f0df" roughness={0.55} />
        </mesh>
        <mesh position={[0.46, 3.05, 0]} rotation={[0, 0, -0.03]}>
          <planeGeometry args={[0.9, 0.58]} />
          <meshStandardMaterial color="#b34532" roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.16, 0.24, 24]} />
          <meshBasicMaterial color="#f3efe2" />
        </mesh>
      </group>

      <TeeMarkers />
    </group>
  );
}

function Bunker({
  surface,
  lip,
  textures,
}: {
  surface: THREE.BufferGeometry;
  lip: THREE.BufferGeometry;
  textures: CourseTwinTextures;
}) {
  return (
    <group>
      <mesh geometry={lip} receiveShadow>
        <meshStandardMaterial color="#a68b5e" roughness={0.96} />
      </mesh>
      <mesh geometry={surface} receiveShadow>
        <meshStandardMaterial
          map={textures.sand.map}
          normalMap={textures.sand.normalMap}
          normalScale={SAND_NORMAL_SCALE}
          roughnessMap={textures.sand.roughnessMap}
          roughness={0.98}
          color="#eedbad"
        />
      </mesh>
    </group>
  );
}

function TeeMarkers() {
  const height = terrainHeight(0.5, 40.5) + 0.23;
  return (
    <group position={[0, height, 40.5]}>
      {[-1.15, 1.15].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.21, 0.3, 12]} />
          <meshStandardMaterial color="#f3e8c8" roughness={0.74} />
        </mesh>
      ))}
    </group>
  );
}
