import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type ScorecardProofScope = {
  scopeType: "course_record" | "tournament";
  scopeId: string;
  roundNumber?: number | null;
};

export type ScorecardProofPayload = {
  proofId: string;
  userId: string;
  scopeType: ScorecardProofScope["scopeType"];
  scopeId: string;
  roundNumber: number | null;
  imageHash: string;
  totalScore: number | null;
  courseName: string | null;
  teeName: string | null;
  dateIso: string | null;
  createdAt: number;
  expiresAt: number;
};

const TOKEN_VERSION = "v1";
const TOKEN_TTL_MS = 30 * 60 * 1000;

export function createScorecardProofToken(
  input: Omit<ScorecardProofPayload, "proofId" | "createdAt" | "expiresAt">,
) {
  const now = Date.now();
  const payload: ScorecardProofPayload = {
    ...input,
    proofId: randomUUID(),
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(body);

  return `${TOKEN_VERSION}.${body}.${signature}`;
}

export function verifyScorecardProofToken(
  token: string | null | undefined,
  userId: string,
  scope: ScorecardProofScope,
) {
  if (!token) return null;

  const [version, body, signature] = token.split(".");
  if (version !== TOKEN_VERSION || !body || !signature || !safeEqual(signature, sign(body))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as ScorecardProofPayload;

    if (
      !isValidPayload(payload) ||
      payload.userId !== userId ||
      payload.scopeType !== scope.scopeType ||
      payload.scopeId !== scope.scopeId ||
      (scope.roundNumber !== undefined && payload.roundNumber !== (scope.roundNumber ?? null)) ||
      payload.createdAt > Date.now() + 60_000 ||
      payload.expiresAt < Date.now()
    ) {
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
  const secret =
    process.env.SCORECARD_PROOF_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (secret) return secret;
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
    return "local-scorecard-proof-secret";
  }

  throw new Error("SCORECARD_PROOF_SECRET is required outside local development.");
}

function isValidPayload(payload: ScorecardProofPayload) {
  return (
    typeof payload.proofId === "string" &&
    /^[0-9a-f-]{36}$/i.test(payload.proofId) &&
    typeof payload.userId === "string" &&
    (payload.scopeType === "course_record" || payload.scopeType === "tournament") &&
    typeof payload.scopeId === "string" &&
    payload.scopeId.length > 0 &&
    payload.scopeId.length <= 220 &&
    (payload.roundNumber === null ||
      (Number.isInteger(payload.roundNumber) &&
        payload.roundNumber >= 1 &&
        payload.roundNumber <= 20)) &&
    typeof payload.imageHash === "string" &&
    /^[a-f0-9]{64}$/i.test(payload.imageHash) &&
    typeof payload.createdAt === "number" &&
    Number.isFinite(payload.createdAt) &&
    typeof payload.expiresAt === "number" &&
    Number.isFinite(payload.expiresAt) &&
    payload.expiresAt > payload.createdAt
  );
}
