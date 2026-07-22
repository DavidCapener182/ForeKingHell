export const RECENT_SIGN_IN_WINDOW_MS = 15 * 60 * 1000;

export function isRecentSignIn(lastSignInAt: string | undefined, now = Date.now()) {
  if (!lastSignInAt) return false;
  const signedInAt = Date.parse(lastSignInAt);

  return (
    Number.isFinite(signedInAt) && signedInAt <= now && now - signedInAt <= RECENT_SIGN_IN_WINDOW_MS
  );
}
