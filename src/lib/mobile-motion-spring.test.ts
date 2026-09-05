import { describe, expect, it } from "vitest";
import { advanceMobileSpring } from "./mobile-motion-spring";
describe("mobile selection spring", () => {
  it("settles without overshooting a resting target and is frame-rate independent", () => {
    let sixty = { value: 0, velocity: 0 },
      oneTwenty = { value: 0, velocity: 0 };
    for (let i = 0; i < 120; i++) {
      sixty = advanceMobileSpring(sixty, 8, 1 / 60);
      expect(sixty.value).toBeLessThanOrEqual(8);
    }
    for (let i = 0; i < 240; i++) oneTwenty = advanceMobileSpring(oneTwenty, 8, 1 / 120);
    expect(sixty).toEqual({ value: 8, velocity: 0 });
    expect(oneTwenty).toEqual(sixty);
  });
  it("retains current position and velocity when reversed and immediately resolves reduced motion", () => {
    const moving = advanceMobileSpring({ value: 0, velocity: 0 }, 8, 0.05);
    expect(advanceMobileSpring(moving, 0, 0)).toEqual(moving);
    const reversing = advanceMobileSpring(moving, 0, 0.01);
    expect(reversing.value).toBeGreaterThan(moving.value);
    expect(reversing.velocity).toBeLessThan(moving.velocity);
    expect(advanceMobileSpring(moving, 0, 0.01, true)).toEqual({ value: 0, velocity: 0 });
  });
});
