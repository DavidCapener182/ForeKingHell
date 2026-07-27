import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { generateCourseTwinCompletion } from "./generator.mjs";
import { signPayload, verifyPayload } from "./protocol.mjs";

const MAX_JOB_BYTES = 5 * 1024 * 1024;

export function createCourseTwinBuilderServer({
  secret,
  callbackOrigins,
  generate = generateCourseTwinCompletion,
  env = process.env,
  logger = console,
}) {
  if (!secret || secret.length < 32) {
    throw new Error("COURSE_TWIN_WORKER_SECRET must contain at least 32 characters.");
  }
  const allowedOrigins = new Set(callbackOrigins.map((origin) => new URL(origin).origin));
  const jobs = new Map();
  let queue = Promise.resolve();
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (request.method === "GET" && request.url === "/health") {
      return send(response, 200, { status: "ok", queuedJobs: jobs.size });
    }
    if (request.method !== "POST" || request.url !== "/jobs") {
      return send(response, 404, { message: "Not found." });
    }
    try {
      const body = await readBody(request, MAX_JOB_BYTES);
      if (
        !verifyPayload({
          body,
          timestamp: request.headers["x-fkh-timestamp"],
          signature: request.headers["x-fkh-signature"],
          secret,
        })
      ) {
        return send(response, 404, { message: "Not found." });
      }
      const job = parseJob(JSON.parse(body), allowedOrigins);
      const executionReference = randomUUID();
      jobs.set(executionReference, { status: "queued", buildId: job.buildId });
      queue = queue
        .then(async () => {
          jobs.set(executionReference, { status: "running", buildId: job.buildId });
          let completion;
          try {
            completion = await generate(job.plan, env);
          } catch (error) {
            completion = {
              status: "failed",
              errorCode: "builder_failed",
              errorMessage:
                error instanceof Error ? error.message.slice(0, 2_000) : "Builder failed.",
            };
          }
          await postCompletion(job.callbackUrl, completion, secret);
          jobs.set(executionReference, {
            status: completion.status === "completed" ? "completed" : "failed",
            buildId: job.buildId,
          });
        })
        .catch((error) => logger.error("Course Twin builder job failed", error));
      return send(response, 202, { executionReference });
    } catch (error) {
      return send(response, error?.statusCode ?? 400, {
        message: error instanceof Error ? error.message : "Invalid builder request.",
      });
    }
  });
  return { server, jobs };
}

export async function startCourseTwinBuilderServer(env = process.env) {
  const host = env.COURSE_TWIN_BUILDER_HOST ?? "127.0.0.1";
  if (!["127.0.0.1", "::1"].includes(host) && env.COURSE_TWIN_BUILDER_ALLOW_REMOTE !== "1") {
    throw new Error("Remote builder binding requires COURSE_TWIN_BUILDER_ALLOW_REMOTE=1.");
  }
  const port = readPort(env.COURSE_TWIN_BUILDER_PORT ?? "8787");
  const callbackOrigins = (env.COURSE_TWIN_CALLBACK_ORIGINS ?? "http://localhost:3200")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const runtime = createCourseTwinBuilderServer({
    secret: env.COURSE_TWIN_WORKER_SECRET,
    callbackOrigins,
    env,
  });
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(port, host, resolve);
  });
  return { ...runtime, host, port };
}

async function postCompletion(callbackUrl, completion, secret) {
  const body = JSON.stringify(completion);
  const timestamp = String(Date.now());
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-FKH-Timestamp": timestamp,
      "X-FKH-Signature": signPayload(body, timestamp, secret),
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Course Twin callback returned ${response.status}.`);
}

function parseJob(value, allowedOrigins) {
  if (
    value?.protocolVersion !== 1 ||
    typeof value.buildId !== "string" ||
    typeof value.courseTwinId !== "string" ||
    typeof value.inputFingerprint !== "string" ||
    typeof value.callbackUrl !== "string" ||
    !value.plan
  ) {
    throw new Error("Course Twin builder job is incomplete.");
  }
  const callback = new URL(value.callbackUrl);
  if (!allowedOrigins.has(callback.origin))
    throw new Error("Builder callback origin is not allowed.");
  if (!/^\/api\/course-twins\/builds\/[0-9a-f-]+\/complete$/i.test(callback.pathname)) {
    throw new Error("Builder callback path is invalid.");
  }
  if (value.plan.inputFingerprint !== value.inputFingerprint) {
    throw new Error("Builder plan fingerprint does not match the job.");
  }
  return value;
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error("Builder job is too large.");
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function send(response, status, body) {
  response.statusCode = status;
  response.end(JSON.stringify(body));
}

function readPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error("Builder port is invalid.");
  return port;
}
