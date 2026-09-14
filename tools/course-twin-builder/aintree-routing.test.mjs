import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AINTREE_ROUTING, correctAintreeRouting } from "./aintree-routing.mjs";
const manifest = JSON.parse(readFileSync("src/generated/course-twins/aintree-v1.json"));

test("all nine Aintree physical greens match the official tour and supplied scorecard", () => {
  assert.deepEqual(
    manifest.holes.map((h) => [h.holeNumber, h.yards, h.par, h.strokeIndex]),
    AINTREE_ROUTING.map(([n, , y, p, si]) => [n, y, p, si]),
  );
  assert.equal(
    manifest.holes.reduce((sum, h) => sum + h.yards, 0),
    3238,
  );
  assert.equal(
    manifest.holes.reduce((sum, h) => sum + h.par, 0),
    36,
  );
  for (const [number, , , , , x, z] of AINTREE_ROUTING) {
    const hole = manifest.holes[number - 1];
    assert.ok(Math.hypot(hole.green[0] - x, hole.green[2] - z) < 1);
    assert.deepEqual(hole.tee, hole.centerline[0]);
    assert.deepEqual(hole.green, hole.centerline.at(-1));
  }
  // Hole 1 leaves the clubhouse; 9 returns. Hole 6 crosses the central pond.
  assert.ok(manifest.holes[0].tee[0] < -400);
  assert.ok(manifest.holes[8].green[0] < -350);
  assert.ok(manifest.holes[5].tee[0] < 220 && manifest.holes[5].green[0] > 360);
});
test("routing survives old labels and shuffled source order, remaps feature ownership, and is idempotent", () => {
  const legacy = structuredClone(manifest);
  const oldNumber = new Map(AINTREE_ROUTING.map(([n, old]) => [n, old]));
  legacy.holes.forEach((h) => {
    h.holeNumber = oldNumber.get(h.holeNumber);
  });
  legacy.holes.reverse();
  legacy.features = [{ id: "probe", type: "tee", holeNumber: 5, rings: [] }];
  const corrected = correctAintreeRouting(legacy);
  assert.deepEqual(corrected.holes, manifest.holes);
  assert.equal(corrected.features[0].holeNumber, 2);
  assert.deepEqual(correctAintreeRouting(corrected), corrected);
  assert.equal(legacy.features[0].holeNumber, 5);
});
test("unrecognised Aintree geometry fails review instead of guessing; other courses pass through", () => {
  const changed = structuredClone(manifest);
  changed.holes[0].green[0] += 10;
  assert.throws(() => correctAintreeRouting(changed), /routing review/);
  const other = { course: { id: "bootle" } };
  assert.equal(correctAintreeRouting(other), other);
});
