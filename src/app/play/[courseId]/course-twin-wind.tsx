"use client";
import { useFrame } from "@react-three/fiber";
import type { WebGLProgramParametersWithUniforms } from "three";

const windTime = { value: 0 };
/** Shared world-space direction and phase for colour and shadow passes. */
export function courseWindShader(shader: WebGLProgramParametersWithUniforms, billboard = false) {
  shader.uniforms.courseWindTime = windTime;
  shader.vertexShader =
    "uniform float courseWindTime;\n" +
    shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
#ifdef USE_INSTANCING
 float stemHeight = clamp(position.y ${billboard ? "+ 0.5" : ""},0.0,1.0);
 float heightM = length(instanceMatrix[1].xyz);
 float sway = sin(courseWindTime * 0.7 + instanceMatrix[3].x * 0.025 + instanceMatrix[3].z * 0.018);
 transformed += inverse(mat3(instanceMatrix)) * vec3(1.0,0.0,0.35) * heightM * 0.006 * stemHeight * stemHeight * sway;
#endif`,
    );
}
export function CourseTwinWind() {
  useFrame(({ clock, scene }) => {
    windTime.value = scene.userData.freezeWind ? 0 : clock.elapsedTime;
  });
  return null;
}
