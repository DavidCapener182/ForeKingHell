import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

const COOKIE_NAME = "fkh_rapsodo_token";
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
let ephemeralSecret: Buffer | null = null;

export type StoredRapsodoToken = {
  token: string;
  profile: Record<string, unknown> | null;
  createdAt: number;
  expiresAt: number;
};

export async function getStoredRapsodoToken() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;

  if (!value) {
    return null;
  }

  try {
    const payload = decryptTokenPayload(value);

    if (payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function setStoredRapsodoToken(token: string, profile: Record<string, unknown> | null) {
  const now = Date.now();
  const expiresAt = now + TOKEN_TTL_SECONDS * 1000;
  const encrypted = encryptTokenPayload({
    token,
    profile,
    createdAt: now,
    expiresAt,
  });

  (await cookies()).set({
    name: COOKIE_NAME,
    value: encrypted,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
}

export async function clearStoredRapsodoToken() {
  (await cookies()).delete(COOKIE_NAME);
}

function encryptTokenPayload(payload: StoredRapsodoToken) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", base64Url(iv), base64Url(tag), base64Url(encrypted)].join(".");
}

function decryptTokenPayload(value: string): StoredRapsodoToken {
  const [version, ivText, tagText, encryptedText] = value.split(".");

  if (version !== "v1" || !ivText || !tagText || !encryptedText) {
    throw new Error("Invalid Rapsodo token cookie.");
  }

  const decipher = createDecipheriv(ALGORITHM, secretKey(), fromBase64Url(ivText));
  decipher.setAuthTag(fromBase64Url(tagText));
  const decrypted = Buffer.concat([decipher.update(fromBase64Url(encryptedText)), decipher.final()]);
  const payload = JSON.parse(decrypted.toString("utf8")) as StoredRapsodoToken;

  if (!payload.token || !Number.isFinite(payload.expiresAt)) {
    throw new Error("Invalid Rapsodo token payload.");
  }

  return payload;
}

function secretKey() {
  const configuredSecret = process.env.RAPSODO_TOKEN_SECRET;

  if (configuredSecret?.trim()) {
    return createHash("sha256").update(configuredSecret, "utf8").digest();
  }

  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32);
  }

  return ephemeralSecret;
}

function base64Url(value: Buffer) {
  return value.toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}
