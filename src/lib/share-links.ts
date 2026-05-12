import { createHash, randomBytes } from "node:crypto";

export const shareResourceTypes = ["round"] as const;
export type ShareResourceType = (typeof shareResourceTypes)[number];

export function createShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseShareResourceType(value: FormDataEntryValue | null): ShareResourceType {
  return value === "round" ? "round" : "round";
}

export function getShareExpiry(days: number | null, now = new Date()) {
  if (!days || days <= 0) {
    return null;
  }

  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + Math.min(days, 365));
  return expiresAt;
}
