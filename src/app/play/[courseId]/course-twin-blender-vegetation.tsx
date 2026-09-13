"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { partitionScenery, type SceneryInstance } from "@/lib/course-twin-scenery";

type Part = { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] };
type Library = { near: Part[]; mid: Part[]; dispose: () => void };

async function loadLibrary(asset: string, signal: AbortSignal, high: boolean): Promise<Library> {
  const scenes: THREE.Group[] = [];
  const parts: Part[] = [];
  const dispose = () => {
    const textures = new Set<THREE.Texture>();
    const materials = new Set<THREE.Material>();
    for (const scene of scenes)
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) textures.add(value);
        }
      });
    parts.forEach((p) => p.geometry.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };
  try {
    const levels: Part[][] = [];
    // Sequential, optional downloads; terrain and existing billboards stay usable.
    for (const lod of high ? ["near", "mid"] : ["mid"]) {
      const response = await fetch(`/course-twins/common/blender-v1/${asset}-${lod}.glb`, {
        signal,
      });
      if (!response.ok) throw new Error(`Scenery HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 6 * 1024 * 1024) throw new Error("Scenery exceeds runtime budget");
      const gltf = await new GLTFLoader().parseAsync(bytes, "");
      scenes.push(gltf.scene);
      if (signal.aborted) throw new Error("Scenery load cancelled");
      gltf.scene.updateMatrixWorld(true);
      const level: Part[] = [];
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = asset === "parked_car" ? 0.4 : 0.92;
            material.metalness = 0;
            material.transparent = false;
            material.alphaTest = 0.4;
            material.side = THREE.DoubleSide;
          }
        }
        const part = { geometry, material: object.material };
        level.push(part);
        parts.push(part);
      });
      if (!level.length) throw new Error("Empty scenery model");
      levels.push(level);
    }
    return { near: levels[0], mid: levels.at(-1)!, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

export function BlenderVegetation({
  asset,
  instances,
  high,
  fallback,
}: {
  asset: "tree_small_02" | "shrub_04" | "rough_grass" | "palm" | "parked_car";
  instances: SceneryInstance[];
  high: boolean;
  fallback: (instances: SceneryInstance[]) => ReactNode;
}) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [partition, setPartition] = useState(() =>
    partitionScenery(instances, { x: 1e9, y: 0, z: 0 }, high),
  );
  const previous = useRef("");
  const elapsed = useRef(0);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("scenery") === "off") return;
    const controller = new AbortController();
    let active: Library | null = null;
    const timer = setTimeout(() => {
      loadLibrary(asset, controller.signal, high)
        .then((result) => {
          if (controller.signal.aborted) {
            result.dispose();
            return;
          }
          active = result;
          setLibrary(result);
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            console.warn("Optional Blender scenery unavailable; retaining billboards.", error);
        });
    }, 1200);
    return () => {
      clearTimeout(timer);
      controller.abort();
      active?.dispose();
    };
  }, [asset, high]);
  useFrame(({ camera }, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.35 || !library) return;
    elapsed.current = 0;
    const next = partitionScenery(instances, camera.position, high, asset === "parked_car");
    const key = next.near.join(",") + "/" + next.mid.join(",");
    if (key !== previous.current) {
      previous.current = key;
      setPartition(next);
    }
  });
  const valid =
    library &&
    partition.far.length + partition.near.length + partition.mid.length === instances.length;
  return (
    <group
      name={`Blender decorative ${asset}`}
      userData={{
        decorativeOnly: true,
        source:
          asset === "rough_grass" || asset === "palm" || asset === "parked_car"
            ? "Original Blender procedural model"
            : "Poly Haven CC0",
        inferredPlacement: true,
      }}
    >
      {fallback(valid ? partition.far.map((i) => instances[i]) : instances)}
      {valid
        ? (["near", "mid"] as const).map((lod) =>
            library[lod].map((part, index) => (
              <ModelInstances
                key={`${lod}-${index}`}
                part={part}
                vehicles={asset === "parked_car"}
                instances={partition[lod].map((i) => instances[i])}
              />
            )),
          )
        : null}
    </group>
  );
}

function ModelInstances({
  part,
  instances,
  vehicles,
}: {
  part: Part;
  instances: SceneryInstance[];
  vehicles: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const transform = new THREE.Object3D();
    const colour = new THREE.Color();
    instances.forEach((p, i) => {
      transform.position.set(p.x, p.y, p.z);
      transform.rotation.set(0, p.rotation, 0);
      transform.scale.set(p.height * p.widthScale, p.height, p.height * p.widthScale);
      transform.updateMatrix();
      ref.current!.setMatrixAt(i, transform.matrix);
      if (vehicles && !Array.isArray(part.material) && part.material.name === "paint")
        colour.setHex([0xe3e2dc, 0x899198, 0x354b60, 0x833a34, 0x404449, 0x576968][p.variant % 6]);
      else colour.setRGB(1 + p.tint * 0.045, 1 + p.tint * 0.03, 1 + p.tint * 0.025);
      ref.current!.setColorAt(i, colour);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [instances, vehicles, part.material]);
  useEffect(() => {
    const mesh = ref.current;
    return () => mesh?.dispose();
  }, [instances.length]);
  if (!instances.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[part.geometry, part.material, instances.length]}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}
