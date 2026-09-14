import { Vector3 } from "three";

/** One local daylight shadow, never a map stretched across the entire catalogue. */
export const COURSE_SUN_DIRECTION = new Vector3(-260, 285, 170).normalize();
const right = new Vector3().crossVectors(new Vector3(0, 1, 0), COURSE_SUN_DIRECTION).normalize();
const up = new Vector3().crossVectors(COURSE_SUN_DIRECTION, right).normalize();

export function fitCourseShadow(focus: Vector3, halfExtent: number, resolution: number) {
  const texel = (halfExtent * 2) / resolution;
  // Snap in light space, not world X/Z: camera pans smaller than a shadow texel
  // must not slide the texture across stationary leaves and grass.
  const centre = right
    .clone()
    .multiplyScalar(Math.round(focus.dot(right) / texel) * texel)
    .addScaledVector(up, Math.round(focus.dot(up) / texel) * texel)
    .addScaledVector(COURSE_SUN_DIRECTION, focus.dot(COURSE_SUN_DIRECTION));
  return { centre, position: centre.clone().addScaledVector(COURSE_SUN_DIRECTION, 550), texel };
}
