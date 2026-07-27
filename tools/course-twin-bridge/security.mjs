import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export class PairingAuthority {
  #pairingCode;
  #tokenHashes = new Map();
  #tokenTtlMs;
  #now;

  constructor({ tokenTtlMs = 10 * 60_000, now = () => Date.now(), pairingCode } = {}) {
    this.#tokenTtlMs = tokenTtlMs;
    this.#now = now;
    this.#pairingCode = pairingCode ?? createPairingCode();
  }

  get pairingCode() {
    return this.#pairingCode;
  }

  pair(code) {
    if (!constantTimeCodeMatch(code, this.#pairingCode)) return null;

    const token = randomBytes(32).toString("base64url");
    const expiresAt = this.#now() + this.#tokenTtlMs;
    this.#tokenHashes.set(hashToken(token), expiresAt);
    this.#pairingCode = createPairingCode();
    this.prune();
    return { token, expiresAt, pairingCode: this.#pairingCode };
  }

  verify(token) {
    if (typeof token !== "string" || token.length < 32 || token.length > 128) return false;
    const digest = hashToken(token);
    const expiresAt = this.#tokenHashes.get(digest);
    if (!expiresAt || expiresAt <= this.#now()) {
      this.#tokenHashes.delete(digest);
      return false;
    }
    return true;
  }

  revoke(token) {
    if (typeof token === "string") this.#tokenHashes.delete(hashToken(token));
  }

  prune() {
    const now = this.#now();
    for (const [digest, expiresAt] of this.#tokenHashes) {
      if (expiresAt <= now) this.#tokenHashes.delete(digest);
    }
  }
}

export class FixedWindowRateLimiter {
  #entries = new Map();
  #limit;
  #windowMs;
  #now;

  constructor({ limit, windowMs, now = () => Date.now() }) {
    this.#limit = limit;
    this.#windowMs = windowMs;
    this.#now = now;
  }

  accept(key) {
    const now = this.#now();
    const current = this.#entries.get(key);
    if (!current || current.resetAt <= now) {
      this.#entries.set(key, { count: 1, resetAt: now + this.#windowMs });
      return true;
    }
    if (current.count >= this.#limit) return false;
    current.count += 1;
    return true;
  }
}

export function assertLoopbackHost(host) {
  if (host !== "127.0.0.1" && host !== "::1" && host !== "localhost") {
    throw new Error("Course Twin Bridge may only bind to a loopback address.");
  }
}

export function parseAllowedOrigins(value) {
  const defaults = [
    "http://localhost:3000",
    "http://localhost:3200",
    "http://localhost:3210",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3200",
    "http://127.0.0.1:3210",
  ];
  const candidates = value ? value.split(",") : defaults;
  return new Set(candidates.map((origin) => new URL(origin.trim()).origin));
}

function createPairingCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function constantTimeCodeMatch(actual, expected) {
  if (typeof actual !== "string" || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
