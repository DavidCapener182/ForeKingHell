const providerFailureMessages = {
  authentication: "Connection expired — reconnect this provider.",
  unavailable: "Provider unavailable — retry shortly.",
  busy: "Provider is busy — retry shortly.",
  format: "File format needs review before it can import.",
  duplicate: "This import was already processed or conflicts with an earlier file.",
  generic: "Import failed — retry or reconnect this provider.",
} as const;

export function safeProviderFailureMessage(errorMessage: string | null | undefined) {
  if (!errorMessage) return null;

  const value = errorMessage.toLowerCase().slice(0, 500);
  if (/auth|credential|forbidden|unauthori[sz]ed|token|sign[ -]?in/.test(value)) {
    return providerFailureMessages.authentication;
  }
  if (/rate.?limit|too many requests|\b429\b/.test(value)) {
    return providerFailureMessages.busy;
  }
  if (/timeout|timed out|network|fetch|unavailable|econn|dns|socket/.test(value)) {
    return providerFailureMessages.unavailable;
  }
  if (/parse|csv|header|column|format|validation|invalid row|invalid file/.test(value)) {
    return providerFailureMessages.format;
  }
  if (/duplicate|already (?:exists|processed|imported)|conflict/.test(value)) {
    return providerFailureMessages.duplicate;
  }
  return providerFailureMessages.generic;
}
