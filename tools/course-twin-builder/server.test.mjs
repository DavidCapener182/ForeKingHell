import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { signPayload, verifyPayload } from "./protocol.mjs";
import { createCourseTwinBuilderServer } from "./server.mjs";

const secret = "course-twin-worker-secret-with-at-least-32-characters";

test("builder accepts a signed job and posts a signed completion", async () => {
  let receivedCompletion = null;
  const callbackServer = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    assert.equal(
      verifyPayload({
        body,
        timestamp: request.headers["x-fkh-timestamp"],
        signature: request.headers["x-fkh-signature"],
        secret,
      }),
      true,
    );
    receivedCompletion = JSON.parse(body);
    response.statusCode = 200;
    response.end("{}");
  });
  await new Promise((resolve) => callbackServer.listen(0, "127.0.0.1", resolve));
  const callbackAddress = callbackServer.address();
  const callbackOrigin = `http://127.0.0.1:${callbackAddress.port}`;
  const runtime = createCourseTwinBuilderServer({
    secret,
    callbackOrigins: [callbackOrigin],
    generate: async (plan) => ({
      status: "completed",
      manifest: { course: { id: plan.course.id } },
      assets: [],
      metrics: {},
    }),
  });
  await new Promise((resolve) => runtime.server.listen(0, "127.0.0.1", resolve));
  const builderAddress = runtime.server.address();
  const body = JSON.stringify({
    protocolVersion: 1,
    buildId: "11111111-1111-4111-8111-111111111111",
    courseTwinId: "22222222-2222-4222-8222-222222222222",
    inputFingerprint: "fingerprint-1",
    callbackUrl: `${callbackOrigin}/api/course-twins/builds/11111111-1111-4111-8111-111111111111/complete`,
    plan: { inputFingerprint: "fingerprint-1", course: { id: "course-1" } },
  });
  const timestamp = String(Date.now());
  const response = await fetch(`http://127.0.0.1:${builderAddress.port}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-FKH-Timestamp": timestamp,
      "X-FKH-Signature": signPayload(body, timestamp, secret),
    },
    body,
  });
  assert.equal(response.status, 202);
  await waitFor(() => receivedCompletion !== null);
  assert.equal(receivedCompletion.status, "completed");
  await Promise.all([
    new Promise((resolve) => runtime.server.close(resolve)),
    new Promise((resolve) => callbackServer.close(resolve)),
  ]);
});

async function waitFor(predicate) {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for builder callback.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
