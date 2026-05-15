import { createHmac, timingSafeEqual } from "node:crypto";

export type ScorecardProofPayload = {
  userId: string;
  totalScore: number | null;
  courseName: string | null;
  teeName: string | null;
  dateIso: string | null;
  createdAt: number;
  expiresAt: number;
};

const TOKEN_VERSION = "v1";
const TOKEN_TTL_MS = 30 * 60 * 1000;

export function createScorecardProofToken(input: Omit<ScorecardProofPayload, "createdAt" | "expiresAt">) {
  const now = Date.now();
  const payload: ScorecardProofPayload = {
    ...input,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(body);

  return `${TOKEN_VERSION}.${body}.${signature}`;
}

export function verifyScorecardProofToken(token: string | null | undefined, userId: string) {
  if (!token) {
    return null;
  }

  const [version, body, signature] = token.split(".");

  if (version !== TOKEN_VERSION || !body || !signature || !safeEqual(signature, sign(body))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as ScorecardProofPayload;

    if (payload.userId !== userId || payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function sign(body: string) {
  return createHmac("sha256", proofSecret()).update(body).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function proofSecret() {
  return process.env.SCORECARD_PROOF_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "local-scorecard-proof-secret";
}
