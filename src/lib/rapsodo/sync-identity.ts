import { createHash } from "node:crypto";

export function buildRapsodoSyncSessionKey(providerKind: string, providerSessionId: string) {
  return `${providerKind}:${providerSessionId}`;
}

export function hashRapsodoExportCsv(rawCsvText: string) {
  return createHash("sha256").update(rawCsvText, "utf8").digest("hex");
}
