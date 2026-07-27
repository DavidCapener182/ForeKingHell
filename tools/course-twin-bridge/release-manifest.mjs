import { createHash, sign, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const RELEASE_CHANNELS = new Set(["local", "beta", "stable"]);

export async function describeArtifact(filePath) {
  const bytes = await readFile(filePath);
  return {
    name: basename(filePath),
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function createReleaseManifest({
  version,
  channel,
  platform,
  architecture,
  nodeVersion,
  artifacts,
  codeSignature,
  notarized = false,
  generatedAt = new Date().toISOString(),
}) {
  if (!RELEASE_CHANNELS.has(channel)) throw new Error(`Unsupported release channel: ${channel}.`);
  if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error("Bridge version is invalid.");
  if (!Array.isArray(artifacts) || artifacts.length === 0)
    throw new Error("A bridge release must contain at least one artifact.");

  return {
    schemaVersion: 1,
    product: "ForeKingHell Course Twin Bridge",
    version,
    channel,
    platform,
    architecture,
    nodeVersion,
    generatedAt,
    trust: {
      manifestSignature: channel === "local" ? "unsigned-local" : "ed25519",
      codeSignature,
      notarized,
    },
    artifacts: [...artifacts].sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export function serializeReleaseManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function signReleaseManifest(serializedManifest, privateKey) {
  return sign(null, Buffer.from(serializedManifest), privateKey).toString("base64");
}

export function verifyReleaseManifest(serializedManifest, signature, publicKey) {
  return verify(null, Buffer.from(serializedManifest), publicKey, Buffer.from(signature, "base64"));
}

export function assertReleaseTrust({ channel, platform, env }) {
  if (channel === "local") return;
  if (!env.FKH_RELEASE_MANIFEST_PRIVATE_KEY)
    throw new Error(`${channel} releases require FKH_RELEASE_MANIFEST_PRIVATE_KEY.`);
  if (platform === "darwin" && !env.FKH_MACOS_SIGN_IDENTITY)
    throw new Error(`${channel} macOS releases require FKH_MACOS_SIGN_IDENTITY.`);
  if (platform === "win32" && !env.FKH_WINDOWS_SIGN_CERT_SHA1)
    throw new Error(`${channel} Windows releases require FKH_WINDOWS_SIGN_CERT_SHA1.`);
  if (channel === "stable" && platform === "darwin" && !env.FKH_APPLE_NOTARY_PROFILE)
    throw new Error("Stable macOS releases require FKH_APPLE_NOTARY_PROFILE.");
}
