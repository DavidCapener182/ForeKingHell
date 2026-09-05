export type MobileSpringState = { value: number; velocity: number };
/** Exact critically damped step. Retargeting preserves the visible position and velocity. */
export function advanceMobileSpring(
  state: MobileSpringState,
  target: number,
  seconds: number,
  reducedMotion = false,
): MobileSpringState {
  if (reducedMotion) return { value: target, velocity: 0 };
  const time = Math.max(0, Math.min(seconds, 0.064));
  const frequency = 18;
  const offset = state.value - target;
  const impulse = state.velocity + frequency * offset;
  const decay = Math.exp(-frequency * time);
  const value = target + (offset + impulse * time) * decay;
  const velocity = (state.velocity - frequency * impulse * time) * decay;
  return Math.abs(value - target) < 0.001 && Math.abs(velocity) < 0.001
    ? { value: target, velocity: 0 }
    : { value, velocity };
}
