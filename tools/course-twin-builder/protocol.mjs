import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_MS = 5 * 60_000;

export function signPayload(body, timestamp, secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("COURSE_TWIN_WORKER_SECRET must contain at least 32 characters.");
  }
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyPayload({ body, timestamp, signature, secret, now = Date.now() }) {
  const time = Number(timestamp);
  if (!Number.isFinite(time) || Math.abs(now - time) > MAX_CLOCK_SKEW_MS) return false;
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = signPayload(body, String(timestamp), secret);
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
