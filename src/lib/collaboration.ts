import { createHash, randomBytes } from "node:crypto";

import type { CollaborationRole } from "@/lib/collaboration-roles";

export { collaborationRoles } from "@/lib/collaboration-roles";
export type { CollaborationRole } from "@/lib/collaboration-roles";

export function normalizeInvitationEmail(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    throw new Error("Invite email is required.");
  }

  const email = value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invite email must be a valid email address.");
  }

  return email;
}

export function parseCollaborationRole(value: FormDataEntryValue | null): CollaborationRole {
  if (value === "coach" || value === "viewer" || value === "editor") {
    return value;
  }

  return "viewer";
}

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getInvitationExpiry(now = new Date()) {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 14);
  return expiresAt;
}
