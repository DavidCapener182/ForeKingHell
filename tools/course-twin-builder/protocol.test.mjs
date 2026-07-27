import assert from "node:assert/strict";
import test from "node:test";

import { signPayload, verifyPayload } from "./protocol.mjs";

const secret = "course-twin-worker-secret-with-at-least-32-characters";

test("worker protocol authenticates exact bytes within the replay window", () => {
  const body = '{"buildId":"build-1"}';
  const timestamp = "1000000";
  const signature = signPayload(body, timestamp, secret);
  assert.equal(verifyPayload({ body, timestamp, signature, secret, now: 1_000_001 }), true);
  assert.equal(
    verifyPayload({ body: `${body} `, timestamp, signature, secret, now: 1_000_001 }),
    false,
  );
  assert.equal(verifyPayload({ body, timestamp, signature, secret, now: 1_400_001 }), false);
});
