const sharedDatabaseArtifactPattern = /\bincert\b/i;

export function cleanProfileLabel(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned && !isSharedDatabaseArtifact(cleaned) ? cleaned : null;
}

export function profileLabelFromEmail(email: string | null | undefined) {
  const localPart = email?.split("@")[0]?.trim();
  return cleanProfileLabel(localPart);
}

export function profileLabelFromIdentity(
  name: string | null | undefined,
  email: string | null | undefined,
): string;
export function profileLabelFromIdentity(
  name: string | null | undefined,
  email: string | null | undefined,
  fallback: string,
): string;
export function profileLabelFromIdentity(
  name: string | null | undefined,
  email: string | null | undefined,
  fallback: null,
): string | null;
export function profileLabelFromIdentity(
  name: string | null | undefined,
  email: string | null | undefined,
  fallback: string | null = "Profile",
) {
  return cleanProfileLabel(name) ?? profileLabelFromEmail(email) ?? fallback;
}

export function isSharedDatabaseArtifact(value: string | null | undefined) {
  return typeof value === "string" && sharedDatabaseArtifactPattern.test(value);
}
