import test from "node:test";
import assert from "node:assert/strict";
import {
  FixedWindowRateLimiter,
  PairingAuthority,
  assertLoopbackHost,
  parseAllowedOrigins,
} from "./security.mjs";

test("pairing codes are one-time and tokens expire", () => {
  let now = 1_000;
  const authority = new PairingAuthority({
    pairingCode: "123456",
    tokenTtlMs: 500,
    now: () => now,
  });
  const session = authority.pair("123456");
  assert.ok(session?.token);
  assert.equal(authority.pair("123456"), null);
  assert.equal(authority.verify(session.token), true);
  now = 1_501;
  assert.equal(authority.verify(session.token), false);
});

test("rate limiter enforces a fixed request window", () => {
  let now = 10;
  const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 100, now: () => now });
  assert.equal(limiter.accept("client"), true);
  assert.equal(limiter.accept("client"), true);
  assert.equal(limiter.accept("client"), false);
  now = 111;
  assert.equal(limiter.accept("client"), true);
});

test("bridge binding rejects non-loopback hosts", () => {
  assert.doesNotThrow(() => assertLoopbackHost("127.0.0.1"));
  assert.doesNotThrow(() => assertLoopbackHost("::1"));
  assert.throws(() => assertLoopbackHost("0.0.0.0"), /loopback/);
  assert.throws(() => assertLoopbackHost("192.168.1.5"), /loopback/);
});

test("origin allowlist is exact rather than suffix matched", () => {
  const origins = parseAllowedOrigins("http://localhost:3210,https://app.forekinghell.com");
  assert.equal(origins.has("http://localhost:3210"), true);
  assert.equal(origins.has("https://app.forekinghell.com"), true);
  assert.equal(origins.has("https://app.forekinghell.com.evil.invalid"), false);
});
